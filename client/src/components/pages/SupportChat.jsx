import { useCallback, useEffect, useRef, useState } from 'react'
import config from '../../config'
import { AppLayout } from '../layout/AppLayout'
import './SupportChat.css'

const MAX_FILE_SIZE = 50 * 1024 * 1024

export function SupportChatPage({ role }) {
  const isCustomer = role === 'customer'
  const [phone, setPhone] = useState(isCustomer ? 'me' : '')
  const [conversations, setConversations] = useState([])
  const [inboxMore, setInboxMore] = useState(false)
  const [messages, setMessages] = useState([])
  const [messageMore, setMessageMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [inboxLoading, setInboxLoading] = useState(!isCustomer)
  const [error, setError] = useState('')
  const [connection, setConnection] = useState('Connecting')
  const [text, setText] = useState('')
  const [file, setFile] = useState(null)
  const [sending, setSending] = useState(false)
  const [revision, setRevision] = useState(0)
  const fileInput = useRef(null)
  const messagesRef = useRef([])
  const tokenKey = role === 'customer' ? 'p4p_customer_token' : role === 'supervisor' ? 'p4p_supervisor_token' : 'p4p_basic_token'
  const token = localStorage.getItem(tokenKey)
  const base = config.REST_API.Support.Base
  const conversationUrl = `${base}/conversations/${encodeURIComponent(phone)}`

  const request = useCallback(async (url, options = {}) => {
    const response = await fetch(url, {
      ...options,
      headers: { ...options.headers, Authorization: `Bearer ${token}` },
    })
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      const error = new Error(body?.message || `Request failed (${response.status}).`)
      error.status = response.status
      throw error
    }
    return response
  }, [token])

  useEffect(() => {
    const controller = new AbortController()
    let timer
    async function connect() {
      try {
        setConnection('Connecting')
        const response = await request(`${base}/events`, { signal: controller.signal })
        if (!response.body) throw new Error('Streaming is unavailable.')
        setConnection('Connected')
        setRevision((value) => value + 1)
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let pending = ''
        while (!controller.signal.aborted) {
          const { value, done } = await reader.read()
          if (done) throw new Error('Connection closed.')
          pending += decoder.decode(value, { stream: true })
          let boundary = pending.indexOf('\n\n')
          while (boundary !== -1) {
            if (pending.slice(0, boundary).includes('event: change')) setRevision((current) => current + 1)
            pending = pending.slice(boundary + 2)
            boundary = pending.indexOf('\n\n')
          }
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          if (error.status === 401 || error.status === 403) {
            setConnection('Session expired - sign in again')
          } else {
            setConnection('Disconnected - reconnecting')
            timer = setTimeout(connect, 3000)
          }
        }
      }
    }
    connect()
    return () => { controller.abort(); clearTimeout(timer) }
  }, [base, request])

  useEffect(() => {
    const timer = setInterval(() => setRevision((value) => value + 1), 60000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (isCustomer) return undefined
    const controller = new AbortController()
    setInboxLoading(true)
    request(`${base}/conversations`, { signal: controller.signal })
      .then((response) => response.json())
      .then((data) => { setConversations(data.conversations); setInboxMore(data.hasMore); setError('') })
      .catch((err) => { if (!controller.signal.aborted) setError(err.message) })
      .finally(() => { if (!controller.signal.aborted) setInboxLoading(false) })
    return () => controller.abort()
  }, [base, isCustomer, request, revision])

  useEffect(() => {
    messagesRef.current = []
    setMessages([])
    setMessageMore(false)
    if (!phone) setLoading(false)
  }, [phone])

  useEffect(() => {
    if (!phone) return undefined
    const controller = new AbortController()
    setLoading(true)
    async function refresh() {
      const previous = messagesRef.current
      const lastId = previous.length ? previous[previous.length - 1].id : null
      let before = ''
      let fresh = []
      let hasMore = false
      do {
        const data = await (await request(`${conversationUrl}/messages${before ? `?before=${before}` : ''}`, { signal: controller.signal })).json()
        fresh = [...data.messages, ...fresh]
        hasMore = data.hasMore
        before = data.messages.length ? data.messages[0].id : ''
      } while (lastId && hasMore && before && before > lastId)
      if (controller.signal.aborted) return
      const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
      const combined = new Map([...previous, ...fresh].filter((item) => new Date(item.createdAt).getTime() > cutoff).map((item) => [item.id, item]))
      const result = [...combined.values()].sort((a, b) => a.id - b.id)
      messagesRef.current = result
      setMessages(result)
      if (!previous.length) setMessageMore(hasMore)
    }
    refresh()
      .then(() => {
        setError('')
      })
      .catch((err) => { if (!controller.signal.aborted) setError(err.message) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [conversationUrl, phone, request, revision])

  useEffect(() => {
    if (!messages.length) return undefined
    const expiresAt = new Date(messages[0].createdAt).getTime() + 30 * 24 * 60 * 60 * 1000
    if (!Number.isFinite(expiresAt)) return undefined
    const timer = setTimeout(() => {
      messagesRef.current = messagesRef.current.filter((item) => new Date(item.createdAt).getTime() + 30 * 24 * 60 * 60 * 1000 > Date.now())
      setMessages(messagesRef.current)
      setRevision((value) => value + 1)
    }, Math.max(0, Math.min(expiresAt - Date.now(), 2147483647)))
    return () => clearTimeout(timer)
  }, [messages])

  async function loadMoreInbox() {
    try {
      const data = await (await request(`${base}/conversations?before=${conversations[conversations.length - 1].lastMessageId}`)).json()
      setConversations((old) => [...old, ...data.conversations])
      setInboxMore(data.hasMore)
      setError('')
    } catch (err) { setError(err.message) }
  }

  async function loadOlder() {
    try {
      const data = await (await request(`${conversationUrl}/messages?before=${messages[0].id}`)).json()
      messagesRef.current = [...data.messages, ...messagesRef.current]
      setMessages(messagesRef.current)
      setMessageMore(data.hasMore)
      setError('')
    } catch (err) { setError(err.message) }
  }

  async function send(event) {
    event.preventDefault()
    if (sending || (!text.trim() && !file)) return
    if (file && file.size > MAX_FILE_SIZE) { setError('Attachments must be 50 MB or smaller.'); return }
    setSending(true)
    setError('')
    try {
      if (text.trim()) {
        await request(`${conversationUrl}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text }) })
        setText('')
      }
      if (file) {
        await request(`${conversationUrl}/attachments`, { method: 'POST', headers: { 'Content-Type': file.type || 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name) }, body: file })
        setFile(null)
        if (fileInput.current) fileInput.current.value = ''
      }
      setRevision((value) => value + 1)
    } catch (err) { setError(err.message) } finally { setSending(false) }
  }

  async function download(message) {
    try {
      const response = await request(`${conversationUrl}/attachments/${message.id}`)
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = url
      link.download = message.attachmentName
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setError('')
    } catch (err) { setError(err.message) }
  }

  return (
    <AppLayout route={role}>
      <div className="page-header compact"><h1>{isCustomer ? 'Chat With Us' : 'Support Chat'}</h1></div>
      <section className="support-chat card-light">
        <p role="status">Live updates: {connection}. Messages and attachments are kept for 30 days.</p>
        {error && <div className="status-banner error" role="alert">{error}</div>}
        <div className="support-chat-layout">
          {!isCustomer && <aside aria-label="Customer conversations" className="support-inbox">
            <h2>Conversations</h2>
            {inboxLoading && <p role="status">Loading conversations...</p>}
            {!inboxLoading && !conversations.length && !error && <p>No customer conversations yet.</p>}
            {conversations.map((item) => <button key={item.phone} type="button" className={phone === item.phone ? 'selected' : ''} onClick={() => setPhone(item.phone)}>{item.name}<small>{item.phone}</small></button>)}
            {inboxMore && <button type="button" onClick={loadMoreInbox}>Load more conversations</button>}
          </aside>}
          <div className="support-thread">
            {!phone ? <p>Select a conversation to reply. Customers start conversations.</p> : <>
              {loading && <p role="status">Loading messages...</p>}
              {!loading && !messages.length && !error && <p>No messages yet. Send a message to start the conversation.</p>}
              {messageMore && messages.length > 0 && <button type="button" onClick={loadOlder}>Load older messages</button>}
              <div className="support-messages" aria-label="Messages">
                {messages.map((message) => <article key={message.id} className={`support-message ${message.senderRole === role ? 'own' : ''}`}>
                  <strong>{message.senderName} ({message.senderRole})</strong>
                  <time>{new Date(message.createdAt).toLocaleString()}</time>
                  {message.body && <p>{message.body}</p>}
                  {message.attachmentName && <button type="button" onClick={() => download(message)}>Download {message.attachmentName}</button>}
                </article>)}
              </div>
              <form className="support-compose" onSubmit={send}>
                <label htmlFor="support-message">Message</label>
                <textarea id="support-message" value={text} onChange={(event) => setText(event.target.value)} maxLength={4000} rows={3} />
                <label htmlFor="support-file">Attachment (JPEG, PNG, GIF, WebP or PDF, up to 50 MB)</label>
                <input ref={fileInput} id="support-file" type="file" accept="image/jpeg,image/png,image/gif,image/webp,application/pdf" onChange={(event) => setFile(event.target.files[0] || null)} />
                <button type="submit" disabled={sending || (!text.trim() && !file)}>{sending ? 'Sending...' : 'Send'}</button>
              </form>
            </>}
          </div>
        </div>
      </section>
    </AppLayout>
  )
}
