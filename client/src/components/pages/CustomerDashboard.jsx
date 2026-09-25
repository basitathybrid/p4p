import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import roles from '../../data/roles'
import config from '../../config'
import { useProfilePicture } from '../../useProfilePicture'
import welcomeBannerArt from '../../assets/play4perks-banner-art.png'
import promoGiftBox from '../../assets/more-than-just-play.png'
import goldenDragonImg from '../../assets/games/golden-dragon.png'
import magicCityImg from '../../assets/games/magic-city.png'
import ultraPandaImg from '../../assets/games/ultra-panda.png'
import vblinkImg from '../../assets/games/vblink.png'
import { AppLayout } from '../layout/AppLayout'
import { Icon, StatusBadge } from '../ui/Icon'

const POPULAR_GAMES = [
  { name: 'Golden Dragon', image: goldenDragonImg },
  { name: 'Magic City', image: magicCityImg },
  { name: 'Ultra Panda', image: ultraPandaImg },
  { name: 'VBLink', image: vblinkImg },
]

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

function CustomerOverview({ application, usage, profileImage }) {
  const tier = usage?.reward_tier || 'Bronze'
  const lifetimeVolume = Number(usage?.lifetime_transaction_volume || 0)
  const thresholds = usage?.tier_thresholds || []
  const nextTier = thresholds.find((threshold) => Number(threshold.minimum) > lifetimeVolume)
  const currentTierMinimum = Number(thresholds.find((threshold) => threshold.name === (usage?.original_reward_tier || tier))?.minimum || 0)
  const progressPercent = nextTier
    ? Math.min(100, Math.max(0, ((lifetimeVolume - currentTierMinimum) / (Number(nextTier.minimum) - currentTierMinimum)) * 100))
    : 100
  const profileName = application?.name || 'Ava Johnson'
  const avatarText = profileName.split(' ').map((part) => part[0]).slice(0, 2).join('') || 'AJ'

  return (
    <div className="customer-overview">
      <div className="profile-summary-card panel-card">
        <div className="profile-summary-heading">
          <div className="profile-summary-heading-title">
            <span className="profile-summary-heading-icon"><Icon name="user" /></span>
            <h3>Profile Summary</h3>
          </div>
          <button type="button" className="profile-summary-view-button">View Profile <span>→</span></button>
        </div>

        <div className="profile-card-header">
          <div className="profile-badge-wrap">
            <div className="profile-avatar">
              {profileImage ? <img src={profileImage} alt={`${profileName}'s profile`} /> : avatarText}
            </div>
            <span className="profile-online-dot" aria-label="Online" />
          </div>
          <div className="profile-header-copy">
            <h3>{profileName}</h3>
            <span className="gold-badge"><Icon name="star" /> {tier} Member</span>
            <span className="profile-subtext">Player ID: {application?.playerId || 'P4P-2048'}</span>
          </div>
        </div>

        <div className="profile-detail-list">
          <div className="profile-detail-item">
            <span className="detail-icon"><Icon name="user" /></span>
            <span className="detail-label">Name</span>
            <strong>{profileName}</strong>
          </div>
          <div className="profile-detail-item">
            <span className="detail-icon"><Icon name="phone" /></span>
            <span className="detail-label">Phone Number</span>
            <strong>{application?.phone || '+1 (919) 555-0147'}</strong>
          </div>
          <div className="profile-detail-item">
            <span className="detail-icon"><Icon name="mail" /></span>
            <span className="detail-label">Email Address</span>
            <strong>{application?.email || 'ava.johnson@example.com'}</strong>
          </div>
          <div className="profile-detail-item">
            <span className="detail-icon"><Icon name="info" /></span>
            <span className="detail-label">Player Mobile ID</span>
            <strong>{application?.playerMobileId || 'M-656-987-989'}</strong>
          </div>
          <div className="profile-detail-item">
            <span className="detail-icon"><Icon name="info" /></span>
            <span className="detail-label">Player ID</span>
            <strong>{application?.playerId || 'P4P-2048'}</strong>
          </div>
          <div className="profile-detail-item">
            <span className="detail-icon"><Icon name="info" /></span>
            <span className="detail-label">Facebook Link</span>
            <strong>{application?.facebook || '—'}</strong>
          </div>
          <div className="profile-detail-item">
            <span className="detail-icon"><Icon name="info" /></span>
            <span className="detail-label">Instagram Handle</span>
            <strong>{application?.instagram || '—'}</strong>
          </div>
          <div className="profile-detail-item">
            <span className="detail-icon"><Icon name="info" /></span>
            <span className="detail-label">Telegram ID</span>
            <strong>{application?.telegram || '—'}</strong>
          </div>
        </div>
      </div>

      <div className="verification-card panel-card">
        <div className="verification-heading">
          <div className="verification-heading-title">
            <span className="verification-heading-icon"><Icon name="user" /></span>
            <h3>Account Status</h3>
          </div>
          <button type="button" className="profile-summary-view-button">View Details <span>→</span></button>
        </div>
        <div className="verification-shield"><Icon name="shield" /></div>
        <h3>Verified</h3>
        <p>Your account is fully verified and ready to play!</p>
        <div className="verification-status">
          <span className="verification-check"><Icon name="check" /></span>
          <span>
            <strong>Phone Number Verified</strong>
            <small>You can now play, earn and redeem.</small>
          </span>
        </div>
      </div>

      <div className="tier-card panel-card">
        <div className="verification-heading">
          <div className="verification-heading-title">
            <span className="verification-heading-icon"><Icon name="crown" /></span>
            <h3>Current Tier</h3>
          </div>
          <button type="button" className="profile-summary-view-button">View Tiers <span>→</span></button>
        </div>
        <div className="tier-graphic"><Icon name="star" /></div>
        <div className="tier-title">{tier}</div>
        <p>You&apos;re on the {tier} Tier!</p>
        {!usage?.tier_override && (
          <>
            <div className="tier-progress"><span style={{ width: `${progressPercent}%` }} /></div>
            {nextTier ? (
              <>
                <div className="tier-points">{formatCurrency(lifetimeVolume)} / {formatCurrency(nextTier.minimum)}</div>
                <small>{formatCurrency(Math.max(0, Number(nextTier.minimum) - lifetimeVolume))} more in lifetime volume to reach {nextTier.name} Tier</small>
              </>
            ) : (
              <>
                <div className="tier-points">{formatCurrency(lifetimeVolume)} lifetime volume</div>
                <small>Top tier reached</small>
              </>
            )}
          </>
        )}
      </div>

      <div className="promo-card panel-card">
        <span className="promo-chip">LIMITED TIME</span>
        <div className="promo-art" aria-hidden="true">
          <img src={promoGiftBox} alt="" className="promo-art-image" />
        </div>
        <h3>
          <span className="promo-title-accent">EXCLUSIVE</span>
          <span className="promo-title-gold">BONUS &amp; PROMOS</span>
        </h3>
        <p>More Play. More Perks.</p>
        <button type="button" className="promo-button">Check Now <span>→</span></button>
      </div>
    </div>
  )
}

