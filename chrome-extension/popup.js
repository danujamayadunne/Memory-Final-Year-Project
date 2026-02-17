const API_BASE = MEMORY_API_BASE
const STORAGE_KEYS = MEMORY_STORAGE_KEYS

const $ = id => document.getElementById(id)
const sections = {
  login: $('loginSection'),
  summary: $('summarySection'),
  loading: $('loadingSection'),
  success: $('successSection')
}

let currentTab = null
let isAuthenticated = false

async function init() {
  show('loading')
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  currentTab = tab
  if (tab?.url) $('siteUrl').textContent = tab.url
  $('loginBtn').onclick = () => { chrome.tabs.create({ url: `${API_BASE}/auth/login?extension=true` }); window.close() }
  $('signupBtn').onclick = () => { chrome.tabs.create({ url: `${API_BASE}/auth/signup?extension=true` }); window.close() }
  $('addToMemoryBtn').onclick = addToMemory
  $('logoutBtn').onclick = logout
  $('viewMemoryBtn').onclick = () => { chrome.tabs.create({ url: `${API_BASE}/dashboard` }); window.close() }
  const k = $('shortcutKeys')
  if (k) k.textContent = navigator.platform.includes('Mac') ? '⌘⇧K' : 'Ctrl+Shift+K'
  await checkAuth()
  const found = await checkTabsForAuth()
  if (found) await checkAuth()
}

function show(name) {
  Object.keys(sections).forEach(k => sections[k]?.classList.toggle('active', k === name))
  if (name !== 'loading') $('errorMessage').classList.remove('show')
}

function showError(msg) {
  const el = $('errorMessage')
  el.textContent = msg
  el.classList.add('show')
}

async function checkAuth() {
  const { [STORAGE_KEYS.ACCESS_TOKEN]: token, [STORAGE_KEYS.USER_DATA]: user } = await chrome.storage.local.get([STORAGE_KEYS.ACCESS_TOKEN, STORAGE_KEYS.USER_DATA])
  if (token && user) {
    const ok = await verifyToken(token)
    if (ok) {
      isAuthenticated = true
      stopPolling()
      $('userName').textContent = user.name || 'User'
      $('userEmail').textContent = user.email || ''
      $('userAvatar').textContent = (user.name || 'U').charAt(0).toUpperCase()
      show('summary')
      return
    }
  }
  show('login')
  startPolling()
}

async function verifyToken(token) {
  try {
    const r = await fetch(`${API_BASE}/api/auth/verify`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    return r.ok
  } catch {
    return true
  }
}

async function checkTabsForAuth() {
  const tabs = (await chrome.tabs.query({})).filter(t => t.url?.includes('localhost:3000') || t.url?.includes('127.0.0.1:3000')).slice(0, 5)
  for (const tab of tabs) {
    try {
      const [r] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => localStorage.getItem('memory_extension_auth') })
      if (!r?.result) continue
      const auth = JSON.parse(r.result)
      await chrome.storage.local.set({
        [STORAGE_KEYS.ACCESS_TOKEN]: auth.access_token,
        [STORAGE_KEYS.USER_DATA]: auth.user,
        [STORAGE_KEYS.AUTH_TIMESTAMP]: Date.now()
      })
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => localStorage.removeItem('memory_extension_auth') })
      return true
    } catch (_) {}
  }
  return false
}

let pollId = null
function startPolling() {
  if (pollId) return
  let n = 0
  pollId = setInterval(async () => {
    if (++n > 60) { clearInterval(pollId); pollId = null; return }
    const found = await checkTabsForAuth()
    if (found) { clearInterval(pollId); pollId = null; await checkAuth() }
  }, 500)
}

function stopPolling() {
  if (pollId) { clearInterval(pollId); pollId = null }
}

async function addToMemory() {
  if (!currentTab?.url) { showError('No page'); return }
  show('loading')
  $('loadingText').textContent = 'Adding...'
  const { [STORAGE_KEYS.ACCESS_TOKEN]: token } = await chrome.storage.local.get(STORAGE_KEYS.ACCESS_TOKEN)
  if (!token) { showError('Sign in first'); show('login'); return }
  try {
    const r = await fetch(`${API_BASE}/api/ai/text`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: currentTab.url, format: 'bullets' })
    })
    const data = await r.json()
    if (!r.ok) throw new Error(data.error || 'Failed')
    await chrome.storage.local.set({ [STORAGE_KEYS.AUTH_TIMESTAMP]: Date.now() })
    show('success')
  } catch (e) {
    showError(e.message || 'Failed')
    show('summary')
  }
}

async function logout() {
  await chrome.storage.local.clear()
  isAuthenticated = false
  stopPolling()
  show('login')
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'AUTH_SUCCESS') checkAuth()
})

chrome.storage.onChanged.addListener((changes, ns) => {
  if (ns === 'local' && (changes[STORAGE_KEYS.ACCESS_TOKEN] || changes[STORAGE_KEYS.USER_DATA]) && !isAuthenticated) {
    setTimeout(checkAuth, 100)
  }
})

document.addEventListener('DOMContentLoaded', init)
window.addEventListener('beforeunload', stopPolling)
