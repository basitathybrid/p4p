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
  const [displayUser, setDisplayUser] = useState(currentRole.user)
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
    navigate('/login')
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <img className="brand-logo" src={play4PerksLogo} alt="Play4Perks" />
        </div>

        <nav className="sidebar-nav">
          {currentRole.sidebar.map((item, index) => (
            <NavLink
              key={item}
              to={route === 'customer' ? '/customer' : route === 'basic' ? '/basic-user' : '/supervisor'}
              className={`nav-item ${index === 0 ? 'active' : ''}`}
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
                  <button className="toolbar-dropdown-item" onClick={handleLogout}>Logout</button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="content-area">{children}</div>
      </main>
    </div>
  )
}

export default AppLayout

