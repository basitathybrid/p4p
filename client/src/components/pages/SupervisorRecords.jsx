import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import config from '../../config'
import { AppLayout } from '../layout/AppLayout'
import { SupervisorAuditLog } from '../ui/SupervisorAuditLog'

function supervisorHeaders() {
  const token = localStorage.getItem('p4p_supervisor_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export function SupervisorAuditPage() {
  return (
    <AppLayout route="supervisor">
      <div className="page-header compact"><h1>Audit Log</h1></div>
      <SupervisorAuditLog />
    </AppLayout>
  )
}

export function SupervisorTransactionsPage() {
  const [transactions, setTransactions] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pageCount: 1, total: 0 })
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    fetch(`${config.REST_API.Supervisor.Transactions}?page=${page}`, {
      headers: supervisorHeaders(), signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.message || 'Unable to load transactions.')
        setTransactions(data.transactions)
        setPagination(data.pagination)
      })
      .catch((loadError) => {
        if (!controller.signal.aborted) setError(loadError.message || 'Unable to load transactions.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [page])

  return (
    <AppLayout route="supervisor">
      <div className="page-header compact"><h1>Recent Transactions</h1></div>
      <section className="supervisor-audit-panel card-light" aria-label="Recent transactions">
        <div className="supervisor-audit-heading"><h3>Transaction records</h3><span className="secondary-badge">{loading ? 'Loading' : `${pagination.total} transactions`}</span></div>
        {error && <div className="status-banner error" role="alert">{error}</div>}
        <div className="table-scroll supervisor-audit-scroll">
          <table className="data-table">
            <thead><tr><th>Player / Account</th><th>Transaction ID</th><th>Type</th><th>Amount</th><th>Status</th><th>Date / Time</th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan="6">Loading transactions...</td></tr>}
              {!loading && !error && transactions.length === 0 && <tr><td colSpan="6">No transactions have been recorded.</td></tr>}
              {!loading && !error && transactions.map((transaction) => (
                <tr key={transaction.transactionId}>
                  <td>{transaction.playerName || 'Unknown player'}<br /><small>{transaction.phone}</small></td>
                  <td>{transaction.transactionId}</td>
                  <td>{transaction.type}</td>
                  <td>{Number(transaction.amount).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</td>
                  <td>{transaction.status}</td>
                  <td>{transaction.transactionDate ? new Date(transaction.transactionDate).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pagination.pageCount > 1 && (
          <div className="supervisor-audit-pagination">
            <button type="button" onClick={() => setPage(pagination.page - 1)} disabled={loading || pagination.page <= 1}>Previous</button>
            <span>Page {pagination.page} of {pagination.pageCount}</span>
            <button type="button" onClick={() => setPage(pagination.page + 1)} disabled={loading || pagination.page >= pagination.pageCount}>Next</button>
          </div>
        )}
      </section>
    </AppLayout>
  )
}

export function SupervisorTierPage() {
  const [tiers, setTiers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    fetch(config.REST_API.Supervisor.TierConfiguration, { headers: supervisorHeaders(), signal: controller.signal })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.message || 'Unable to load tier configuration.')
        setTiers(data.tiers)
      })
      .catch((loadError) => {
        if (!controller.signal.aborted) setError(loadError.message || 'Unable to load tier configuration.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [])

  return (
    <AppLayout route="supervisor">
      <div className="page-header compact"><h1>Tier Configuration</h1></div>
      <section className="supervisor-audit-panel card-light" aria-label="Configured tiers">
        <div className="supervisor-audit-heading"><h3>Lifetime Tier Thresholds</h3><Link to="/supervisor#tier-configuration">Edit thresholds and customer overrides</Link></div>
        {error && <div className="status-banner error" role="alert">{error}</div>}
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Tier</th><th>Minimum lifetime transaction volume</th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan="2">Loading tier configuration...</td></tr>}
              {!loading && !error && tiers.length === 0 && <tr><td colSpan="2">No tiers are configured.</td></tr>}
              {!loading && !error && tiers.map((tier) => (
                <tr key={tier.name}><td>{tier.name}</td><td>{Number(tier.minimum).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppLayout>
  )
}
