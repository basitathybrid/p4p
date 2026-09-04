import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import config from '../../config'

export function SupervisorLoginPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ identifier: '', password: '' })
  const [fieldErrors, setFieldErrors] = useState({})
  const [status, setStatus] = useState({ type: 'idle', message: '' })
  const [loading, setLoading] = useState(false)

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    setFieldErrors((current) => {
      if (!current[name]) return current
      const next = { ...current }
      delete next[name]
      return next
    })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setStatus({ type: 'idle', message: '' })

    const errors = {}
    if (!form.identifier.trim()) errors.identifier = 'This field is required.'
    if (!form.password.trim()) errors.password = 'This field is required.'

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setFieldErrors({})
    setLoading(true)

    try {
      const response = await fetch(config.REST_API.Auth.Login, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: form.identifier, password: form.password }),
      })

      const data = await response.json()

      if (!response.ok || data.role !== 'supervisor') {
        setStatus({ type: 'error', message: data.message || 'Login failed.' })
        return
      }

      localStorage.setItem('p4p_user_role', data.role)
      localStorage.setItem('p4p_supervisor_token', data.token)
      localStorage.setItem('p4p_supervisor_name', data.user?.name || 'Supervisor')
      navigate('/supervisor')
    } catch (error) {
      setStatus({ type: 'error', message: 'Something went wrong while logging in.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="signup-shell">
      <div className="signup-card">
        <div className="signup-header">
          <div>
            <p className="eyebrow">P4P Account</p>
            <h1>Supervisor Login</h1>
          </div>
        </div>

        {status.message && (
          <div className={`status-banner ${status.type}`}>{status.message}</div>
        )}

        <form onSubmit={handleSubmit} className="signup-form" noValidate>
          <div className="field-row two-up">
            <label>
              Username or Email
              <input name="identifier" value={form.identifier} onChange={handleChange} placeholder="Enter your username or email" className={fieldErrors.identifier ? 'input-error' : ''} />
              {fieldErrors.identifier && <span className="field-error-msg">{fieldErrors.identifier}</span>}
            </label>
            <label>
              Password
              <input type="password" name="password" value={form.password} onChange={handleChange} placeholder="Your password" className={fieldErrors.password ? 'input-error' : ''} />
              {fieldErrors.password && <span className="field-error-msg">{fieldErrors.password}</span>}
            </label>
          </div>

          <div className="signup-actions">
            <button type="submit" className="primary-btn" disabled={loading}>
              {loading ? 'Logging in...' : 'Log In'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default SupervisorLoginPage
