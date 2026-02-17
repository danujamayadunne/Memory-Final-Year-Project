importScripts('config.js')

const API_BASE = MEMORY_API_BASE
const STORAGE_KEYS = MEMORY_STORAGE_KEYS

function showToast(message, color) {
  return function () {
    const el = document.getElementById('memory-toast')
    if (el) el.remove()
    const toast = document.createElement('div')
    toast.id = 'memory-toast'
    toast.style.cssText = `position:fixed;top:20px;right:20px;background:${color};color:#fff;padding:12px 20px;border-radius:12px;font-size:14px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-weight:500;z-index:999999;box-shadow:0 8px 24px rgba(0,0,0,0.15);-webkit-font-smoothing:antialiased`
    toast.textContent = message
    document.body.appendChild(toast)
    setTimeout(() => toast.remove(), 3500)
  }
}

function createContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'saveImageToMemory',
      title: 'Save image to Memory',
      contexts: ['image']
    })
  })
}

function handleAuthSuccess(data) {
  chrome.storage.local.set({
    [STORAGE_KEYS.ACCESS_TOKEN]: data.access_token,
    [STORAGE_KEYS.USER_DATA]: data.user,
    [STORAGE_KEYS.AUTH_TIMESTAMP]: Date.now()
  })
  chrome.runtime.sendMessage({ type: 'AUTH_SUCCESS', data }).catch(() => {})
}

async function addPageToMemory(tab) {
  const { [STORAGE_KEYS.ACCESS_TOKEN]: token } = await chrome.storage.local.get(STORAGE_KEYS.ACCESS_TOKEN)
  if (!token) {
    chrome.scripting.executeScript({ target: { tabId: tab.id }, func: showToast, args: ['Sign in first', '#000'] }).catch(() => {})
    return
  }
  chrome.action.setBadgeText({ text: '...', tabId: tab.id })
  chrome.action.setBadgeBackgroundColor({ color: '#000', tabId: tab.id })
  chrome.scripting.executeScript({ target: { tabId: tab.id }, func: showToast, args: ['Adding...', '#000'] }).catch(() => {})
  try {
    const res = await fetch(`${API_BASE}/api/ai/text`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: tab.url, format: 'bullets' })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed')
    await chrome.storage.local.set({ [STORAGE_KEYS.AUTH_TIMESTAMP]: Date.now() })
    chrome.action.setBadgeText({ text: '✓', tabId: tab.id })
    chrome.action.setBadgeBackgroundColor({ color: '#000', tabId: tab.id })
    chrome.scripting.executeScript({ target: { tabId: tab.id }, func: showToast, args: ['Added to Memory', '#000'] }).catch(() => {})
    setTimeout(() => chrome.action.setBadgeText({ text: '', tabId: tab.id }), 2500)
  } catch (err) {
    chrome.action.setBadgeText({ text: '!', tabId: tab.id })
    chrome.action.setBadgeBackgroundColor({ color: '#000', tabId: tab.id })
    chrome.scripting.executeScript({ target: { tabId: tab.id }, func: showToast, args: [err.message || 'Failed', '#000'] }).catch(() => {})
    setTimeout(() => chrome.action.setBadgeText({ text: '', tabId: tab.id }), 2500)
  }
}

async function saveImageToMemory(imageUrl, pageUrl, tabId) {
  const { [STORAGE_KEYS.ACCESS_TOKEN]: token } = await chrome.storage.local.get(STORAGE_KEYS.ACCESS_TOKEN)
  if (!token) {
    chrome.scripting.executeScript({ target: { tabId }, func: showToast, args: ['Sign in first', '#000'] }).catch(() => {})
    return
  }
    chrome.scripting.executeScript({ target: { tabId }, func: showToast, args: ['Saving image...', '#000'] }).catch(() => {})
  try {
    const res = await fetch(`${API_BASE}/api/ai/images`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl, sourceUrl: pageUrl || null })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed')
    chrome.scripting.executeScript({ target: { tabId }, func: showToast, args: ['Image saved', '#000'] }).catch(() => {})
  } catch (err) {
    chrome.scripting.executeScript({ target: { tabId }, func: showToast, args: [err.message || 'Failed', '#000'] }).catch(() => {})
  }
}

async function readAuthFromTab(tabId) {
  try {
    const [r] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => localStorage.getItem('memory_extension_auth')
    })
    if (!r?.result) return
    const auth = JSON.parse(r.result)
    handleAuthSuccess(auth)
    chrome.scripting.executeScript({
      target: { tabId },
      func: () => localStorage.removeItem('memory_extension_auth')
    }).catch(() => {})
  } catch (_) {}
}

async function updateBadge() {
  const { [STORAGE_KEYS.ACCESS_TOKEN]: token } = await chrome.storage.local.get(STORAGE_KEYS.ACCESS_TOKEN)
  chrome.action.setBadgeText({ text: token ? 'M' : '' })
  if (token) chrome.action.setBadgeBackgroundColor({ color: '#000' })
}

createContextMenu()
chrome.runtime.onStartup.addListener(createContextMenu)
chrome.runtime.onInstalled.addListener(createContextMenu)

chrome.commands.onCommand.addListener(async (cmd) => {
  if (cmd !== 'add-to-memory') return
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.url?.startsWith('http')) return
  addPageToMemory(tab)
})

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'saveImageToMemory' && tab) {
    saveImageToMemory(info.srcUrl, info.pageUrl || tab.url, tab.id)
  }
})

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'AUTH_SUCCESS') {
    handleAuthSuccess(msg.data)
    sendResponse?.()
  } else if (msg.type === 'GET_TAB_INFO') {
    chrome.tabs.query({ active: true, currentWindow: true }).then(([t]) => {
      sendResponse(t ? { success: true, url: t.url, title: t.title } : { success: false })
    })
    return true
  }
})

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab?.url) {
    updateBadge()
    if (/\/auth\/(login|signup|callback)/.test(tab.url)) readAuthFromTab(tabId)
  }
})

chrome.tabs.onRemoved.addListener(updateBadge)
