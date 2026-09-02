import roles from '../../data/roles'
import { AppLayout } from '../layout/AppLayout'
import { Icon, StatusBadge, TierBadge } from '../ui/Icon'

function BasicUserTable() {
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

        <div className="data-table-header">Showing 1 to 10 of 12,458 approved customers</div>
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
              </tr>
            </thead>
            <tbody>
              {roles.basic.customers.map((row) => (
                <tr key={row[0]}>
                  <td>{row[0]}</td>
                  <td>{row[1]}</td>
                  <td><TierBadge label={row[2]} /></td>
                  <td>{row[3]}</td>
                  <td>{row[4]}</td>
                  <td>{row[5]}</td>
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
          <div className="panel-title-row"><h3>{roles.basic.selected.name}</h3><button className="close-btn">×</button></div>
          <div className="panel-status"><StatusBadge text={roles.basic.selected.status} tone="green" /></div>
          <div className="customer-phone">+1 (919) 555-0147</div>
          <div className="info-block">
            <div className="info-row"><span>Email Address</span><strong>{roles.basic.selected.email}</strong></div>
            <div className="info-row"><span>Player Mobile ID</span><strong>{roles.basic.selected.mobileId}</strong></div>
            <div className="info-row"><span>Facebook Link</span><strong>{roles.basic.selected.facebook}</strong></div>
            <div className="info-row"><span>Instagram Handle</span><strong>{roles.basic.selected.instagram}</strong></div>
            <div className="info-row"><span>Telegram ID</span><strong>{roles.basic.selected.telegram}</strong></div>
          </div>

          <div className="summary-grid">
            <div><span>Lifetime Volume</span><strong>{roles.basic.selected.lifetime}</strong></div>
            <div><span>Transaction Count</span><strong>{roles.basic.selected.transactions}</strong></div>
            <div><span>Last Active</span><strong>{roles.basic.selected.lastActive}</strong></div>
            <div><span>Current Tier</span><strong>{roles.basic.selected.tier}</strong></div>
          </div>

          <div className="usage-summary">
            <div className="usage-header">Usage Summary</div>
            {Object.entries(roles.basic.selected.summary).map(([key, value]) => (
              <div className="usage-item" key={key}>
                <span className="usage-label">{key.charAt(0).toUpperCase() + key.slice(1)}</span>
                <div className="usage-bar"><span style={{ width: `${value}%` }} /></div>
                <strong>{value}%</strong>
              </div>
            ))}
          </div>

          <div className="history-block">
            <div className="history-header">Transaction History</div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr><th>ID</th><th>Type</th><th>Date</th><th>Amount</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {roles.basic.selected.history.map((row) => (
                    <tr key={row[0]}>
                      <td>{row[0]}</td>
                      <td>{row[1]}</td>
                      <td>{row[2]}</td>
                      <td>{row[3]}</td>
                      <td><StatusBadge text={row[4]} tone="green" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}

export function BasicUserDashboard() {
  return (
    <>
      <div className="page-header compact">
        <div>
          <h1>PayFe Basic User - View Only</h1>
          <p>View approved customer profiles, rewards tiers, and transaction activity.</p>
        </div>
        <button className="view-only-link">View Only</button>
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
