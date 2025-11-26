const API_BASE_URL = 'http://localhost:3000';
const STORAGE_KEYS = {
  ACCESS_TOKEN: 'memory_access_token',
  USER_DATA: 'memory_user_data',
  AUTH_TIMESTAMP: 'memory_auth_timestamp'
};

const loginSection = document.getElementById('loginSection');
const summarySection = document.getElementById('summarySection');
const loadingSection = document.getElementById('loadingSection');
const successSection = document.getElementById('successSection');
const errorMessage = document.getElementById('errorMessage');

const loginBtn = document.getElementById('loginBtn');
const signupBtn = document.getElementById('signupBtn');
const addToMemoryBtn = document.getElementById('addToMemoryBtn');
const logoutBtn = document.getElementById('logoutBtn');
const viewMemoryBtn = document.getElementById('viewMemoryBtn');
const formatBulletsBtn = document.getElementById('formatBullets');
const formatParagraphBtn = document.getElementById('formatParagraph');

const siteUrl = document.getElementById('siteUrl');
const userName = document.getElementById('userName');
const userEmail = document.getElementById('userEmail');
const userAvatar = document.getElementById('userAvatar');
const loadingText = document.getElementById('loadingText');

let currentTab = null;
let isAuthenticated = false;
let authCheckInProgress = false;
let summaryFormat = 'bullets';

document.addEventListener('DOMContentLoaded', async () => {
  await initializePopup();
});

window.addEventListener('beforeunload', () => {
  stopAuthPolling();
});

async function initializePopup() {

  try {

    showLoadingState();

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTab = tab;

    if (tab.url) {
      siteUrl.textContent = tab.url;
    }

    setupEventListeners();

    await checkAuthentication();

    const foundAuth = await checkForAuthInAllTabs();
    if (foundAuth) {
      await checkAuthentication();
    }

  } catch (error) {
    console.error('Error initializing popup:', error);
    showError('Failed to initialize extension');
    showLoginSection();
  }
}

async function checkForAuthInAllTabs() {

  try {

    const tabs = await chrome.tabs.query({});

    const relevantTabs = tabs
      .filter(tab => tab.url && (tab.url.startsWith('http://localhost:3000') || tab.url.startsWith('http://127.0.0.1:3000')))
      .slice(0, 10);

    const checkPromises = relevantTabs.map(async (tab) => {
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            return localStorage.getItem('memory_extension_auth');
          }
        });

        if (results && results[0] && results[0].result) {
          const authData = JSON.parse(results[0].result);

          await chrome.storage.local.set({
            [STORAGE_KEYS.ACCESS_TOKEN]: authData.access_token,
            [STORAGE_KEYS.USER_DATA]: authData.user,
            [STORAGE_KEYS.AUTH_TIMESTAMP]: Date.now()
          });

          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              localStorage.removeItem('memory_extension_auth');
            }
          });

          return true;
        }
      } catch (error) {
        return false;
      }
      return false;
    });

    const results = await Promise.all(checkPromises);
    return results.some(result => result === true);
  } catch (error) {
    console.error('Error checking for auth in tabs:', error);
    return false;
  }
}

function setupEventListeners() {
  loginBtn.addEventListener('click', openLoginPage);
  signupBtn.addEventListener('click', openSignupPage);
  addToMemoryBtn.addEventListener('click', addToMemory);
  logoutBtn.addEventListener('click', logout);
  viewMemoryBtn.addEventListener('click', openMemoryDashboard);

  if (formatBulletsBtn) {
    formatBulletsBtn.addEventListener('click', () => {
      summaryFormat = 'bullets';
      formatBulletsBtn.classList.add('format-active');
      formatParagraphBtn.classList.remove('format-active');
    });
  }

  if (formatParagraphBtn) {
    formatParagraphBtn.addEventListener('click', () => {
      summaryFormat = 'paragraph';
      formatParagraphBtn.classList.add('format-active');
      formatBulletsBtn.classList.remove('format-active');
    });
  }
}

