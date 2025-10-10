const API_BASE_URL = 'http://localhost:3000';
const STORAGE_KEYS = {
  ACCESS_TOKEN: 'memory_access_token',
  USER_DATA: 'memory_user_data'
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

const siteUrl = document.getElementById('siteUrl');
const userName = document.getElementById('userName');
const userEmail = document.getElementById('userEmail');
const userAvatar = document.getElementById('userAvatar');

let currentTab = null;
let isAuthenticated = false;

document.addEventListener('DOMContentLoaded', async () => {
  await initializePopup();
});

window.addEventListener('beforeunload', () => {
  stopAuthPolling();
});

async function initializePopup() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTab = tab;
    
    siteUrl.textContent = tab.url;
    
    await checkForAuthInTab(tab.id);
    
    await checkAuthentication();
    
    setupEventListeners();
    
  } catch (error) {
    console.error('Error initializing popup:', error);
    showError('Failed to initialize extension');
  }
}

async function checkForAuthInTab(tabId) {
  try {

    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: () => {
        return localStorage.getItem('memory_extension_auth');
      }
    });
    
    if (results && results[0] && results[0].result) {
      const authData = JSON.parse(results[0].result);
      
      await chrome.storage.local.set({
        [STORAGE_KEYS.ACCESS_TOKEN]: authData.access_token,
        [STORAGE_KEYS.USER_DATA]: authData.user
      });
      
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: () => {
          localStorage.removeItem('memory_extension_auth');
        }
      });
      
    }
  } catch (error) {
  }
}

function setupEventListeners() {
  loginBtn.addEventListener('click', openLoginPage);
  signupBtn.addEventListener('click', openSignupPage);
  addToMemoryBtn.addEventListener('click', addToMemory);
  logoutBtn.addEventListener('click', logout);
  viewMemoryBtn.addEventListener('click', openMemoryDashboard);
}

async function checkAuthentication() {
  try {
    const result = await chrome.storage.local.get([STORAGE_KEYS.ACCESS_TOKEN, STORAGE_KEYS.USER_DATA]);
    
    if (result[STORAGE_KEYS.ACCESS_TOKEN] && result[STORAGE_KEYS.USER_DATA]) {
      const isValid = await verifyToken(result[STORAGE_KEYS.ACCESS_TOKEN]);
      
      if (isValid) {
        isAuthenticated = true;
        showSummarySection(result[STORAGE_KEYS.USER_DATA]);
      } else {
        await chrome.storage.local.clear();
        showLoginSection();
      }
    } else {
      showLoginSection();
    }
  } catch (error) {
    console.error('Error checking authentication:', error);
    showLoginSection();
  }
}

async function verifyToken(token) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/verify`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    return response.ok;
  } catch (error) {
    console.error('Error verifying token:', error);
    return false;
  }
}

function showLoginSection() {
  loginSection.style.display = 'block';
  summarySection.style.display = 'none';
  loadingSection.style.display = 'none';
  successSection.style.display = 'none';
  hideError();
  
  startAuthPolling();
}

function showSummarySection(userData) {
  loginSection.style.display = 'none';
  summarySection.style.display = 'block';
  loadingSection.style.display = 'none';
  successSection.style.display = 'none';
  hideError();
  
  stopAuthPolling();
  
  userName.textContent = userData.name || 'User';
  userEmail.textContent = userData.email || 'user@example.com';
  userAvatar.textContent = (userData.name || 'U').charAt(0).toUpperCase();
}

function showLoadingSection() {
  loginSection.style.display = 'none';
  summarySection.style.display = 'none';
  loadingSection.style.display = 'block';
  successSection.style.display = 'none';
  hideError();
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

    const response = await fetch(`${API_BASE_URL}/api/summarize`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: currentTab.url
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to add to Memory');
    }

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
    checkAuthentication();
  }
});

window.addEventListener('message', (event) => {
  if (event.data.type === 'MEMORY_AUTH_SUCCESS') {
    chrome.storage.local.set({
      [STORAGE_KEYS.ACCESS_TOKEN]: event.data.data.access_token,
      [STORAGE_KEYS.USER_DATA]: event.data.data.user
    }, () => {
      checkAuthentication();
    });
  }
});

let authPollingInterval = null;

function startAuthPolling() {
  if (authPollingInterval) return;
  
  authPollingInterval = setInterval(async () => {
    try {
      const result = await chrome.storage.local.get([STORAGE_KEYS.ACCESS_TOKEN, STORAGE_KEYS.USER_DATA]);
      
      if (result[STORAGE_KEYS.ACCESS_TOKEN] && result[STORAGE_KEYS.USER_DATA]) {
        checkAuthentication();
        clearInterval(authPollingInterval);
        authPollingInterval = null;
      }
    } catch (error) {
    }
  }, 2000);
}

function stopAuthPolling() {
  if (authPollingInterval) {
    clearInterval(authPollingInterval);
    authPollingInterval = null;
  }
}

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    if (changes[STORAGE_KEYS.ACCESS_TOKEN] || changes[STORAGE_KEYS.USER_DATA]) {
      checkAuthentication();
    }
  }
});
