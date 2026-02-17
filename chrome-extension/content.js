window.addEventListener('message', (e) => {
  if (e.source !== window || e.data?.type !== 'MEMORY_AUTH_SUCCESS') return
  chrome.runtime.sendMessage({ type: 'AUTH_SUCCESS', data: e.data.data })
})
