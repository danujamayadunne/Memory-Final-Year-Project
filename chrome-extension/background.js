// Background script for Memory Chrome Extension

// Listen for extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    
    // Open welcome page
    chrome.tabs.create({
      url: chrome.runtime.getURL('welcome.html')
    });
  }
});

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'GET_TAB_INFO':
      getCurrentTabInfo(sendResponse);
      return true; // Keep message channel open for async response
      
    case 'AUTH_SUCCESS':
      handleAuthSuccess(message.data);
      break;
      
    case 'ADD_TO_MEMORY':
      addToMemory(message.url, sendResponse);
      return true; // Keep message channel open for async response
      
    case 'MEMORY_AUTH_SUCCESS':
      handleAuthSuccess(message.data);
      break;
      
    default:
  }
});

async function getCurrentTabInfo(sendResponse) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    sendResponse({
      success: true,
      data: {
        url: tab.url,
        title: tab.title,
        favicon: tab.favIconUrl
      }
    });
  } catch (error) {
    console.error('Error getting tab info:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

async function handleAuthSuccess(userData) {
  try {
    // Store user data in local storage
    await chrome.storage.local.set({
      'memory_access_token': userData.access_token,
      'memory_user_data': userData.user
    });
    
    // Notify popup if it's open
    chrome.runtime.sendMessage({
      type: 'AUTH_SUCCESS',
      data: userData
    });
    
  } catch (error) {
    console.error('Error handling auth success:', error);
  }
}

async function addToMemory(url, sendResponse) {
  try {
    // Get stored auth token
    const result = await chrome.storage.local.get(['memory_access_token']);
    const token = result.memory_access_token;
    
    if (!token) {
      sendResponse({
        success: false,
        error: 'Not authenticated'
      });
      return;
    }
    
    // Make API call to add URL to Memory
    const response = await fetch('http://localhost:3000/api/summarize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to add to Memory');
    }
    
    sendResponse({
      success: true,
      data: data
    });
    
  } catch (error) {
    console.error('Error adding to Memory:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

// Listen for tab updates to update badge
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    updateBadge(tab.url);
  }
});

async function updateBadge(url) {
  try {
    // Check if user is authenticated
    const result = await chrome.storage.local.get(['memory_access_token']);
    
    if (result.memory_access_token) {
      // Set badge to show extension is active
      chrome.action.setBadgeText({ text: 'M' });
      chrome.action.setBadgeBackgroundColor({ color: '#3b82f6' });
    } else {
      // Clear badge if not authenticated
      chrome.action.setBadgeText({ text: '' });
    }
  } catch (error) {
    console.error('Error updating badge:', error);
  }
}