async function checkAuthentication() {
  if (authCheckInProgress) {
    return;
  }

  authCheckInProgress = true;

  try {
    const result = await chrome.storage.local.get([
      STORAGE_KEYS.ACCESS_TOKEN,
      STORAGE_KEYS.USER_DATA,
      STORAGE_KEYS.AUTH_TIMESTAMP
    ]);

    const token = result[STORAGE_KEYS.ACCESS_TOKEN];
    const userData = result[STORAGE_KEYS.USER_DATA];
    const authTimestamp = result[STORAGE_KEYS.AUTH_TIMESTAMP];

    const isRecentAuth = authTimestamp && (Date.now() - authTimestamp < 24 * 60 * 60 * 1000);

    if (token && userData) {

      if (isRecentAuth) {
        isAuthenticated = true;
        showSummarySection(userData);
        stopAuthPolling();

        verifyToken(token).then(isValid => {
          if (isValid) {
            chrome.storage.local.set({
              [STORAGE_KEYS.AUTH_TIMESTAMP]: Date.now()
            });
          }
        });
      } else {
        const isValid = await verifyToken(token);

        if (isValid) {
          await chrome.storage.local.set({
            [STORAGE_KEYS.AUTH_TIMESTAMP]: Date.now()
          });
          isAuthenticated = true;
          showSummarySection(userData);
          stopAuthPolling();
        } else {
          await chrome.storage.local.remove([
            STORAGE_KEYS.ACCESS_TOKEN,
            STORAGE_KEYS.USER_DATA,
            STORAGE_KEYS.AUTH_TIMESTAMP
          ]);
          showLoginSection();
        }
      }
    } else {
      showLoginSection();
    }
  } catch (error) {
    console.error('Error checking authentication:', error);
    showLoginSection();
  } finally {
    authCheckInProgress = false;
  }
}

async function verifyToken(token) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`${API_BASE_URL}/api/auth/verify`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    if (error.name === 'AbortError') {
      return true;
    } else {
      console.error('Error verifying token:', error);
      return true;
    }
  }
}

function showLoginSection() {
  isAuthenticated = false;
  loginSection.style.display = 'block';
  summarySection.style.display = 'none';
  loadingSection.style.display = 'none';
  successSection.style.display = 'none';
  hideError();

  const formatSelector = document.getElementById('formatSelector');
  if (formatSelector) {
    formatSelector.style.display = 'none';
  }

  if (!isAuthenticated) {
    checkForAuthInAllTabs().then(foundAuth => {
      if (foundAuth && !isAuthenticated) {
        checkAuthentication();
      } else if (!isAuthenticated) {
        startAuthPolling();
      }
    }).catch(() => {
      if (!isAuthenticated) {
        startAuthPolling();
      }
    });
  }
}

function showSummarySection(userData) {
  isAuthenticated = true;
  loginSection.style.display = 'none';
  summarySection.style.display = 'block';
  loadingSection.style.display = 'none';
  successSection.style.display = 'none';
  hideError();

  const formatSelector = document.getElementById('formatSelector');
  if (formatSelector) {
    formatSelector.style.display = 'block';
  }

  stopAuthPolling();

  if (userData) {
    userName.textContent = userData.name || 'User';
    userEmail.textContent = userData.email || 'user@example.com';
    userAvatar.textContent = (userData.name || 'U').charAt(0).toUpperCase();
  }
}

function showLoadingSection(message = 'Adding to Memory...') {
  loginSection.style.display = 'none';
  summarySection.style.display = 'none';
  loadingSection.style.display = 'block';
  successSection.style.display = 'none';
  hideError();
  if (loadingText) {
    loadingText.textContent = message;
  }
}

function showLoadingState() {
  loginSection.style.display = 'none';
  summarySection.style.display = 'none';
  loadingSection.style.display = 'block';
  successSection.style.display = 'none';
  hideError();
  if (loadingText) {
    loadingText.textContent = 'Loading...';
  }
}

function showSuccessSection() {
  loginSection.style.display = 'none';
  summarySection.style.display = 'none';
  loadingSection.style.display = 'none';
  successSection.style.display = 'block';
  hideError();
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.style.display = 'block';
}

