import { useEffect, useState } from 'react'
import roles from '../../data/roles'
import config from '../../config'
import { useProfilePicture } from '../../useProfilePicture'
import welcomeBannerArt from '../../assets/play4perks-banner-art.png'
import { AppLayout } from '../layout/AppLayout'
import { Icon, StatusBadge, TierBadge } from '../ui/Icon'
import { CustomerUsageProfile } from '../ui/CustomerUsageProfile'

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

function BasicUserTable() {
  const [customers, setCustomers] = useState([])
  const [selectedPhone, setSelectedPhone] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({
    search: '', tier: '', status: '', transactionType: '',
    minVolume: '', maxVolume: '', minCount: '', maxCount: '',
    lastActivityFrom: '', lastActivityTo: '', signupFrom: '', signupTo: '',
  })
  const selectedCustomer = customers.find((customer) => customer.phone === selectedPhone) || null

  useEffect(() => {
    const token = localStorage.getItem('p4p_basic_token')
    const controller = new AbortController()
    const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== ''))
    const timer = setTimeout(() => fetch(`${config.REST_API.Basic.Customers}?${query}`, {
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
          : loadedCustomers[0]?.phone || '')
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

  const updateFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }))
  const clearFilters = () => setFilters({
    search: '', tier: '', status: '', transactionType: '',
    minVolume: '', maxVolume: '', minCount: '', maxCount: '',
    lastActivityFrom: '', lastActivityTo: '', signupFrom: '', signupTo: '',
  })

  return (
    <div className="basic-user-layout">
      <div className="table-panel">
        <div className="filters-bar">
          <div className="filter-row">
            <div className="field wide"><label htmlFor="customer-search">Search by Name or Phone</label><input id="customer-search" value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Name or phone" /></div>
            <div className="field small"><label htmlFor="customer-tier">Tier</label><select id="customer-tier" value={filters.tier} onChange={(event) => updateFilter('tier', event.target.value)}><option value="">All tiers</option>{['Bronze', 'Silver', 'Gold', 'Diamond'].map((tier) => <option key={tier} value={tier}>{tier}</option>)}</select></div>
            <div className="field small"><label htmlFor="customer-status">Approval Status</label><select id="customer-status" value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}><option value="">All statuses</option><option value="pending_review">Pending review</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select></div>
          </div>
          <div className="filter-row secondary">
            <div className="field inline"><label>Lifetime Volume Range</label><div className="mini-inputs"><input aria-label="Minimum lifetime volume" type="number" min="0" value={filters.minVolume} onChange={(event) => updateFilter('minVolume', event.target.value)} placeholder="Min" /><span>to</span><input aria-label="Maximum lifetime volume" type="number" min="0" value={filters.maxVolume} onChange={(event) => updateFilter('maxVolume', event.target.value)} placeholder="Max" /></div></div>
            <div className="field inline"><label>Transaction Count Range</label><div className="mini-inputs"><input aria-label="Minimum transaction count" type="number" min="0" step="1" value={filters.minCount} onChange={(event) => updateFilter('minCount', event.target.value)} placeholder="Min" /><span>to</span><input aria-label="Maximum transaction count" type="number" min="0" step="1" value={filters.maxCount} onChange={(event) => updateFilter('maxCount', event.target.value)} placeholder="Max" /></div></div>
            <div className="field inline"><label htmlFor="transaction-type">Transaction Type Used</label><select id="transaction-type" value={filters.transactionType} onChange={(event) => updateFilter('transactionType', event.target.value)}><option value="">Any type</option><option value="buy">Buy</option><option value="send">Send</option><option value="receive">Receive</option><option value="sell">Sell</option></select></div>
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
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone Number</th>
                <th>Current Tier</th>
                <th>Approval Status</th>
                <th>Lifetime Volume</th>
                <th>Transactions</th>
                <th>Last Activity</th>
                <th>Signup Date</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {!loading && !error && customers.length === 0 && (
                <tr><td colSpan="9">No customers match these filters.</td></tr>
              )}
              {customers.map((customer) => (
                <tr
                  key={customer.phone}
                  className={selectedPhone === customer.phone ? 'selected-customer-row' : ''}
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
                  <td>
                    <span className="customer-name-cell">
                      <span className="customer-table-avatar">{customer.name.split(' ').map((part) => part[0]).join('')}</span>
                      {customer.name}
                    </span>
                  </td>
                  <td>{formatPhone(customer.phone)}</td>
                  <td><TierBadge label={customer.rewardTier} /></td>
                  <td><StatusBadge text={statusLabel(customer.status)} tone={customer.status === 'approved' ? 'green' : customer.status === 'rejected' ? 'red' : 'info'} /></td>
                  <td>{formatCurrency(customer.lifetimeVolume)}</td>
                  <td>{customer.transactionCount}</td>
                  <td>{formatDate(customer.lastActivityAt)}</td>
                  <td>{formatDate(customer.submittedAt)}</td>
                  <td><button type="button" className="row-action" aria-label={`View ${customer.name} details`}>⋮</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <aside className="profile-panel">
        <div className="profile-panel-card card-light">
          <div className="panel-title-row"><h3>{selectedCustomer?.name || 'Select a customer'}</h3><button className="close-btn">×</button></div>
          <div className="customer-phone">{formatPhone(selectedCustomer?.phone)}</div>
          <div className="info-block">
            <div className="info-row"><span>Email Address</span><strong>{selectedCustomer?.email || '—'}</strong></div>
            <div className="info-row"><span>Player Mobile ID</span><strong>{selectedCustomer?.playerMobileId || '—'}</strong></div>
            <div className="info-row"><span>Player ID</span><strong>{selectedCustomer?.playerId || '—'}</strong></div>
          </div>

          <CustomerUsageProfile phone={selectedCustomer?.phone} role="basic" />
        </div>
      </aside>
    </div>
  )
}

export function BasicUserDashboard() {
  const { profileImage, uploadProfilePicture, uploading, error: profileImageError } = useProfilePicture('basic')

  const handleProfileImageChange = (event) => {
    const [file] = event.target.files || []
    uploadProfilePicture(file)
    event.target.value = ''
  }

  return (
    <>
      <div className="page-header compact">
        <div className="basic-banner-copy">
          <label className="basic-profile-upload" title="Upload profile picture">
            <input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={handleProfileImageChange} />
            {profileImage ? <img src={profileImage} alt="Basic user profile" /> : <Icon name="user" />}
            <span className="basic-profile-upload-action" aria-hidden="true">+</span>
          </label>
          <div className="basic-banner-text">
            <span className="basic-banner-kicker">Read-only workspace</span>
            <h1>PayFe Basic User</h1>
            <p>View approved customer profiles, rewards tiers, and transaction activity.</p>
            {profileImageError && <span className="profile-photo-error" role="alert">{profileImageError}</span>}
          </div>
        </div>
        <div className="basic-banner-art" aria-hidden="true">
          <img src={welcomeBannerArt} alt="" />
        </div>
      </div>
      <div className="summary-grid five-up">
        {roles.basic.stats.map((card, index) => (
          <div className={`stat-compact ${card.tone}`} key={card.title}>
            <div className="mini-icon"><Icon name={index === 0 ? 'user' : index === 1 ? 'trophy' : index === 2 ? 'shield' : index === 3 ? 'star' : 'diamond'} /></div>
            <div className="mini-top">{card.title}</div>
            <div className="mini-value">{card.value}</div>
            <div className="mini-note">{card.percent}</div>
          </div>
        ))}
      </div>
      <div className="view-only-alert">
        <Icon name="info" /> Customer profiles are read-only. Use approval status filters to narrow the list.
      </div>
      <BasicUserTable />
    </>
  )
}

export function BasicUserPage() {
  return (
    <AppLayout route="basic">
      <BasicUserDashboard />
    </AppLayout>
  )
}
