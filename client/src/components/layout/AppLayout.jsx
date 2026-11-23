import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Icon } from '../ui/Icon'
import roles from '../../data/roles'
import config from '../../config'
import { useProfilePicture } from '../../useProfilePicture'
import { AccountSettings } from '../pages/AccountSettings'
import play4PerksLogo from '../../assets/play4perks-logo.png'
import moreThanJustPlay from '../../assets/more-than-just-play.png'

export function AppLayout({ route, children }) {
  const currentRole = roles[route]
  const location = useLocation()
  const navigate = useNavigate()
  const customerSidebar = [
    { label: 'Home', icon: 'home', to: '/customer' },
    { label: 'Transactions', icon: 'history', to: '/customer' },
    { label: 'Daily Missions', icon: 'spark', to: '/customer/missions' },
    { label: 'Claim Game Credit', icon: 'controller', to: '/customer' },
    { label: 'Birthday Freeplay', icon: 'gift', to: '/customer' },
    { label: 'My Profile', icon: 'user', to: '/customer' },
    { label: 'Settings', icon: 'settings', to: '/customer/settings' },
    { label: 'Chat With Us', icon: 'headset', to: '/customer' },
    { label: 'FAQ', icon: 'question', to: '/customer' },
  ]
  const supervisorSidebar = {
    Dashboard: 'dashboard',
    'Pending Approvals': 'pending',
    'Game credit requests': 'user',
    Transactions: 'money',
    'Game Credit Points': 'upload',
    'Tier Configuration': 'tier-config',
    'Daily Missions': 'spark',
    Reports: 'reports',
    'Audit Logs': 'audit',
    Settings: 'settings',
  }
  const supervisorPaths = {
    'Audit Logs': '/supervisor/audit-logs',
    Transactions: '/supervisor/transactions',
    'Tier Configuration': '/supervisor/tiers',
  }
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [displayUser, setDisplayUser] = useState(currentRole.user)
  const [pointsBalance, setPointsBalance] = useState(null)
  const { profileImage: toolbarProfileImage } = useProfilePicture(route)
  const [toolbarImageFailed, setToolbarImageFailed] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [passwordForm, setPasswordForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' })
  const [passwordFieldErrors, setPasswordFieldErrors] = useState({})
  const [passwordStatus, setPasswordStatus] = useState({ type: 'idle', message: '' })
  const [changingPassword, setChangingPassword] = useState(false)
  const [showPasswords, setShowPasswords] = useState({ oldPassword: false, newPassword: false, confirmPassword: false })
  const [notifications, setNotifications] = useState([])
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [notificationError, setNotificationError] = useState('')
  const menuRef = useRef(null)
  const notificationRef = useRef(null)

  const getAuthToken = () => route === 'supervisor'
    ? localStorage.getItem('p4p_supervisor_token')
    : route === 'basic'
      ? localStorage.getItem('p4p_basic_token')
      : localStorage.getItem('p4p_customer_token')

  useEffect(() => {
    setToolbarImageFailed(false)
  }, [toolbarProfileImage])

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    function handleClickOutside(event) {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setNotificationsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const token = getAuthToken()
    if (!token) return undefined

    const controller = new AbortController()
    const loadNotifications = () => fetch(config.REST_API.Notifications.List, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json().catch(() => null)
        if (!response.ok) throw new Error(data?.message || 'Unable to load notifications.')
        setNotifications(Array.isArray(data.notifications) ? data.notifications : [])
        setUnreadNotificationCount(Number(data.unreadCount) || 0)
        setNotificationError('')
      })
      .catch((error) => {
        if (!controller.signal.aborted) setNotificationError(error.message || 'Unable to load notifications.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setNotificationsLoading(false)
      })

    setNotificationsLoading(true)
    loadNotifications()
    const interval = window.setInterval(loadNotifications, 30000)
    return () => {
      controller.abort()
      window.clearInterval(interval)
    }
  }, [route, notificationsOpen, location.pathname, location.search])

  useEffect(() => {
    const nextDisplayUser = { ...currentRole.user }
    setPointsBalance(null)

    if (route === 'supervisor') {
      const name = localStorage.getItem('p4p_supervisor_name')
      const email = localStorage.getItem('p4p_supervisor_email')
      if (name) {
        nextDisplayUser.name = name
      }
      if (email) {
        nextDisplayUser.email = email
      } else {
        delete nextDisplayUser.email
      }
      setDisplayUser(nextDisplayUser)

      const token = localStorage.getItem('p4p_supervisor_token')
      if (token) {
        fetch(config.REST_API.Supervisor.Profile, {
          headers: { Authorization: 'Bearer ' + token },
        })
          .then((response) => {
            if (!response.ok) throw new Error('Unable to load supervisor email.')
            return response.json()
          })
          .then((data) => {
            if (!data?.profile) return
            const profile = data.profile
            if (profile.email) localStorage.setItem('p4p_supervisor_email', profile.email)
            setDisplayUser((current) => ({
              ...current,
              name: profile.name || current.name,
              email: profile.email || current.email,
            }))
          })
          .catch((error) => console.error('Unable to load supervisor email:', error))
      }
      return
    }

    if (route === 'basic') {
      const name = localStorage.getItem('p4p_basic_username')
      const email = localStorage.getItem('p4p_basic_email')
      if (name) {
        nextDisplayUser.name = name
      }
      if (email) {
        nextDisplayUser.email = email
      } else {
        delete nextDisplayUser.email
      }
      setDisplayUser(nextDisplayUser)
      return
    }

    const token = localStorage.getItem('p4p_customer_token')
    if (!token) {
      setDisplayUser(nextDisplayUser)
      return
    }

    fetch(config.REST_API.Customer.Session, { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        setPointsBalance(data ? Number(data.pointsBalance) || 0 : null)
        if (data?.application?.name) {
          setDisplayUser({
            name: data.application.name,
            role: currentRole.user.role,
            email: data.application.email || currentRole.user.email || 'ava.johnson@example.com',
            phone: data.application.phone || currentRole.user.phone,
          })
        } else {
          setDisplayUser(nextDisplayUser)
        }
      })
      .catch(() => setDisplayUser(nextDisplayUser))
  }, [route, currentRole.user])

  const handleLogout = () => {
    localStorage.removeItem('p4p_user_role')
    localStorage.removeItem('p4p_supervisor_token')
    localStorage.removeItem('p4p_supervisor_name')
    localStorage.removeItem('p4p_supervisor_email')
    localStorage.removeItem('p4p_customer_token')
    localStorage.removeItem('p4p_customer_phone')
    localStorage.removeItem('p4p_basic_token')
    localStorage.removeItem('p4p_basic_username')
    localStorage.removeItem('p4p_basic_email')
    navigate(route === 'supervisor' ? '/supervisorlogin' : route === 'basic' ? '/basicuserlogin' : '/login')
  }

  const handleNotificationToggle = () => {
    setNotificationsOpen((open) => !open)
  }

  const handleNotificationRead = async (notification) => {
    if (!notification.readAt) {
      const token = getAuthToken()

      try {
        const response = await fetch(config.REST_API.Notifications.MarkRead(notification.id), {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!response.ok) throw new Error('Unable to mark notification read.')
        setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item))
        setUnreadNotificationCount((count) => Math.max(0, count - 1))
        setNotificationError('')
      } catch (error) {
        setNotificationError(error.message)
      }
    }

    if (notification.actionUrl) {
      const target = notification.metadata?.approvalStatus === 'superseded'
        ? '/supervisor#pending-applications'
        : notification.actionUrl
      setNotificationsOpen(false)
      navigate(target)
    }
  }

  const handleMarkAllNotificationsRead = async () => {
    const token = getAuthToken()
    try {
      const response = await fetch(config.REST_API.Notifications.MarkAllRead, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) throw new Error('Unable to mark notifications read.')
      setNotifications((current) => current.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() })))
      setUnreadNotificationCount(0)
      setNotificationError('')
    } catch (error) {
      setNotificationError(error.message)
    }
  }

  const closeChangePassword = () => {
    setShowChangePassword(false)
  }

  const handlePasswordFieldChange = (event) => {
    const { name, value } = event.target
    setPasswordForm((current) => ({ ...current, [name]: value }))
    setPasswordFieldErrors((current) => {
      if (!current[name]) return current
      const next = { ...current }
      delete next[name]
      return next
    })
  }

  const handleChangePasswordSubmit = async (event) => {
    event.preventDefault()
    setPasswordStatus({ type: 'idle', message: '' })

    const errors = {}
    if (!passwordForm.oldPassword.trim()) errors.oldPassword = 'This field is required.'
    if (!passwordForm.newPassword.trim()) {
      errors.newPassword = 'This field is required.'
    } else if (passwordForm.newPassword.length < 8) {
      errors.newPassword = 'Password must be at least 8 characters.'
    }
    if (!passwordForm.confirmPassword.trim()) {
      errors.confirmPassword = 'This field is required.'
    } else if (!errors.newPassword && passwordForm.confirmPassword !== passwordForm.newPassword) {
      errors.confirmPassword = 'Passwords do not match.'
    }

    if (Object.keys(errors).length > 0) {
      setPasswordFieldErrors(errors)
      return
    }

    setPasswordFieldErrors({})
    setChangingPassword(true)

    const token = route === 'supervisor'
      ? localStorage.getItem('p4p_supervisor_token')
      : route === 'basic'
        ? localStorage.getItem('p4p_basic_token')
        : localStorage.getItem('p4p_customer_token')

    try {
      const response = await fetch(config.REST_API.Auth.ChangePassword, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ oldPassword: passwordForm.oldPassword, newPassword: passwordForm.newPassword }),
      })
      const data = await response.json()

      if (!response.ok) {
        setPasswordStatus({ type: 'error', message: data.message || 'Unable to change password.' })
        return
      }

      setPasswordStatus({ type: 'success', message: data.message || 'Password updated successfully.' })
      setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' })
    } catch (error) {
      setPasswordStatus({ type: 'error', message: 'Something went wrong while changing your password.' })
    } finally {
      setChangingPassword(false)
    }
  }

  return (
    <div className={`app-shell ${route === 'customer' ? 'customer-shell' : route === 'supervisor' ? 'supervisor-shell' : route === 'basic' ? 'basic-shell' : ''}`}>
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-stack">
            <div className="brand-mark">
              <img className="brand-logo" src={play4PerksLogo} alt="Play4Perks" />
            </div>
            <div className="brand-tagline">Play More Earn More</div>
          </div>
          <button
            type="button"
            className="mobile-nav-toggle"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen((open) => !open)}
          >
            <Icon name={mobileNavOpen ? 'x' : 'menu'} />
          </button>
        </div>

        <nav className={`sidebar-nav ${mobileNavOpen ? 'mobile-nav-open' : ''}`}>
          {(route === 'customer'
            ? customerSidebar
            : currentRole.sidebar.map((item, index) => ({
              label: index === 0 ? 'Home' : route === 'supervisor' && item === 'Transactions' ? 'Recent Transactions' : item,
              icon: index === 0 ? 'home' : supervisorSidebar[item] || 'info',
            to: route === 'supervisor' && supervisorPaths[item]
              ? supervisorPaths[item]
              : item === 'Settings'
              ? `${currentRole.path}/settings`
              : item === 'Daily Missions'
                ? `${currentRole.path}/missions`
                : currentRole.path,
            }))
          ).map((item) => {
            const isSettingsPage = location.pathname.endsWith('/settings')
            const isActive = isSettingsPage
              ? item.label === 'Settings'
              : location.pathname === item.to && (route !== 'supervisor' || item.to !== currentRole.path || item.label === 'Home')
            return (
              <NavLink
                key={item.label}
                to={item.to}
                end={item.label !== 'Settings'}
                className={`nav-item ${item.label === 'Game credit requests' ? 'nav-item-credit-requests' : ''} ${isActive ? 'active' : ''}`}
                onClick={() => setMobileNavOpen(false)}
              >
                <span className="nav-icon"><Icon name={item.icon} /></span>
                <span className="nav-label">{item.label}</span>
              </NavLink>
            )
          })}
        </nav>

        {route === 'supervisor' ? (
          <div className="p4p-sidebar-promo p4p-sidebar-promo-image-only">
            <img
              src={moreThanJustPlay}
              alt="More Than Just Play"
              className="p4p-sidebar-promo-image"
            />
          </div>
        ) : (
          <div className="p4p-sidebar-promo">
            <div className="p4p-sidebar-promo-stack">
              <img
                src={moreThanJustPlay}
                alt="More Than Just Play"
                className="p4p-sidebar-promo-image"
              />

              {route !== 'basic' && (
                <button type="button" className="p4p-promo-button">
                  <span>Play Now</span>
                  <span className="p4p-promo-arrow">→</span>
                </button>
              )}
            </div>
          </div>
        )}

        <button type="button" className="sidebar-logout" onClick={handleLogout}>
          <span className="logout-icon"><Icon name="logout" /></span>
          <span>Log Out</span>
        </button>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <button type="button" className="header-menu" aria-label="Open menu">
            <Icon name="menu" />
          </button>

          <div className="topbar-actions">
            <span className="notification-wrap" ref={notificationRef}>
              <button type="button" className="header-icon" aria-label="Notifications" aria-expanded={notificationsOpen} onClick={handleNotificationToggle}><Icon name="bell" /></button>
              {unreadNotificationCount > 0 && <span className="notification-badge">{unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}</span>}
              {notificationsOpen && (
                <div className="notifications-dropdown" role="dialog" aria-label="Notifications">
                  <div className="notifications-header">
                    <strong>Notifications</strong>
                    <button type="button" onClick={handleMarkAllNotificationsRead} disabled={unreadNotificationCount === 0}>Mark all read</button>
                  </div>
                  <div className="notifications-list">
                    {notificationError && <div className="notifications-empty" role="alert">{notificationError}</div>}
                    {notificationsLoading && <div className="notifications-empty">Loading notifications...</div>}
                    {!notificationsLoading && notifications.length === 0 && <div className="notifications-empty">You’re all caught up.</div>}
                    {!notificationsLoading && notifications.map((notification) => (
                      <button
                        type="button"
                        className={`notification-item ${notification.readAt ? 'read' : 'unread'}`}
                        key={notification.id}
                        onClick={() => handleNotificationRead(notification)}
                      >
                        <span className="notification-item-title">{notification.title}</span>
                        <span className="notification-item-message">{notification.metadata?.approvalStatus && notification.metadata.approvalStatus !== 'pending_review' ? 'This sign-up is no longer pending approval.' : notification.message}</span>
                        {notification.metadata?.approvalStatus && (
                          <span className="notification-item-date">{
                            { pending_review: 'Pending approval', approved: 'Approved', rejected: 'Rejected', superseded: 'Superseded by a later sign-up', unavailable: 'Application unavailable' }[notification.metadata.approvalStatus]
                          }</span>
                        )}
                        {notification.metadata?.actionLabel && (
                          <span className="notification-item-action">{notification.metadata.actionLabel} <Icon name="arrowRight" /></span>
                        )}
                        {notification.metadata?.effectiveDateLabel && (
                          <span className="notification-item-date">Effective {notification.metadata.effectiveDateLabel}</span>
                        )}
                        <span className="notification-item-date">{new Date(notification.createdAt).toLocaleString()}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </span>
            {route === 'customer' && (
              <div className="topbar-points-card" aria-label="My points">
                <span className="topbar-points-coin">$</span>
                <div><strong>{pointsBalance === null ? '—' : pointsBalance.toLocaleString()}</strong><small>My points</small></div>
              </div>
            )}
            <div className="toolbar-user-menu" ref={menuRef}>
              <button className="toolbar-user" onClick={() => setMenuOpen((open) => !open)}>
                <div className="toolbar-avatar">
                  {toolbarProfileImage && !toolbarImageFailed
                    ? <img src={toolbarProfileImage} alt="" onError={() => setToolbarImageFailed(true)} />
                    : displayUser.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}
                </div>
                <div className="toolbar-user-text">
                  <div className="toolbar-name">{displayUser.name}</div>
                  <div className="toolbar-role">{route === 'supervisor' ? displayUser.email : displayUser.email || displayUser.role}</div>
                </div>
                <span className="toolbar-chevron"><Icon name="chevron" /></span>
              </button>
              {menuOpen && (
                <div className="toolbar-dropdown">
                  <button className="toolbar-dropdown-item" onClick={handleLogout}>Logout</button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="content-area">
          {location.pathname.endsWith('/settings') && ['customer', 'supervisor', 'basic'].includes(route)
            ? (
              <AccountSettings
                role={route}
                displayUser={displayUser}
                onProfileChange={(profile) => setDisplayUser((current) => ({
                  ...current,
                  name: profile.name || current.name,
                  email: profile.email || current.email,
                }))}
              />
            )
            : children}
        </div>
      </main>

      {showChangePassword && (
        <div className="modal-overlay" onClick={closeChangePassword}>
          <div className="modal-card password-modal" role="dialog" aria-modal="true" aria-labelledby="password-modal-title" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3 id="password-modal-title">Change Password</h3>
              <button type="button" className="modal-close" aria-label="Close" onClick={closeChangePassword}>
                <Icon name="x" />
              </button>
            </div>

            {passwordStatus.message && (
              <div className={`status-banner ${passwordStatus.type}`}>{passwordStatus.message}</div>
            )}

            <form onSubmit={handleChangePasswordSubmit} className="signup-form" noValidate>
              <label>
                Current Password
                <span className="password-input-wrap">
                  <input
                    type={showPasswords.oldPassword ? 'text' : 'password'}
                    name="oldPassword"
                    autoComplete="current-password"
                    value={passwordForm.oldPassword}
                    onChange={handlePasswordFieldChange}
                    placeholder="Enter current password"
                    className={passwordFieldErrors.oldPassword ? 'input-error' : ''}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    aria-label={showPasswords.oldPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPasswords((current) => ({ ...current, oldPassword: !current.oldPassword }))}
                  >
                    <Icon name={showPasswords.oldPassword ? 'eye' : 'eyeOff'} />
                  </button>
                </span>
                {passwordFieldErrors.oldPassword && <span className="field-error-msg">{passwordFieldErrors.oldPassword}</span>}
              </label>
              <label>
                New Password
                <span className="password-input-wrap">
                  <input
                    type={showPasswords.newPassword ? 'text' : 'password'}
                    name="newPassword"
                    autoComplete="new-password"
                    value={passwordForm.newPassword}
                    onChange={handlePasswordFieldChange}
                    placeholder="At least 8 characters"
                    className={passwordFieldErrors.newPassword ? 'input-error' : ''}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    aria-label={showPasswords.newPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPasswords((current) => ({ ...current, newPassword: !current.newPassword }))}
                  >
                    <Icon name={showPasswords.newPassword ? 'eye' : 'eyeOff'} />
                  </button>
                </span>
                {passwordFieldErrors.newPassword && <span className="field-error-msg">{passwordFieldErrors.newPassword}</span>}
              </label>
              <label>
                Confirm New Password
                <span className="password-input-wrap">
                  <input
                    type={showPasswords.confirmPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    autoComplete="new-password"
                    value={passwordForm.confirmPassword}
                    onChange={handlePasswordFieldChange}
                    placeholder="Re-enter new password"
                    className={passwordFieldErrors.confirmPassword ? 'input-error' : ''}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    aria-label={showPasswords.confirmPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPasswords((current) => ({ ...current, confirmPassword: !current.confirmPassword }))}
                  >
                    <Icon name={showPasswords.confirmPassword ? 'eye' : 'eyeOff'} />
                  </button>
                </span>
                {passwordFieldErrors.confirmPassword && <span className="field-error-msg">{passwordFieldErrors.confirmPassword}</span>}
              </label>

              <div className="signup-actions">
                <button type="submit" className="primary-btn" disabled={changingPassword}>
                  {changingPassword ? 'Updating...' : 'Update Password'}
                </button>
                <button type="button" className="secondary-btn" onClick={closeChangePassword} disabled={changingPassword}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default AppLayout
