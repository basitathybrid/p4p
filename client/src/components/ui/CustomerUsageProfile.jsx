import { useEffect, useRef, useState } from 'react'
import config from '../../config'
import { notifyAuditLogUpdated, CUSTOMER_STATUS_UPDATED_EVENT } from '../../auditEvents'
import { StatusBadge } from './Icon'

function formatCurrency(value) {
  return `$${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function statusLabel(status) {
  return String(status || '').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function CustomerUsageProfile({ phone, role }) {
  const [profile, setProfile] = useState(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [refreshVersion, setRefreshVersion] = useState(0)
  const pageSelection = useRef({ phone, page: 1 })
  const currentPage = pageSelection.current.phone === phone ? pageSelection.current.page : 1

  useEffect(() => {
    const refresh = () => setRefreshVersion((current) => current + 1)
    window.addEventListener(CUSTOMER_STATUS_UPDATED_EVENT, refresh)
    return () => window.removeEventListener(CUSTOMER_STATUS_UPDATED_EVENT, refresh)
  }, [])

  useEffect(() => {
    if (!phone) {
      setProfile(null)
      setError('')
      return
    }

    const token = localStorage.getItem(role === 'supervisor' ? 'p4p_supervisor_token' : 'p4p_basic_token')
    const controller = new AbortController()
    const signature = `${role}:${phone}:${currentPage}`
    let eventKey = pageSelection.current.signature === signature ? pageSelection.current.eventKey : ''
    if (!eventKey) {
      eventKey = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
      pageSelection.current = { ...pageSelection.current, signature, eventKey }
    }
    setLoading(true)
    setError('')

    fetch(`${config.REST_API.Internal.CustomerProfile(phone)}?page=${currentPage}&viewId=${encodeURIComponent(eventKey)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.message || 'Unable to load customer profile usage.')
        setProfile(data)
        if (role === 'supervisor' || role === 'basic') notifyAuditLogUpdated()
      })
      .catch((loadError) => {
        if (loadError.name !== 'AbortError') setError(loadError.message || 'Unable to load customer profile usage.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [phone, role, currentPage, refreshVersion])

  if (!phone) return null

  const usage = profile?.usage || {}
  const pagination = profile?.pagination || { page: currentPage, pageCount: 1, total: 0 }

  const changePage = (nextPage) => {
    pageSelection.current = { phone, page: nextPage }
    setPage(nextPage)
  }

  return (
    <section className="internal-profile-usage" aria-label="Customer usage and transaction history">
      <div className="internal-profile-heading">
        <h4>Usage Summary</h4>
        {profile?.application?.status && (
          <StatusBadge
            text={statusLabel(profile.application.status)}
            tone={profile.application.status === 'approved' ? 'green' : profile.application.status === 'rejected' ? 'red' : 'info'}
          />
        )}
      </div>

      {error && <div className="status-banner error">{error}</div>}
      <div className="summary-grid internal-usage-grid">
        <div><span>Current Tier</span><strong>{usage.rewardTier || 'Bronze'}</strong></div>
        <div><span>Lifetime Volume</span><strong>{formatCurrency(usage.lifetimeVolume)}</strong></div>
        <div><span>Transaction Count</span><strong>{Number(usage.transactionCount || 0).toLocaleString()}</strong></div>
        <div><span>Last Activity</span><strong>{formatDate(usage.lastActivityAt)}</strong></div>
        <div><span>Buy Total</span><strong>{formatCurrency(usage.buyTotal)}</strong></div>
        <div><span>Send Total</span><strong>{formatCurrency(usage.sendTotal)}</strong></div>
        <div><span>Receive Total</span><strong>{formatCurrency(usage.receiveTotal)}</strong></div>
        <div><span>Sell Total</span><strong>{formatCurrency(usage.sellTotal)}</strong></div>
      </div>

      <div className="internal-history-heading">
        <h4>Imported Transaction History</h4>
        <span>{loading ? 'Loading...' : `${Number(pagination.total || 0).toLocaleString()} records`}</span>
      </div>
      <div className="table-scroll internal-history-scroll">
        <table className="data-table internal-history-table">
          <thead>
            <tr><th>Date / Time</th><th>Type</th><th>Amount</th><th>Status</th><th>Transaction ID</th></tr>
          </thead>
          <tbody>
            {!loading && !error && (profile?.transactions || []).length === 0 && (
              <tr><td colSpan="5">No imported transactions.</td></tr>
            )}
            {(profile?.transactions || []).map((transaction) => (
              <tr key={transaction.transactionId}>
                <td>{formatDate(transaction.transactionDate)}</td>
                <td>{statusLabel(transaction.type)}</td>
                <td>{formatCurrency(transaction.amount)}</td>
                <td>{statusLabel(transaction.status)}</td>
                <td>{transaction.transactionId}</td>
              </tr>
            ))}
            {loading && <tr><td colSpan="5">Loading transactions...</td></tr>}
          </tbody>
        </table>
      </div>
      {pagination.pageCount > 1 && (
        <div className="internal-history-pagination">
          <button type="button" onClick={() => changePage(Math.max(1, currentPage - 1))} disabled={loading || currentPage <= 1}>Previous</button>
          <span>Page {pagination.page} of {pagination.pageCount}</span>
          <button type="button" onClick={() => changePage(Math.min(pagination.pageCount, currentPage + 1))} disabled={loading || currentPage >= pagination.pageCount}>Next</button>
        </div>
      )}
    </section>
  )
}