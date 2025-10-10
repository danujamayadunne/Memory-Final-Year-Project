chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'GET_PAGE_INFO':
      getPageInfo(sendResponse);
      return true;
      
    case 'EXTRACT_CONTENT':
      extractPageContent(sendResponse);
      return true;
      
    default:
  }
});

function getPageInfo(sendResponse) {
  try {
    const pageInfo = {
      url: window.location.href,
      title: document.title,
      description: getMetaDescription(),
      favicon: getFavicon(),
      domain: window.location.hostname
    };
    
    sendResponse({
      success: true,
      data: pageInfo
    });
  } catch (error) {
    console.error('Error getting page info:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

function extractPageContent(sendResponse) {
  try {
    const scripts = document.querySelectorAll('script, style, nav, header, footer, aside');
    scripts.forEach(el => el.remove());
    
    const mainContent = document.querySelector('main') || 
                       document.querySelector('article') || 
                       document.querySelector('.content') ||
                       document.querySelector('#content') ||
                       document.body;
    
    const textContent = mainContent.innerText || mainContent.textContent || '';
    
    const cleanedText = textContent
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .trim();
    
    const limitedContent = cleanedText.substring(0, 8000);
    
    const content = {
      text: limitedContent,
      wordCount: cleanedText.split(/\s+/).length,
      charCount: cleanedText.length,
      title: document.title,
      url: window.location.href
    };
    
    sendResponse({
      success: true,
      data: content
    });
  } catch (error) {
    console.error('Error extracting content:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

function getMetaDescription() {
  const metaDescription = document.querySelector('meta[name="description"]');
  return metaDescription ? metaDescription.getAttribute('content') : '';
}

function getFavicon() {
  const favicon = document.querySelector('link[rel="icon"]') || 
                  document.querySelector('link[rel="shortcut icon"]');
  return favicon ? favicon.href : '';
}

function addMemoryIndicator() {
  if (document.getElementById('memory-extension-indicator')) {
    return;
  }
  
  const indicator = document.createElement('div');
  indicator.id = 'memory-extension-indicator';
  indicator.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #3b82f6;
    color: white;
    padding: 8px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    z-index: 10000;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    cursor: pointer;
    transition: all 0.2s;
  `;
  indicator.textContent = 'Memory Active';
  
  indicator.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'OPEN_POPUP' });
  });
  
  indicator.addEventListener('mouseenter', () => {
    indicator.style.background = '#2563eb';
    indicator.style.transform = 'scale(1.05)';
  });
  
  indicator.addEventListener('mouseleave', () => {
    indicator.style.background = '#3b82f6';
    indicator.style.transform = 'scale(1)';
  });
  
  document.body.appendChild(indicator);
  
  setTimeout(() => {
    if (indicator.parentNode) {
      indicator.style.opacity = '0';
      indicator.style.transform = 'translateX(100px)';
      setTimeout(() => {
        if (indicator.parentNode) {
          indicator.parentNode.removeChild(indicator);
        }
      }, 300);
    }
  }, 3000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', addMemoryIndicator);
} else {
  addMemoryIndicator();
}
