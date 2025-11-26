function showPageIndicator(message, color) {
  const existing = document.getElementById('memory-extension-toast');
  if (existing) {
    existing.remove();
  }

  const indicator = document.createElement('div');
  indicator.id = 'memory-extension-toast';
  indicator.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${color};
    color: white;
    padding: 12px 20px;
    border-radius: 90px;
    font-size: 14px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-weight: 500;
    z-index: 999999;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    animation: slideIn 0.3s ease-out;
    max-width: 300px;
    word-wrap: break-word;
  `;

  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    @keyframes slideOut {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(400px);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);

  indicator.textContent = message;
  document.body.appendChild(indicator);

  setTimeout(() => {
    indicator.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => {
      if (indicator.parentNode) {
        indicator.remove();
      }
    }, 300);
  }, 4000);
}

function createContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'saveImageToMemory',
      title: 'Save image to Memory',
      contexts: ['image']
    });
  });
}

createContextMenu();

chrome.runtime.onStartup.addListener(() => {
  createContextMenu();
});

chrome.runtime.onInstalled.addListener((details) => {
  createContextMenu();
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'add-to-memory') {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab || !tab.url) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: showPageIndicator,
            args: ['Unable to get current page information', '#ef4444']
          });
        } catch (e) {
        }
        return;
      }

      if (!tab.url.startsWith('http://') && !tab.url.startsWith('https://')) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: showPageIndicator,
            args: ['Cannot add this page to Memory', '#ef4444']
          });
        } catch (e) {
        }
        return;
      }

      const result = await chrome.storage.local.get(['memory_access_token']);
      const token = result.memory_access_token;

      if (!token) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: showPageIndicator,
            args: ['Please sign in to add pages to Memory', '#ef4444']
          });
        } catch (e) {
        }
        return;
      }

      chrome.action.setBadgeText({ text: '...', tabId: tab.id });
      chrome.action.setBadgeBackgroundColor({ color: '#3b82f6', tabId: tab.id });

      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: showPageIndicator,
          args: ['Adding to Memory...', '#3b82f6']
        });
      } catch (e) {
      }

      const response = await fetch('http://localhost:3000/api/ai/text', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: tab.url,
          format: 'bullets'
        })
      });

      const data = await response.json();

      if (response.ok) {
        await chrome.storage.local.set({
          'memory_auth_timestamp': Date.now()
        });

        chrome.action.setBadgeText({ text: '✓', tabId: tab.id });
        chrome.action.setBadgeBackgroundColor({ color: '#10b981', tabId: tab.id });

        setTimeout(() => {
          chrome.action.setBadgeText({ text: '', tabId: tab.id });
        }, 3000);

        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: showPageIndicator,
            args: ['✓ Added to Memory!', '#10b981']
          });
        } catch (e) {
        }
      } else {
        throw new Error(data.error || 'Failed to add to Memory');
      }
    } catch (error) {
      console.error('Error adding to Memory via shortcut:', error);

      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
          chrome.action.setBadgeText({ text: '!', tabId: tab.id });
          chrome.action.setBadgeBackgroundColor({ color: '#ef4444', tabId: tab.id });

          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: showPageIndicator,
            args: ['Error: ' + (error.message || 'Failed to add to Memory'), '#ef4444']
          });

          setTimeout(() => {
            chrome.action.setBadgeText({ text: '', tabId: tab.id });
          }, 3000);
        }
      } catch (e) {
      }
    }
  }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'saveImageToMemory' && tab) {
    const imageUrl = info.srcUrl;
    const pageUrl = info.pageUrl || tab.url;

    if (!imageUrl) {
      return;
    }

    const result = await chrome.storage.local.get(['memory_access_token']);
    const token = result.memory_access_token;

    if (!token) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: showPageIndicator,
          args: ['Please sign in to save images', '#ef4444']
        });
      } catch (e) {
      }
      return;
    }

    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: showPageIndicator,
        args: ['Saving image to Memory...', '#3b82f6']
      });
    } catch (e) {
    }

    try {
      const response = await fetch('http://localhost:3000/api/ai/images', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          imageUrl,
          sourceUrl: pageUrl || null
        })
      });

      const data = await response.json();

      if (response.ok) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: showPageIndicator,
            args: ['✓ Image saved to Memory!', '#10b981']
          });
        } catch (e) {
        }
      } else {
        throw new Error(data.error || 'Failed to save image');
      }
    } catch (error) {
      console.error('Error saving image to Memory:', error);
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: showPageIndicator,
          args: ['Error: ' + (error.message || 'Failed to save image'), '#ef4444']
        });
      } catch (e) {
      }
    }
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'GET_TAB_INFO':
      getCurrentTabInfo(sendResponse);
      return true;
      
    case 'AUTH_SUCCESS':
      handleAuthSuccess(message.data);
      break;
      
    case 'ADD_TO_MEMORY':
      addToMemory(message.url, sendResponse);
      return true;
      
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
    await chrome.storage.local.set({
      'memory_access_token': userData.access_token,
      'memory_user_data': userData.user,
      'memory_auth_timestamp': Date.now()
    });
    
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
    const result = await chrome.storage.local.get(['memory_access_token']);
    const token = result.memory_access_token;
    
    if (!token) {
      sendResponse({
        success: false,
        error: 'Not authenticated'
      });
      return;
    }
    
    const response = await fetch('http://localhost:3000/api/ai/text', {
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

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    updateBadge(tab.url);

    if (tab.url && (tab.url.includes('/auth/login') || tab.url.includes('/auth/callback') || tab.url.includes('/auth/signup'))) {
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
            'memory_access_token': authData.access_token,
            'memory_user_data': authData.user,
            'memory_auth_timestamp': Date.now()
          });

          chrome.runtime.sendMessage({
            type: 'AUTH_SUCCESS',
            data: authData
          });
        }
      } catch (error) {
      }
    }
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  setTimeout(async () => {
    try {

      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        if (tab.url && (tab.url.startsWith('http://localhost:3000') || tab.url.startsWith('http://127.0.0.1:3000'))) {
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
                'memory_access_token': authData.access_token,
                'memory_user_data': authData.user,
                'memory_auth_timestamp': Date.now()
              });

              chrome.runtime.sendMessage({
                type: 'AUTH_SUCCESS',
                data: authData
              });

              await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                  localStorage.removeItem('memory_extension_auth');
                }
              });

              break;
            }
          } catch (error) {
            continue;
          }
        }
      }
    } catch (error) {
    }
  }, 500);
});

async function updateBadge(url) {
  try {
    const result = await chrome.storage.local.get(['memory_access_token']);
    
    if (result.memory_access_token) {
      chrome.action.setBadgeText({ text: 'M' });
      chrome.action.setBadgeBackgroundColor({ color: '#3b82f6' });
    } else {
      chrome.action.setBadgeText({ text: '' });
    }
  } catch (error) {
    console.error('Error updating badge:', error);
  }
}
