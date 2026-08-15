import roles from '../../data/roles'
import { AppLayout } from '../layout/AppLayout'
import { Icon, StatusBadge } from '../ui/Icon'

function CustomerOverview() {
  return (
    <div className="customer-overview">
      <div className="profile-wrap">
        <div className="profile-summary-card card-light">
          <div className="card-header-row">
            <h3>Profile Summary</h3>
            <button className="view-only-link">View Only</button>
          </div>
          <div className="profile-lines">
            <div className="profile-line"><span>Name</span><strong>Ava Johnson</strong></div>
            <div className="profile-line"><span>Phone Number</span><strong>+1 (919) 555-0147</strong></div>
            <div className="profile-line"><span>Email Address</span><strong>ava.johnson@example.com</strong></div>
            <div className="profile-line"><span>Player Mobile ID</span><strong>M-120-777-872</strong></div>
            <div className="profile-line"><span>Player ID</span><strong>5885233</strong></div>
            <div className="profile-line"><span>Facebook Link</span><strong>fb.com/ava.johnson</strong></div>
            <div className="profile-line"><span>Instagram Handle</span><strong>@avajplays</strong></div>
            <div className="profile-line"><span>Telegram ID</span><strong>@avaj_tg</strong></div>
          </div>
        </div>
      </div>

      <div className="status-side">
        <div className="status-card card-light">
          <div className="status-icon green"><Icon name="check" /></div>
          <h3>Account Approved</h3>
          <p>Your account has been reviewed and approved.</p>
        </div>
        <div className="verified-card card-light">
          <div className="phone-pill"><Icon name="bell" /> Phone Verified via SMS</div>
          <div className="phone-number">+1 (919) 555-0147</div>
          <div className="phone-meta">Verified on May 26, 2026 at 10:32 AM</div>
        </div>
      </div>

      <div className="tier-side">
        <div className="tier-card card-light">
          <div className="shield-wrap"><Icon name="shield" /></div>
          <div className="tier-label">Silver</div>
          <div className="tier-sub">You’re on the Silver tier!</div>
          <div className="tier-progress"><span /></div>
          <div className="tier-amount">$12,210 / $25,000</div>
          <div className="tier-footer">Lifetime Volume to reach Gold tier</div>
          <button className="view-benefits">View Tier Benefits →</button>
        </div>
      </div>
    </div>
  )
}

export function CustomerDashboard() {
  return (
    <>
      <div className="page-header">
        <div>
          <h1>Welcome back, Ava Johnson!</h1>
          <p>Here&apos;s your rewards status and activity overview.</p>
        </div>
        <div className="state-pills">
          <span className="phase-pill"><Icon name="spark" /> Phase 2</span>
          <span className="approved-pill">Account Approved</span>
        </div>
      </div>
      <CustomerOverview />
      <div className="summary-grid three-up">
        {roles.customer.metrics.map((metric, index) => (
          <div className="metric-card card-light" key={metric.label}>
            <div className="metric-head">
              <span>{metric.label}</span>
              <span className="small-icon"><Icon name={index === 0 ? 'money' : index === 1 ? 'table' : 'calendar'} /></span>
            </div>
            <div className="metric-value">{metric.value}</div>
            <div className="metric-change">{metric.change}</div>
          </div>
        ))}
      </div>
      <div className="recent-activity card-light">
        <div className="table-title-row">
          <h3>Recent Activity</h3>
          <button className="link-btn">View All Transactions →</button>
        </div>
        <table>
          <thead>
            <tr><th>Date / Time</th><th>Type</th><th>Channel</th><th>Amount (USD)</th><th>Status</th><th>Reference ID</th></tr>
          </thead>
          <tbody>
            {roles.customer.activity.map((row) => (
              <tr key={row[5]}>
                <td>{row[0]}</td>
                <td><span className="type-badge buy">{row[1]}</span></td>
                <td>{row[2]}</td>
                <td>{row[3]}</td>
                <td><StatusBadge text={row[4]} tone="green" /></td>
                <td>{row[5]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="view-only-banner card-light">
        <div className="banner-icon"><Icon name="info" /></div>
        <div>
          <strong>View-Only Profile</strong>
          <p>Your profile information is locked to protect your account. If you believe any information is incorrect, please contact support.</p>
        </div>
        <button className="support-btn">Contact Support →</button>
      </div>
    </>
  )
}

export function CustomerPage() {
  return (
    <AppLayout route="customer">
      <CustomerDashboard />
    </AppLayout>
  )
}
