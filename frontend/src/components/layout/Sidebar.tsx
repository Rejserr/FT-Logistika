import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import './Sidebar.css'

const navItems = [
  { path: '/', label: 'Dashboard', icon: '📊', permission: null },
  { path: '/routing', label: 'Nova ruta', icon: '➕', permission: 'routes.create' },
  { path: '/routes', label: 'Rute', icon: '🗺️', permission: 'routes.view' },
  { path: '/orders', label: 'Nalozi', icon: '📦', permission: 'orders.view' },
  { path: '/artikli', label: 'Artikli', icon: '📦', permission: 'orders.view' },
  { path: '/artikli-grupe', label: 'Grupe artikala', icon: '🗂️', permission: 'orders.view' },
  { path: '/pod', label: 'POD', icon: '📋', permission: 'routes.view' },
  { path: '/vehicles', label: 'Vozila', icon: '🚚', permission: 'vehicles.view' },
  { path: '/regions', label: 'Regije', icon: '📍', permission: 'settings.view' },
  { path: '/settings', label: 'Postavke', icon: '⚙️', permission: 'settings.view' },
  { path: '/warehouses', label: 'Skladišta', icon: '🏭', permission: 'warehouses.view' },
  { path: '/audit', label: 'Audit Log', icon: '📋', permission: 'audit.view' },
  { path: '/users', label: 'Korisnici', icon: '👥', permission: 'users.view' },
  { path: '/roles', label: 'Role', icon: '🛡️', permission: 'users.manage_roles' },
]

export default function Sidebar() {
  const { user, logout, hasPermission } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  const visibleItems = navItems.filter(
    item => !item.permission || hasPermission(item.permission)
  )

  const roleBadge = user?.role ? (
    <span className={`role-badge role-${user.role.toLowerCase()}`}>
      {user.role}
    </span>
  ) : null

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-icon">🚛</span>
        <span className="brand-text">FT-Logistika</span>
      </div>

      <nav className="sidebar-nav">
        {visibleItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `nav-item ${isActive ? 'is-active' : ''}`
            }
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="user-info">
          <span className="user-avatar">👤</span>
          <div className="user-details">
            <span className="user-name">{user?.full_name || 'Korisnik'}</span>
            {roleBadge}
          </div>
        </div>
        <button className="logout-btn" onClick={handleLogout} title="Odjava">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>
    </aside>
  )
}
