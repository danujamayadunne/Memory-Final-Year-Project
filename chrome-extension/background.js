importScripts('config.js')

const API_BASE = MEMORY_API_BASE
const STORAGE_KEYS = MEMORY_STORAGE_KEYS

const SUMMARIZE_TIMEOUT_MS = 90000
const IMAGE_TIMEOUT_MS = 60000
const AUTH_VERIFY_TIMEOUT_MS = 8000

function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer))
}

function fallbackToastViaScripting(tabId, message, color) {
  chrome.scripting.executeScript({
    target: { tabId },
    func: (msg, c) => {
      const existing = document.getElementById('memory-toast')
      if (existing) existing.remove()
      const toast = document.createElement('div')
      toast.id = 'memory-toast'
      toast.style.cssText = `position:fixed;top:20px;right:20px;background:${c};color:#fff;padding:12px 20px;border-radius:12px;font-size:14px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-weight:500;z-index:2147483647;box-shadow:0 8px 24px rgba(0,0,0,0.15);-webkit-font-smoothing:antialiased`
      toast.textContent = msg
      document.body.appendChild(toast)
      setTimeout(() => toast.remove(), 3500)
    },
    args: [message, color || '#000']
  }).catch(() => {})
}

function toast(tabId, message, color = '#000') {
  if (typeof tabId !== 'number') return
  chrome.tabs.sendMessage(tabId, { type: 'MEMORY_TOAST', message, color }, () => {
    if (chrome.runtime.lastError) {
      fallbackToastViaScripting(tabId, message, color)
    }
  })
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

async function getToken() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.ACCESS_TOKEN)
  return result[STORAGE_KEYS.ACCESS_TOKEN]
}

async function addPageToMemory(tab) {
  const token = await getToken()
  if (!token) {
    toast(tab.id, 'Sign in first')
    return
  }
  chrome.action.setBadgeText({ text: '...', tabId: tab.id })
  chrome.action.setBadgeBackgroundColor({ color: '#000', tabId: tab.id })
  toast(tab.id, 'Adding...')
  try {
    const res = await fetchWithTimeout(`${API_BASE}/api/ai/text`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: tab.url, format: 'bullets' })
    }, SUMMARIZE_TIMEOUT_MS)
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed')
    chrome.storage.local.set({ [STORAGE_KEYS.AUTH_TIMESTAMP]: Date.now() })
    chrome.action.setBadgeText({ text: '✓', tabId: tab.id })
    chrome.action.setBadgeBackgroundColor({ color: '#000', tabId: tab.id })
    toast(tab.id, 'Added to Memory')
    setTimeout(() => chrome.action.setBadgeText({ text: '', tabId: tab.id }), 2500)
  } catch (err) {
    chrome.action.setBadgeText({ text: '!', tabId: tab.id })
    chrome.action.setBadgeBackgroundColor({ color: '#000', tabId: tab.id })
    const msg = err?.name === 'AbortError' ? 'Timed out' : (err?.message || 'Failed')
    toast(tab.id, msg)
    setTimeout(() => chrome.action.setBadgeText({ text: '', tabId: tab.id }), 2500)
  }
}

async function saveImageToMemory(imageUrl, pageUrl, tabId) {
  const token = await getToken()
  if (!token) {
    toast(tabId, 'Sign in first')
    return
  }
  toast(tabId, 'Saving image...')
  try {
    const res = await fetchWithTimeout(`${API_BASE}/api/ai/images`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl, sourceUrl: pageUrl || null })
    }, IMAGE_TIMEOUT_MS)
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed')
    toast(tabId, 'Image saved')
  } catch (err) {
    const msg = err?.name === 'AbortError' ? 'Timed out' : (err?.message || 'Failed')
    toast(tabId, msg)
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
  const token = await getToken()
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
    if (/\/auth\/(login|signup|callback)|\/signin|\/signup/.test(tab.url)) {
      readAuthFromTab(tabId)
    }
  }
})

chrome.tabs.onRemoved.addListener(updateBadge)