function hideError() {
  errorMessage.style.display = 'none';
}

function openLoginPage() {
  chrome.tabs.create({ url: `${API_BASE_URL}/auth/login?extension=true` });
  window.close();
}

function openSignupPage() {
  chrome.tabs.create({ url: `${API_BASE_URL}/auth/signup?extension=true` });
  window.close();
}

function openMemoryDashboard() {
  chrome.tabs.create({ url: `${API_BASE_URL}/dashboard` });
  window.close();
}

async function addToMemory() {
  if (!currentTab) {
    showError('Unable to get current page information');
    return;
  }

  showLoadingSection();

  try {
    const result = await chrome.storage.local.get([STORAGE_KEYS.ACCESS_TOKEN]);
    const token = result[STORAGE_KEYS.ACCESS_TOKEN];

    if (!token) {
      showError('Please sign in first');
      showLoginSection();
      return;
    }

    const response = await fetch(`${API_BASE_URL}/api/ai/text`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: currentTab.url,
        format: summaryFormat
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to add to Memory');
    }

    chrome.storage.local.set({
      [STORAGE_KEYS.AUTH_TIMESTAMP]: Date.now()
    });

    showSuccessSection();

  } catch (error) {
    console.error('Error adding to Memory:', error);
    showError(error.message || 'Failed to add page to Memory');
    showSummarySection();
  }
}

async function logout() {

  try {
    await chrome.storage.local.clear();

    showLoginSection();

  } catch (error) {
    console.error('Error logging out:', error);
    showError('Failed to logout');
  }

}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  if (message.type === 'AUTH_SUCCESS') {
    if (message.data) {
      chrome.storage.local.set({
        [STORAGE_KEYS.ACCESS_TOKEN]: message.data.access_token,
        [STORAGE_KEYS.USER_DATA]: message.data.user,
        [STORAGE_KEYS.AUTH_TIMESTAMP]: Date.now()
      }, () => {
        checkAuthentication();
      });
    } else {
      checkAuthentication();
    }
  }

});

window.addEventListener('message', (event) => {

  if (event.data.type === 'MEMORY_AUTH_SUCCESS') {
    chrome.storage.local.set({
      [STORAGE_KEYS.ACCESS_TOKEN]: event.data.data.access_token,
      [STORAGE_KEYS.USER_DATA]: event.data.data.user,
      [STORAGE_KEYS.AUTH_TIMESTAMP]: Date.now()
    }, () => {
      checkAuthentication();
    });
  }

});

let authPollingInterval = null;
let authPollingTimeout = null;

function startAuthPolling() {

  if (authPollingInterval) return;

  let pollCount = 0;
  const maxPolls = 120;

  authPollingInterval = setInterval(async () => {
    pollCount++;

    if (pollCount > maxPolls) {
      stopAuthPolling();
      return;
    }

    try {

      const result = await chrome.storage.local.get([
        STORAGE_KEYS.ACCESS_TOKEN,
        STORAGE_KEYS.USER_DATA
      ]);

      if (result[STORAGE_KEYS.ACCESS_TOKEN] && result[STORAGE_KEYS.USER_DATA]) {
        await checkAuthentication();
        stopAuthPolling();
        return;
      }

      const foundAuth = await checkForAuthInAllTabs();

      if (foundAuth) {
        await checkAuthentication();
        stopAuthPolling();
      }
    } catch (error) {
      console.error('Auth polling error:', error);
    }
  }, 500);
}

function stopAuthPolling() {
  if (authPollingInterval) {
    clearInterval(authPollingInterval);
    authPollingInterval = null;
  }
  if (authPollingTimeout) {
    clearTimeout(authPollingTimeout);
    authPollingTimeout = null;
  }
}

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    if (changes[STORAGE_KEYS.ACCESS_TOKEN] || changes[STORAGE_KEYS.USER_DATA]) {
      if (!isAuthenticated) {
        clearTimeout(authPollingTimeout);
        authPollingTimeout = setTimeout(() => {
          checkAuthentication();
        }, 100);
      }
    }
  }
});
