import { useState, type FormEvent } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { authApi } from '../../services/api'
import '../../pages/LoginPage.css'

export default function ForcePasswordChange() {
  const { user, refreshUser, logout } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (newPassword !== confirmPassword) {
      setError('Lozinke se ne podudaraju.')
      return
    }
    if (newPassword.length < 5) {
      setError('Lozinka mora imati najmanje 5 znakova.')
      return
    }

    setSubmitting(true)
    try {
      await authApi.changePassword(currentPassword, newPassword)
      await refreshUser()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Greška pri promjeni lozinke.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-bg-pattern" />
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <h1 className="login-title">Promjena lozinke</h1>
            <p className="login-subtitle">
              Dobrodošli, {user?.full_name}. Morate promijeniti lozinku prije nastavka.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            {error && (
              <div className="login-error" role="alert">
                <span>{error}</span>
              </div>
            )}

            <div className="login-field">
              <label>Trenutna lozinka</label>
              <div className="login-input-wrapper">
                <input
                  type="password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  required
                  disabled={submitting}
                  style={{ paddingLeft: '14px' }}
                />
              </div>
            </div>

            <div className="login-field">
              <label>Nova lozinka (min 5 znakova)</label>
              <div className="login-input-wrapper">
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  disabled={submitting}
                  style={{ paddingLeft: '14px' }}
                />
              </div>
            </div>

            <div className="login-field">
              <label>Potvrdi novu lozinku</label>
              <div className="login-input-wrapper">
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  disabled={submitting}
                  style={{ paddingLeft: '14px' }}
                />
              </div>
            </div>

            <button type="submit" className="login-submit" disabled={submitting}>
              {submitting ? 'Spremanje...' : 'Promijeni lozinku'}
            </button>

            <button
              type="button"
              className="login-submit"
              style={{ background: 'transparent', border: '1px solid rgba(148,163,184,0.2)', boxShadow: 'none', marginTop: '8px' }}
              onClick={logout}
            >
              Odjavi se
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
