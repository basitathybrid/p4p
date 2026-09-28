import { useEffect, useState } from 'react'
import config from '../../config'
import { AUDIT_LOG_UPDATED_EVENT } from '../../auditEvents'

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : '—'
}

function formatAction(action) {
  return String(action || '').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatDetails(value) {
  let details = value
  if (typeof details === 'string') {
    try {
      details = JSON.parse(details)
    } catch {
      return details
    }
  }
  if (!details || typeof details !== 'object') return '—'
  if (details.changes) return `Edited: ${Object.keys(details.changes).join(', ')}`
  if (details.newTier) return `${details.previousTier || 'No tier'} to ${details.newTier} (${String(details.reason || '').replaceAll('_', ' ')})`
  if (details.recordCount !== undefined) return `${details.recordCount} records exported as ${details.format || 'CSV'}`
  if (details.imported !== undefined) return `${details.imported} imported, ${details.duplicates || 0} duplicates, ${details.unmatched || 0} unmatched`
  if (details.decision) return `Decision: ${formatAction(details.decision)}`
  if (details.page) return `Profile page ${details.page} viewed`
  if (details.thresholds) return 'Tier thresholds updated'
  return Object.keys(details).length ? JSON.stringify(details) : '—'
}

export function SupervisorAuditLog() {
  const [logs, setLogs] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pageCount: 1, total: 0 })
  const [page, setPage] = useState(1)
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const refreshAuditLog = () => {
      setPage(1)
      setRefreshVersion((current) => current + 1)
    }
    window.addEventListener(AUDIT_LOG_UPDATED_EVENT, refreshAuditLog)
    return () => window.removeEventListener(AUDIT_LOG_UPDATED_EVENT, refreshAuditLog)
  }, [])

  useEffect(() => {
    const token = localStorage.getItem('p4p_supervisor_token')
    const controller = new AbortController()
    setLoading(true)
    fetch(`${config.REST_API.Supervisor.AuditLogs}?page=${page}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.message || 'Unable to load audit logs.')
        setLogs(data.logs || [])
        setPagination(data.pagination || { page: 1, pageCount: 1, total: 0 })
        setError('')
      })
      .catch((loadError) => {
        if (loadError.name !== 'AbortError') setError(loadError.message || 'Unable to load audit logs.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [page, refreshVersion])

  return (
    <section className="supervisor-audit-section" aria-labelledby="supervisor-audit-title">
      <div className="supervisor-audit-panel card-light">
        <div className="supervisor-audit-heading">
          <div>
            <span className="detail-meta">Security &amp; accountability</span>
            <h3 id="supervisor-audit-title">Internal Audit Log</h3>
          </div>
          <span className="secondary-badge">{loading ? 'Loading' : `${pagination.total} events`}</span>
        </div>
        {error && <div className="status-banner error" role="alert">{error}</div>}
        <div className="table-scroll supervisor-audit-scroll">
          <table className="data-table supervisor-audit-table">
            <thead><tr><th>Date / Time</th><th>Internal User</th><th>Role</th><th>Action</th><th>Customer / Target</th><th>Details</th></tr></thead>
            <tbody>
              {!loading && !error && logs.length === 0 && <tr><td colSpan="6">No audit events have been recorded.</td></tr>}
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>{formatDate(log.createdAt)}</td>
                  <td>{log.actorName}</td>
                  <td>{formatAction(log.actorRole)}</td>
                  <td>{formatAction(log.action)}</td>
                  <td>{log.targetId || formatAction(log.targetType)}</td>
                  <td className="supervisor-audit-details">{formatDetails(log.details)}</td>
                </tr>
              ))}
              {loading && <tr><td colSpan="6">Loading audit events...</td></tr>}
            </tbody>
          </table>
        </div>
        {pagination.pageCount > 1 && (
          <div className="supervisor-audit-pagination">
            <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={loading || page <= 1}>Previous</button>
            <span>Page {pagination.page} of {pagination.pageCount}</span>
            <button type="button" onClick={() => setPage((current) => Math.min(pagination.pageCount, current + 1))} disabled={loading || page >= pagination.pageCount}>Next</button>
          </div>
        )}
      </div>
    </section>
  )
}