function CustomerApprovedDashboard({ application, usage, transactions }) {
  const accountName = application?.name || 'Ava Johnson'
  const profileImageKey = `p4p_customer_profile_image_${application?.phone || 'demo'}`
  const { profileImage, uploadProfilePicture, uploading, error: profileImageError } = useProfilePicture('customer', profileImageKey)
  const profileInputRef = useRef(null)

  const handleProfileImageChange = (event) => {
    const [file] = event.target.files || []
    uploadProfilePicture(file)
    event.target.value = ''
  }

  const dashboardStats = roles.customer.metrics.map((metric) => ({
    ...metric,
    value: metric.label === 'Lifetime Transaction Volume' && usage?.lifetime_transaction_volume != null
      ? formatCurrency(usage.lifetime_transaction_volume)
      : metric.value,
    icon: metric.label.includes('Wallet') ? 'wallet' : metric.label.includes('Rewards') ? 'trophy' : metric.label.includes('Last Activity') ? 'history' : 'table',
  }))

  return (
    <div className="customer-dashboard-shell">
      <div className="dashboard-inner">
        <section className="welcome-banner">
          <div className="welcome-brand">
            <label className="welcome-profile-upload" title="Upload profile picture">
              <input ref={profileInputRef} type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={handleProfileImageChange} />
              {profileImage ? <img src={profileImage} alt={`${accountName}'s profile`} /> : <Icon name="user" />}
              <span className="welcome-profile-upload-action" aria-hidden="true">+</span>
            </label>
            <div className="welcome-brand-tagline">Profile Picture</div>
          </div>

          <div className="welcome-copy">
            <h1>
              Welcome back, <span className="gold-name">{accountName}</span>! 👋
            </h1>
            <p>Play more. Earn more. Get exclusive perks with Play4Perks.</p>
          </div>

          <div className="welcome-art" aria-hidden="true">
            <img src={welcomeBannerArt} alt="" className="welcome-game-art" />
          </div>
        </section>

        <section className="top-cards-grid">
          <CustomerOverview application={application} usage={usage} profileImage={profileImage} />
        </section>

        <section className="dashboard-stat-grid">
          {dashboardStats.map((metric) => (
            <div className="dashboard-stat-card" key={metric.label}>
              <div className="stat-head">
                <span>{metric.label}</span>
                <span className={`mini-icon${metric.icon === 'wallet' ? ' mini-icon-wallet' : ''}`}><Icon name={metric.icon} /></span>
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
              {POPULAR_GAMES.map((game, index) => (
                <div key={game.name} className={`game-tile tile-${index + 1}`}>
                  <img src={game.image} alt={game.name} />
                  <span>{game.name}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bottom-cta-row">
          <div className="panel-card cta-banner profile-cta">
            <div className="cta-mark">
              {profileImage ? <img src={profileImage} alt="" /> : <Icon name="edit" />}
            </div>
            <div className="cta-copy">
              <h3>{profileImage ? 'Profile Photo Updated!' : 'Complete Your Profile'}</h3>
              <p>{profileImage
                ? 'Your new profile picture has been uploaded successfully.'
                : 'Keep your profile up to date for a safer and smoother experience.'}</p>
              {profileImage && <span className="profile-photo-status"><Icon name="check" /> Profile photo saved</span>}
              {profileImageError && <span className="profile-photo-error" role="alert">{profileImageError}</span>}
            </div>
            <button type="button" className="cta-action" disabled={uploading} onClick={() => profileInputRef.current?.click()}>
              {uploading ? 'Saving...' : profileImage ? 'Change Photo' : 'Update Profile'} →
            </button>
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
      setState({ loading: false, error: null, status: 'approved', application: null, usage: null, transactions: [] })
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

        setState({ loading: false, error: null, status: data.status, application: data.application, usage: { ...data.usage, tier_thresholds: data.tierThresholds || [] }, transactions: data.transactions || [] })
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

