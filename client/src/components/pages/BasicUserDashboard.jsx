import { useEffect, useState } from 'react'
import roles from '../../data/roles'
import config from '../../config'
import { useProfilePicture } from '../../useProfilePicture'
import welcomeBannerArt from '../../assets/play4perks-banner-art.png'
import { AppLayout } from '../layout/AppLayout'
import { Icon, StatusBadge, TierBadge } from '../ui/Icon'

function formatPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '')
  return digits.length === 11 && digits.startsWith('1')
    ? `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
    : phone || '—'
}

function formatCurrency(value) {
  return `$${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function BasicUserTable() {
  const [customers, setCustomers] = useState([])
  const [selectedPhone, setSelectedPhone] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const selectedCustomer = customers.find((customer) => customer.phone === selectedPhone) || null

  useEffect(() => {
    const token = localStorage.getItem('p4p_basic_token')
    fetch(config.REST_API.Basic.Customers, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.message || 'Unable to load approved customers.')
        const loadedCustomers = data.customers || []
        setCustomers(loadedCustomers)
        setSelectedPhone(loadedCustomers[0]?.phone || '')
      })
      .catch((loadError) => setError(loadError.message || 'Unable to load approved customers.'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="basic-user-layout">
      <div className="table-panel">
        <div className="filters-bar">
          <div className="filter-row">
            <div className="field wide"><label>Search by Name or Phone</label><input value="Search by name or phone..." readOnly /></div>
            <div className="field small"><label>Tier</label><select value="All Tiers" readOnly><option>All Tiers</option></select></div>
            <div className="field small"><label>Approval Status</label><select value="Approved" readOnly><option>Approved</option></select></div>
          </div>
          <div className="filter-row secondary">
            <div className="field inline"><label>Lifetime Volume Range</label><div className="mini-inputs"><input value="Min" readOnly /><span>to</span><input value="Max" readOnly /></div></div>
            <div className="field inline"><label>Last Active Date</label><div className="calendar-wrap"><input value="Any time" readOnly /></div></div>
            <div className="field inline"><label>Signup Date</label><div className="calendar-wrap"><input value="Any time" readOnly /></div></div>
            <button className="clear-button">Clear Filters</button>
          </div>
        </div>

        <div className="data-table-header">
          {loading ? 'Loading approved customers...' : `Showing ${customers.length} approved customer${customers.length === 1 ? '' : 's'}`}
        </div>
        {error && <div className="status-banner error">{error}</div>}
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone Number</th>
                <th>Current Tier</th>
                <th>Lifetime Volume</th>
                <th>Transactions</th>
                <th>Last Activity</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {!loading && !error && customers.length === 0 && (
                <tr><td colSpan="7">No approved customers found.</td></tr>
              )}
              {customers.map((customer) => (
                <tr key={customer.phone}>
                  <td>
                    <span className="customer-name-cell">
                      <span className="customer-table-avatar">{customer.name.split(' ').map((part) => part[0]).join('')}</span>
                      {customer.name}
                    </span>
                  </td>
                  <td>{formatPhone(customer.phone)}</td>
                  <td><TierBadge label={customer.rewardTier} /></td>
                  <td>{formatCurrency(customer.lifetimeVolume)}</td>
                  <td>{customer.transactionCount}</td>
                  <td>{customer.lastActivityAt ? new Date(customer.lastActivityAt).toLocaleDateString() : '—'}</td>
                  <td><button type="button" className="row-action" onClick={() => setSelectedPhone(customer.phone)} aria-label={`View ${customer.name} details`}>⋮</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pagination">
          <button className="page-btn">‹</button>
          <button className="page-btn active">1</button>
          <button className="page-btn">2</button>
          <button className="page-btn">3</button>
          <button className="page-btn">…</button>
          <button className="page-btn">›</button>
        </div>
      </div>

      <aside className="profile-panel">
        <div className="profile-panel-card card-light">
          <div className="panel-title-row"><h3>{selectedCustomer?.name || 'Select a customer'}</h3><button className="close-btn">×</button></div>
          <div className="panel-status"><StatusBadge text="Approved" tone="green" /></div>
          <div className="customer-phone">{formatPhone(selectedCustomer?.phone)}</div>
          <div className="info-block">
            <div className="info-row"><span>Email Address</span><strong>{selectedCustomer?.email || '—'}</strong></div>
            <div className="info-row"><span>Player Mobile ID</span><strong>{selectedCustomer?.playerMobileId || '—'}</strong></div>
            <div className="info-row"><span>Player ID</span><strong>{selectedCustomer?.playerId || '—'}</strong></div>
          </div>

          <div className="summary-grid">
            <div><span>Lifetime Volume</span><strong>{formatCurrency(selectedCustomer?.lifetimeVolume)}</strong></div>
            <div><span>Transaction Count</span><strong>{selectedCustomer?.transactionCount || 0}</strong></div>
            <div><span>Last Active</span><strong>{selectedCustomer?.lastActivityAt ? new Date(selectedCustomer.lastActivityAt).toLocaleDateString() : '—'}</strong></div>
            <div><span>Current Tier</span><strong>{selectedCustomer?.rewardTier || '—'}</strong></div>
          </div>
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
        <Icon name="info" /> You are viewing approved customers only. No pending or rejected profiles are shown.
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
