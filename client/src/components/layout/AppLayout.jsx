import { useEffect, useRef, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Icon } from '../ui/Icon'
import roles from '../../data/roles'
import config from '../../config'
import play4PerksLogo from '../../assets/play4perks-logo.png'

export function AppLayout({ route, children }) {
  const currentRole = roles[route]
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [displayUser, setDisplayUser] = useState(currentRole.user)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [passwordForm, setPasswordForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' })
  const [passwordFieldErrors, setPasswordFieldErrors] = useState({})
  const [passwordStatus, setPasswordStatus] = useState({ type: 'idle', message: '' })
  const [changingPassword, setChangingPassword] = useState(false)
  const menuRef = useRef(null)

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
    setDisplayUser(currentRole.user)

    if (route === 'supervisor') {
      const name = localStorage.getItem('p4p_supervisor_name')
      if (name) setDisplayUser({ name, role: currentRole.user.role })
      return
    }

    const token = localStorage.getItem('p4p_customer_token')
    if (!token) return

    fetch(config.REST_API.Customer.Session, { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.application?.name) {
          setDisplayUser({ name: data.application.name, role: currentRole.user.role })
        }
      })
      .catch(() => {})
  }, [route, currentRole.user])

  const handleLogout = () => {
    localStorage.removeItem('p4p_user_role')
    localStorage.removeItem('p4p_supervisor_token')
    localStorage.removeItem('p4p_supervisor_name')
    localStorage.removeItem('p4p_customer_token')
    localStorage.removeItem('p4p_customer_phone')
    navigate(route === 'supervisor' ? '/supervisorlogin' : '/login')
  }

  const openChangePassword = () => {
    setMenuOpen(false)
    setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' })
    setPasswordFieldErrors({})
    setPasswordStatus({ type: 'idle', message: '' })
    setShowChangePassword(true)
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
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <img className="brand-logo" src={play4PerksLogo} alt="Play4Perks" />
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
          {currentRole.sidebar.map((item, index) => (
            <NavLink
              key={item}
              to={route === 'customer' ? '/customer' : route === 'basic' ? '/basic-user' : '/supervisor'}
              className={`nav-item ${index === 0 ? 'active' : ''}`}
              onClick={() => setMobileNavOpen(false)}
            >
              <span className="nav-icon"><Icon name={['dashboard', 'user', 'card', 'trophy', 'table', 'shield', 'info', 'bell'][index % 8]} /></span>
              {item}
            </NavLink>
          ))}
        </nav>

        <div className="earn-box">
          <div className="gift-emoji">🎁</div>
          <div className="earn-box-title">Earn more with Play4Perks!</div>
          <button>Learn More</button>
        </div>

        <div className="user-mini-profile">
          <div className="mini-avatar">{displayUser.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</div>
          <div>
            <div className="mini-name">{displayUser.name}</div>
            <div className="mini-role">{displayUser.role}</div>
          </div>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div />

          <div className="topbar-actions">
            <button className="header-icon" aria-label="Notifications"><Icon name="bell" /></button>
            <div className="toolbar-user-menu" ref={menuRef}>
              <button className="toolbar-user" onClick={() => setMenuOpen((open) => !open)}>
                <div className="toolbar-avatar">{displayUser.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</div>
                <div>
                  <div className="toolbar-name">{displayUser.name}</div>
                  <div className="toolbar-role">{displayUser.role}</div>
                </div>
                <span className="toolbar-chevron"><Icon name="chevron" /></span>
              </button>
              {menuOpen && (
                <div className="toolbar-dropdown">
                  <button className="toolbar-dropdown-item" onClick={openChangePassword}>Change Password</button>
                  <button className="toolbar-dropdown-item" onClick={handleLogout}>Logout</button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="content-area">{children}</div>
      </main>

      {showChangePassword && (
        <div className="modal-overlay" onClick={closeChangePassword}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>Change Password</h3>
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
                <input
                  type="password"
                  name="oldPassword"
                  value={passwordForm.oldPassword}
                  onChange={handlePasswordFieldChange}
                  placeholder="Enter current password"
                  className={passwordFieldErrors.oldPassword ? 'input-error' : ''}
                />
                {passwordFieldErrors.oldPassword && <span className="field-error-msg">{passwordFieldErrors.oldPassword}</span>}
              </label>
              <label>
                New Password
                <input
                  type="password"
                  name="newPassword"
                  value={passwordForm.newPassword}
                  onChange={handlePasswordFieldChange}
                  placeholder="At least 8 characters"
                  className={passwordFieldErrors.newPassword ? 'input-error' : ''}
                />
                {passwordFieldErrors.newPassword && <span className="field-error-msg">{passwordFieldErrors.newPassword}</span>}
              </label>
              <label>
                Confirm New Password
                <input
                  type="password"
                  name="confirmPassword"
                  value={passwordForm.confirmPassword}
                  onChange={handlePasswordFieldChange}
                  placeholder="Re-enter new password"
                  className={passwordFieldErrors.confirmPassword ? 'input-error' : ''}
                />
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

