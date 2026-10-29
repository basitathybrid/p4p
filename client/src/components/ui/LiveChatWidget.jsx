import { useEffect } from 'react'

const SCRIPT_ID = 'livechat-tracking-script'
const SCRIPT_SRC = 'https://cdn.livechatinc.com/tracking.js'

function resolveLicenseId() {
  return window.__APP_CONFIG__?.LIVECHAT_LICENSE_ID || null
}

// Mirrors the official LiveChat installation snippet: queues API calls made
// before tracking.js finishes loading (window.LiveChatWidget.on/call/get/...).
function installApiStub() {
  if (window.LiveChatWidget) return
  const api = { _q: [], _h: null, _v: '2.0' }
  const handle = (method, args) => {
    if (api._h) return api._h.apply(null, [method, ...args])
    api._q.push([method, ...args])
    return undefined
  }
  api.on = (...args) => handle('on', args)
  api.once = (...args) => handle('once', args)
  api.off = (...args) => handle('off', args)
  api.get = (...args) => {
    if (!api._h) throw new Error("[LiveChatWidget] You can't use getters before load.")
    return handle('get', args)
  }
  api.call = (...args) => handle('call', args)
  window.LiveChatWidget = api
}

export default function LiveChatWidget() {
  useEffect(() => {
    const license = resolveLicenseId()
    if (!license) return

    window.__lc = window.__lc || {}
    window.__lc.license = license
    installApiStub()

    if (!document.getElementById(SCRIPT_ID)) {
      const script = document.createElement('script')
      script.id = SCRIPT_ID
      script.async = true
      script.type = 'text/javascript'
      script.src = SCRIPT_SRC
      document.head.appendChild(script)
    }
  }, [])

  return null
}
