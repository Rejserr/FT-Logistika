import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import ForcePasswordChange from './ForcePasswordChange'

export default function ProtectedRoute() {
  const { user, isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="auth-loading">
        <div className="auth-loading-spinner" />
        <p>Učitavanje...</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // Force password change intercept
  if (user?.force_password_change) {
    return <ForcePasswordChange />
  }

  return <Outlet />
}
