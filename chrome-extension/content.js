window.addEventListener('message', (e) => {
  if (e.source !== window || e.data?.type !== 'MEMORY_AUTH_SUCCESS') return
  chrome.runtime.sendMessage({ type: 'AUTH_SUCCESS', data: e.data.data })
})

function showMemoryToast(message, color) {
  try {
    const existing = document.getElementById('memory-toast')
    if (existing) existing.remove()
    const toast = document.createElement('div')
    toast.id = 'memory-toast'
    toast.style.cssText = `position:fixed;top:20px;right:20px;background:${color || '#000'};color:#fff;padding:12px 20px;border-radius:12px;font-size:14px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-weight:500;z-index:2147483647;box-shadow:0 8px 24px rgba(0,0,0,0.15);-webkit-font-smoothing:antialiased`
    toast.textContent = message
    document.body.appendChild(toast)
    setTimeout(() => toast.remove(), 3500)
  } catch (_) {}
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'MEMORY_TOAST') {
    showMemoryToast(msg.message, msg.color)
    sendResponse?.({ ok: true })
  }
})
