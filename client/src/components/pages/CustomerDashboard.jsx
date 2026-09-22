import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import roles from '../../data/roles'
import config from '../../config'
import play4PerksLogo from '../../assets/play4perks-logo.png'
import { AppLayout } from '../layout/AppLayout'
import { Icon, StatusBadge } from '../ui/Icon'

function formatCurrency(value) {
  return `$${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatActivityDate(value) {
  if (!value) return 'No activity yet'

  const date = new Date(value)
  return `${date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })} ${date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })}`
}

function CustomerOverview({ application, usage }) {
  const tier = usage.reward_tier || 'Bronze'
  const profileName = application?.name || 'Ava Johnson'
  const avatarText = profileName.split(' ').map((part) => part[0]).slice(0, 2).join('') || 'AJ'

  return (
    <div className="customer-overview">
      <div className="profile-summary-card panel-card">
        <div className="profile-card-header">
          <div className="profile-badge-wrap">
            <div className="profile-avatar">{avatarText}</div>
          </div>
          <div className="profile-header-copy">
            <h3>{profileName}</h3>
            <span className="gold-badge">Gold Member</span>
            <span className="profile-subtext">Player ID: {application.playerId || 'P4P-2048'}</span>
          </div>
        </div>

        <div className="profile-detail-list">
          <div className="profile-detail-item">
            <span className="detail-icon"><Icon name="mail" /></span>
            <strong>{application.email || 'ava.johnson@example.com'}</strong>
          </div>
          <div className="profile-detail-item">
            <span className="detail-icon"><Icon name="phone" /></span>
            <strong>{application.phone || '+1 (919) 555-0147'}</strong>
          </div>
          <div className="profile-detail-item">
            <span className="detail-icon"><Icon name="calendar" /></span>
            <strong>{application.joined || 'June 12, 2024'}</strong>
          </div>
          <div className="profile-detail-item">
            <span className="detail-icon"><Icon name="info" /></span>
            <strong>🇺🇸 United States</strong>
          </div>
        </div>
      </div>

      <div className="verification-card panel-card">
        <div className="verification-shield"><Icon name="shield" /></div>
        <h3>Verified</h3>
        <p>Your account is fully verified and ready to play!</p>
        <div className="verification-status">
          <span className="verification-dot" />
          Phone &amp; Email Verified
        </div>
      </div>

      <div className="tier-card panel-card">
        <div className="tier-graphic"><Icon name="star" /></div>
        <div className="tier-title">{tier}</div>
        <p>You&apos;re on the {tier} Tier!</p>
        <div className="tier-progress"><span /></div>
        <div className="tier-points">2,340 / 5,000 points</div>
        <small>Earn 2,660 more points to reach Gold Tier</small>
      </div>

      <div className="promo-card panel-card">
        <div className="promo-art" aria-hidden="true">
          <span className="promo-chip">LIMITED TIME</span>
          <span className="promo-crown">👑</span>
          <span className="promo-gift">🎁</span>
          <span className="promo-coin">◉</span>
        </div>
        <h3>EXCLUSIVE BONUS &amp; PROMOS</h3>
        <p>More Play. More Perks.</p>
        <button type="button" className="promo-button">Check Now <span>→</span></button>
      </div>
    </div>
  )
}

function CustomerApprovedDashboard({ application, usage, transactions }) {
  const accountName = application?.name || 'Ava Johnson'

  const dashboardStats = roles.customer.metrics.map((metric) => ({
    ...metric,
    value: metric.label === 'Lifetime Transaction Volume' && usage?.lifetime_transaction_volume != null
      ? formatCurrency(usage.lifetime_transaction_volume)
      : metric.value,
    icon: metric.label.includes('Wallet') ? 'money' : metric.label.includes('Rewards') ? 'trophy' : metric.label.includes('Games') ? 'gamepad' : 'table',
  }))

  return (
    <div className="customer-dashboard-shell">
      <div className="dashboard-inner">
        <section className="welcome-banner">
          <div className="welcome-brand" aria-hidden="true">
            <div className="welcome-brand-mark">
              <img src={play4PerksLogo} alt="Play4Perks" />
              <span className="welcome-brand-pill">P4P</span>
            </div>
          </div>

          <div className="welcome-copy">
            <h1>
              Welcome back, <span className="gold-name">{accountName}</span>! 👋
            </h1>
            <p>Play more. Earn more. Get exclusive perks with Play4Perks.</p>
          </div>

          <div className="welcome-art" aria-hidden="true">
            <div className="welcome-script">
              <span>REAL PLAYERS</span>
              <span>REAL REWARDS</span>
            </div>
            <span className="welcome-neon-crown" />
            <img src="/play4perks-banner-art.png" alt="" className="welcome-game-art" />
          </div>
        </section>

        <section className="top-cards-grid">
          <CustomerOverview application={application} usage={usage} />
        </section>

        <section className="dashboard-stat-grid">
          {dashboardStats.map((metric) => (
            <div className="dashboard-stat-card" key={metric.label}>
              <div className="stat-head">
                <span>{metric.label}</span>
                <span className="mini-icon"><Icon name={metric.icon} /></span>
              </div>
              <div className="stat-value">{metric.value}</div>
              <div className="stat-change">{metric.change}</div>
            </div>
          ))}
        </section>

        <section className="lower-grid">
          <div className="panel-card transactions-card">
            <div className="panel-header">
              <h3>Recent Transactions</h3>
              <button type="button" className="view-link">View All →</button>
            </div>

            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Date / Time</th>
                    <th>Type</th>
                    <th>Game / Channel</th>
                    <th>Amount (USD)</th>
                    <th>Status</th>
                    <th>Reference ID</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.length === 0 ? (
                    <tr><td colSpan="6">No transactions yet.</td></tr>
                  ) : transactions.map((row) => (
                    <tr key={row.transaction_id}>
                      <td>{formatActivityDate(row.transaction_datetime)}</td>
                      <td><span className="type-badge buy">{row.transaction_type.toUpperCase()}</span></td>
                      <td>P3M</td>
                      <td>{formatCurrency(row.transaction_amount)}</td>
                      <td><StatusBadge text={row.transaction_status.toUpperCase()} tone="green" /></td>
                      <td>{row.transaction_id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel-card games-card">
            <div className="panel-header">
              <h3>Popular Games</h3>
              <button type="button" className="view-link">View All →</button>
            </div>

            <div className="games-grid">
              {['Ultra Panda', 'Diamond Dragon', 'Fortune Tiger', 'Cash Frenzy'].map((game, index) => (
                <div key={game} className={`game-tile tile-${index + 1}`}>
                  <span>{game}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bottom-cta-row">
          <div className="panel-card cta-banner profile-cta">
            <div className="cta-mark"><Icon name="edit" /></div>
            <div className="cta-copy">
              <h3>Complete Your Profile</h3>
              <p>Keep your profile up to date for a safer and smoother experience.</p>
            </div>
            <button type="button" className="cta-action">Update Profile →</button>
          </div>

          <div className="panel-card cta-banner referral-cta">
            <div className="cta-mark">🎁</div>
            <div className="cta-copy">
              <h3>Refer a Friend</h3>
              <p>Invite friends and earn amazing rewards.</p>
            </div>
            <button type="button" className="cta-action">Invite Now →</button>
          </div>
        </section>
      </div>
    </div>
  )
}

const STATUS_COPY = {
  pending_review: {
    title: 'Application Pending Review',
    body: 'Your signup has been submitted and is awaiting review by a PayFe Supervisor. You will be able to view your full profile once approved.',
    icon: 'bell',
  },
  rejected: {
    title: 'Application Not Approved',
    body: 'Your application was not approved. You may resubmit your signup with updated details.',
    icon: 'info',
  },
}

function CustomerStatusCard({ status }) {
  const copy = STATUS_COPY[status] || STATUS_COPY.pending_review

  return (
    <div className="signup-shell">
      <div className="signup-card">
        <div className="status-card card-light">
          <div className="status-icon"><Icon name={copy.icon} /></div>
          <h3>{copy.title}</h3>
          <p>{copy.body}</p>
          {status === 'rejected' && <Link to="/signup" className="primary-btn">Resubmit Application</Link>}
        </div>
      </div>
    </div>
  )
}

export function CustomerDashboard() {
  const navigate = useNavigate()
  const [state, setState] = useState({ loading: true, error: null, status: null, application: null, usage: null, transactions: [] })

  useEffect(() => {
    const token = localStorage.getItem('p4p_customer_token')

    if (!token) {
      navigate('/login')
      return
    }

    fetch(config.REST_API.Customer.Session, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        const data = await response.json().catch(() => null)

        if (!response.ok) {
          if (response.status === 401) {
            localStorage.removeItem('p4p_customer_token')
            navigate('/login')
            return
          }
          setState({ loading: false, error: data.message || 'Unable to load account status.', status: null, application: null, usage: null, transactions: [] })
          return
        }

        setState({ loading: false, error: null, status: data.status, application: data.application, usage: data.usage, transactions: data.transactions || [] })
      })
      .catch(() => {
        setState({ loading: false, error: 'Unable to load account status.', status: null, application: null, usage: null, transactions: [] })
      })
  }, [navigate])

  if (state.loading) {
    return <p className="otp-label">Loading your account...</p>
  }

  if (state.error) {
    return <div className="status-banner error">{state.error}</div>
  }

  if (state.status !== 'approved') {
    return <CustomerStatusCard status={state.status} />
  }

  return <CustomerApprovedDashboard application={state.application} usage={state.usage} transactions={state.transactions} />
}

export function CustomerPage() {
  return (
    <AppLayout route="customer">
      <CustomerDashboard />
    </AppLayout>
  )
}

