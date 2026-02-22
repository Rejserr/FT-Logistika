import { type ReactNode } from 'react'
import { useAuth } from '../../contexts/AuthContext'

interface RoleGateProps {
  permission?: string
  permissions?: string[]
  requireAll?: boolean
  roles?: string[]
  children: ReactNode
  fallback?: ReactNode
}

/**
 * Conditionally renders children based on user permissions or roles.
 *
 * Usage:
 *   <RoleGate permission="orders.edit">...</RoleGate>
 *   <RoleGate permissions={["orders.view", "orders.edit"]} requireAll>...</RoleGate>
 *   <RoleGate roles={["Admin", "Disponent"]}>...</RoleGate>
 */
export default function RoleGate({
  permission,
  permissions,
  requireAll = false,
  roles,
  children,
  fallback = null,
}: RoleGateProps) {
  const { user, hasPermission } = useAuth()

  if (!user) return <>{fallback}</>

  // Check roles
  if (roles && roles.length > 0) {
    if (!user.role || !roles.includes(user.role)) {
      return <>{fallback}</>
    }
  }

  // Check single permission
  if (permission) {
    if (!hasPermission(permission)) return <>{fallback}</>
  }

  // Check multiple permissions
  if (permissions && permissions.length > 0) {
    const check = requireAll
      ? permissions.every(p => hasPermission(p))
      : permissions.some(p => hasPermission(p))
    if (!check) return <>{fallback}</>
  }

  return <>{children}</>
}
