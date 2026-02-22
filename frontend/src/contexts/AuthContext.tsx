import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react'
import { authApi, type AuthUser } from '../services/api'

interface AuthState {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
}

interface AuthContextValue extends AuthState {
  login: (username: string, password: string, rememberMe?: boolean) => Promise<AuthUser>
  logout: () => Promise<void>
  hasPermission: (permission: string) => boolean
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  })
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    refreshTimerRef.current = setTimeout(async () => {
      try {
        await authApi.refresh()
        scheduleRefresh()
      } catch {
        setState({ user: null, isAuthenticated: false, isLoading: false })
      }
    }, 25 * 60 * 1000) // 25 min (before 30 min expiry)
  }, [])

  const refreshUser = useCallback(async () => {
    try {
      const user = await authApi.me()
      setState({ user, isAuthenticated: true, isLoading: false })
      scheduleRefresh()
    } catch {
      setState({ user: null, isAuthenticated: false, isLoading: false })
    }
  }, [scheduleRefresh])

  // Initial auth check on mount
  useEffect(() => {
    refreshUser()
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    }
  }, [refreshUser])

  // Listen for 401 events from API
  useEffect(() => {
    const handler = () => {
      setState({ user: null, isAuthenticated: false, isLoading: false })
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    }
    window.addEventListener('auth:unauthorized', handler)
    return () => window.removeEventListener('auth:unauthorized', handler)
  }, [])

  const login = useCallback(
    async (username: string, password: string, rememberMe = false) => {
      const resp = await authApi.login(username, password, rememberMe)
      setState({ user: resp.user, isAuthenticated: true, isLoading: false })
      scheduleRefresh()
      return resp.user
    },
    [scheduleRefresh]
  )

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch {
      // Ignore logout errors
    }
    setState({ user: null, isAuthenticated: false, isLoading: false })
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
  }, [])

  const hasPermission = useCallback(
    (permission: string) => {
      if (!state.user) return false
      if (state.user.role === 'Admin') return true
      return state.user.permissions.includes(permission)
    },
    [state.user]
  )

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        logout,
        hasPermission,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
