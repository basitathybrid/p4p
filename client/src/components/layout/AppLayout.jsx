import { NavLink } from 'react-router-dom'
import { Icon } from '../ui/Icon'
import roles from '../../data/roles'

export function AppLayout({ route, children }) {
  const currentRole = roles[route]

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-name">P4P</div>
          <div className="brand-sub">Play4Perks</div>
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
          <div className="mini-avatar">{currentRole.user.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</div>
          <div>
            <div className="mini-name">{currentRole.user.name}</div>
            <div className="mini-role">{currentRole.user.role}</div>
          </div>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div />

          <div className="topbar-actions">
            <button className="header-icon" aria-label="Notifications"><Icon name="bell" /></button>
            <div className="toolbar-user">
              <div className="toolbar-avatar">{currentRole.user.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</div>
              <div>
                <div className="toolbar-name">{currentRole.user.name}</div>
                <div className="toolbar-role">{currentRole.user.role}</div>
              </div>
            </div>
          </div>
        </header>

        <div className="content-area">{children}</div>
      </main>
    </div>
  )
}

export default AppLayout
