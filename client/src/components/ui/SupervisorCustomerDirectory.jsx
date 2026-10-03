import { Fragment, useEffect, useState } from 'react'
import config from '../../config'
import { notifyAuditLogUpdated } from '../../auditEvents'
import { CustomerUsageProfile } from './CustomerUsageProfile'
import { Icon, StatusBadge, TierBadge } from './Icon'

const EMPTY_FILTERS = {
  search: '', tier: '', status: '', transactionType: '',
  minVolume: '', maxVolume: '', minCount: '', maxCount: '',
  lastActivityFrom: '', lastActivityTo: '', signupFrom: '', signupTo: '',
}

function formatPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '')
  return digits.length === 11 && digits.startsWith('1')
    ? `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
    : phone || '—'
}

function formatCurrency(value) {
  return `$${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : '—'
}

function statusLabel(value) {
  return String(value || '').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

const EXPORT_COLUMNS = [
  ['profileId', 'Profile ID'],
  ['name', 'Name'],
  ['phone', 'Phone'],
  ['email', 'Email'],
  ['playerMobileId', 'Player Mobile ID'],
  ['playerId', 'Player ID'],
  ['facebook', 'Facebook'],
  ['instagram', 'Instagram'],
  ['telegram', 'Telegram'],
  ['status', 'Approval Status'],
  ['submittedAt', 'Signup Date'],
  ['reviewedAt', 'Reviewed At'],
  ['reviewDecision', 'Review Decision'],
  ['reviewReviewer', 'Reviewed By'],
  ['rewardTier', 'Tier'],
  ['originalTier', 'Automatic Tier'],
  ['lifetimeVolume', 'Lifetime Volume'],
  ['transactionCount', 'Transaction Count'],
  ['lastActivityAt', 'Last Activity Date'],
  ['buyTotal', 'Buy Total'],
  ['sendTotal', 'Send Total'],
  ['receiveTotal', 'Receive Total'],
  ['sellTotal', 'Sell Total'],
]

function csvCell(value) {
  const text = String(value ?? '')
  const safeText = /^[\t\r ]*[=+\-@]/.test(text) ? `'${text}` : text
  return `"${safeText.replaceAll('"', '""')}"`
}

function downloadCustomersCsv(customers) {
  const rows = [
    EXPORT_COLUMNS.map(([, label]) => csvCell(label)).join(','),
    ...customers.map((customer) => EXPORT_COLUMNS.map(([key]) => csvCell(customer[key])).join(',')),
  ]
  const blob = new Blob([`\uFEFF${rows.join('\r\n')}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `payfe-customers-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function SupervisorCustomerDirectory() {
  const [customers, setCustomers] = useState([])
  const [selectedPhone, setSelectedPhone] = useState('')
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState('')
  const [exportError, setExportError] = useState('')
  const [editForm, setEditForm] = useState({ name: '', email: '', playerMobileId: '', playerId: '' })
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileStatus, setProfileStatus] = useState({ type: 'idle', message: '' })
  const [changingStatus, setChangingStatus] = useState(false)
  const selectedCustomer = customers.find((customer) => customer.phone === selectedPhone) || null
  const canEditProfile = selectedCustomer?.status === 'approved'

  useEffect(() => {
    setEditForm({
      name: selectedCustomer?.name || '',
      email: selectedCustomer?.email || '',
      playerMobileId: selectedCustomer?.playerMobileId || '',
      playerId: selectedCustomer?.playerId || '',
    })
    setProfileStatus({ type: 'idle', message: '' })
  }, [selectedPhone])

  useEffect(() => {
    const token = localStorage.getItem('p4p_supervisor_token')
    const controller = new AbortController()
    const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== ''))
    const timer = setTimeout(() => fetch(`${config.REST_API.Supervisor.Customers}?${query}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.message || 'Unable to load customers.')
        const loadedCustomers = data.customers || []
        setCustomers(loadedCustomers)
        setSelectedPhone((current) => loadedCustomers.some((customer) => customer.phone === current)
          ? current
          : '')
        setError('')
      })
      .catch((loadError) => {
        if (loadError.name !== 'AbortError') setError(loadError.message || 'Unable to load customers.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      }), 250)
    setLoading(true)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [filters])

  useEffect(() => {
    if (!selectedCustomer) return undefined
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setSelectedPhone('')
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [selectedCustomer])

  const updateFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }))
  const clearFilters = () => setFilters({ ...EMPTY_FILTERS })
  const updateEditForm = (key, value) => setEditForm((current) => ({ ...current, [key]: value }))

  const saveProfileChanges = async () => {
    if (!selectedCustomer || savingProfile) return
    setSavingProfile(true)
    setProfileStatus({ type: 'idle', message: '' })
    try {
      const token = localStorage.getItem('p4p_supervisor_token')
      const response = await fetch(config.REST_API.Review.GetApplicationByPhone(selectedCustomer.phone), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(editForm),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Unable to save profile changes.')
      setCustomers((current) => current.map((customer) => (
        customer.phone === selectedCustomer.phone ? { ...customer, ...data.application } : customer
      )))
      setProfileStatus({ type: 'success', message: 'Profile changes saved.' })
      notifyAuditLogUpdated()
    } catch (saveError) {
      setProfileStatus({ type: 'error', message: saveError.message || 'Unable to save profile changes.' })
    } finally {
      setSavingProfile(false)
    }
  }

  const changeCustomerStatus = async () => {
    if (!selectedCustomer || changingStatus) return
    const nextStatus = selectedCustomer.status === 'approved' ? 'rejected' : 'approved'
    setChangingStatus(true)
    setProfileStatus({ type: 'idle', message: '' })
    try {
      const token = localStorage.getItem('p4p_supervisor_token')
      const response = await fetch(config.REST_API.Internal.CustomerStatus(selectedCustomer.phone), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ status: nextStatus }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Unable to update customer status.')
      setCustomers((current) => current.map((customer) => (
        customer.phone === selectedCustomer.phone ? { ...customer, status: nextStatus } : customer
      )))
      setProfileStatus({ type: 'success', message: nextStatus === 'approved' ? 'Customer status set to approved.' : 'Customer status set to rejected.' })
      notifyAuditLogUpdated()
    } catch (statusError) {
      setProfileStatus({ type: 'error', message: statusError.message || 'Unable to update customer status.' })
    } finally {
      setChangingStatus(false)
    }
  }

  const exportCustomers = async () => {
    setExporting('table')
    setExportError('')
    try {
      const token = localStorage.getItem('p4p_supervisor_token')
      const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== ''))
      query.set('export', 'csv')
      const queryString = query.toString()
      const response = await fetch(`${config.REST_API.Supervisor.Customers}${queryString ? `?${queryString}` : ''}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Unable to export customer records.')
      const rows = data.customers || []
      downloadCustomersCsv(rows)
    } catch (exportFailure) {
      setExportError(exportFailure.message || 'Unable to export customer records.')
    } finally {
      setExporting('')
    }
  }

  return (
    <section className="supervisor-customer-directory" aria-labelledby="supervisor-customer-directory-title">
      <div className="supervisor-directory-panel card-light">
          <div className="supervisor-directory-heading">
            <div>
              <span className="detail-meta">Customer records</span>
              <h3 id="supervisor-customer-directory-title">Customer Directory</h3>
            </div>
            <div className="supervisor-directory-actions">
              <span className="secondary-badge">{loading ? 'Loading' : customers.length}</span>
              <button type="button" className="ghost-link" onClick={exportCustomers} disabled={loading || Boolean(exporting)}>
                {exporting ? 'Exporting...' : 'Export CSV'}
              </button>
            </div>
          </div>
          {exportError && <div className="status-banner error" role="alert">{exportError}</div>}
          <div className="filters-bar">
            <div className="filter-row">
              <div className="field wide"><label htmlFor="supervisor-customer-search">Search by Name or Phone</label><input id="supervisor-customer-search" value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Name or phone" /></div>
              <div className="field small"><label htmlFor="supervisor-customer-tier">Tier</label><select id="supervisor-customer-tier" value={filters.tier} onChange={(event) => updateFilter('tier', event.target.value)}><option value="">All tiers</option>{['Bronze', 'Silver', 'Gold', 'Diamond'].map((tier) => <option key={tier} value={tier}>{tier}</option>)}</select></div>
              <div className="field small"><label htmlFor="supervisor-customer-status">Approval Status</label><select id="supervisor-customer-status" value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}><option value="">All statuses</option><option value="pending_review">Pending review</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select></div>
            </div>
            <div className="filter-row secondary">
              <div className="field inline"><label>Lifetime Volume Range</label><div className="mini-inputs"><input aria-label="Minimum lifetime volume" type="number" min="0" value={filters.minVolume} onChange={(event) => updateFilter('minVolume', event.target.value)} placeholder="Min" /><span>to</span><input aria-label="Maximum lifetime volume" type="number" min="0" value={filters.maxVolume} onChange={(event) => updateFilter('maxVolume', event.target.value)} placeholder="Max" /></div></div>
              <div className="field inline"><label>Transaction Count Range</label><div className="mini-inputs"><input aria-label="Minimum transaction count" type="number" min="0" step="1" value={filters.minCount} onChange={(event) => updateFilter('minCount', event.target.value)} placeholder="Min" /><span>to</span><input aria-label="Maximum transaction count" type="number" min="0" step="1" value={filters.maxCount} onChange={(event) => updateFilter('maxCount', event.target.value)} placeholder="Max" /></div></div>
              <div className="field inline"><label htmlFor="supervisor-transaction-type">Transaction Type Used</label><select id="supervisor-transaction-type" value={filters.transactionType} onChange={(event) => updateFilter('transactionType', event.target.value)}><option value="">Any type</option><option value="buy">Buy</option><option value="send">Send</option><option value="receive">Receive</option><option value="sell">Sell</option></select></div>
              <button type="button" className="clear-button" onClick={clearFilters}>Clear Filters</button>
            </div>
            <div className="filter-row date-ranges">
              <div className="field date-range-field"><label>Last Activity Date</label><div className="mini-inputs"><input aria-label="Last activity from" type="date" value={filters.lastActivityFrom} onChange={(event) => updateFilter('lastActivityFrom', event.target.value)} /><span>to</span><input aria-label="Last activity to" type="date" value={filters.lastActivityTo} onChange={(event) => updateFilter('lastActivityTo', event.target.value)} /></div></div>
              <div className="field date-range-field"><label>Signup Date</label><div className="mini-inputs"><input aria-label="Signup date from" type="date" value={filters.signupFrom} onChange={(event) => updateFilter('signupFrom', event.target.value)} /><span>to</span><input aria-label="Signup date to" type="date" value={filters.signupTo} onChange={(event) => updateFilter('signupTo', event.target.value)} /></div></div>
            </div>
          </div>
          <div className="data-table-header">
            {loading ? 'Loading customers...' : `Showing ${customers.length} customer${customers.length === 1 ? '' : 's'}`}
          </div>
          {error && <div className="status-banner error">{error}</div>}
          <div className="table-scroll supervisor-directory-scroll">
            <table className="data-table supervisor-directory-table">
              <thead><tr><th>Name</th><th>Phone Number</th><th>Current Tier</th><th>Approval Status</th><th>Lifetime Volume</th><th>Transactions</th><th>Last Activity</th><th>Signup Date</th></tr></thead>
              <tbody>
                {!loading && !error && customers.length === 0 && <tr><td colSpan="8">No customers match these filters.</td></tr>}
                {customers.map((customer) => (
                  <Fragment key={customer.phone}>
                    <tr
                      className="supervisor-directory-customer-row"
                      tabIndex={0}
                      aria-selected={selectedPhone === customer.phone}
                      onClick={() => setSelectedPhone(customer.phone)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          setSelectedPhone(customer.phone)
                        }
                      }}
                    >
                      <td>{customer.name}</td>
                      <td>{formatPhone(customer.phone)}</td>
                      <td><TierBadge label={customer.rewardTier} /></td>
                      <td><StatusBadge text={statusLabel(customer.status)} tone={customer.status === 'approved' ? 'green' : customer.status === 'rejected' ? 'red' : 'info'} /></td>
                      <td>{formatCurrency(customer.lifetimeVolume)}</td>
                      <td>{customer.transactionCount}</td>
                      <td>{formatDate(customer.lastActivityAt)}</td>
                      <td>{formatDate(customer.submittedAt)}</td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
      </div>
      {selectedCustomer && (
        <div className="supervisor-customer-detail-overlay" onClick={() => setSelectedPhone('')}>
          <section
            className="supervisor-customer-detail-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="supervisor-customer-detail-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="supervisor-customer-detail-header">
              <div>
                <span className="detail-meta">Customer Record</span>
                <h3 id="supervisor-customer-detail-title">{selectedCustomer.name}</h3>
                <div className="supervisor-customer-detail-meta">
                  <span>{formatPhone(selectedCustomer.phone)}</span>
                  <StatusBadge text={statusLabel(selectedCustomer.status)} tone={selectedCustomer.status === 'approved' ? 'green' : selectedCustomer.status === 'rejected' ? 'red' : 'info'} />
                  <button type="button" className="supervisor-status-toggle" onClick={changeCustomerStatus} disabled={changingStatus}>
                    {changingStatus ? 'Updating...' : selectedCustomer.status === 'approved' ? 'Mark Rejected' : 'Mark Approved'}
                  </button>
                </div>
              </div>
              <button type="button" className="supervisor-customer-detail-close" aria-label="Close customer details" onClick={() => setSelectedPhone('')}>
                <Icon name="x" />
              </button>
            </header>
            {canEditProfile && (
              <div className="supervisor-profile-edit">
                <label className="supervisor-profile-edit-field"><span>Name</span><input value={editForm.name} onChange={(event) => updateEditForm('name', event.target.value)} /></label>
                <label className="supervisor-profile-edit-field"><span>Email Address</span><input type="email" value={editForm.email} onChange={(event) => updateEditForm('email', event.target.value)} /></label>
                <label className="supervisor-profile-edit-field"><span>Player Mobile ID</span><input value={editForm.playerMobileId} onChange={(event) => updateEditForm('playerMobileId', event.target.value)} /></label>
                <label className="supervisor-profile-edit-field"><span>Player ID</span><input value={editForm.playerId} onChange={(event) => updateEditForm('playerId', event.target.value)} /></label>
                <button type="button" className="supervisor-profile-save" onClick={saveProfileChanges} disabled={savingProfile}>
                  {savingProfile ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            )}
            {profileStatus.message && <div className={`status-banner ${profileStatus.type}`} role="alert">{profileStatus.message}</div>}
            <CustomerUsageProfile phone={selectedCustomer.phone} role="supervisor" />
          </section>
        </div>
      )}
    </section>
  )
}