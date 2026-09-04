import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import config from '../../config'

export function CustomerLoginPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ identifier: '', password: '' })
  const [resetEmail, setResetEmail] = useState('')
  const [showPasswordReset, setShowPasswordReset] = useState(false)
  const [status, setStatus] = useState({ type: 'idle', message: '' })
  const [loading, setLoading] = useState(false)

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setStatus({ type: 'idle', message: '' })

    const payload = {
      identifier: form.identifier,
      password: form.password,
    }

    try {
      const response = await fetch(config.REST_API.Auth.Login, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.code === 'SIGNUP_LOCKED') {
          navigate('/signup', { state: { locked: true, retryAfterSeconds: data.retryAfterSeconds } })
          return
        }

        setStatus({ type: 'error', message: data.message || 'Login failed.' })
        return
      }

      localStorage.setItem('p4p_user_role', data.role)

      if (data.role === 'supervisor') {
        localStorage.setItem('p4p_supervisor_token', data.token)
        localStorage.setItem('p4p_supervisor_name', data.user?.name || 'Supervisor')
        navigate('/supervisor')
        return
      }

      localStorage.setItem('p4p_customer_token', data.token)
      localStorage.setItem('p4p_customer_phone', data.phone)
      navigate('/customer')
    } catch (error) {
      setStatus({ type: 'error', message: 'Something went wrong while logging in.' })
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordReset = async (event) => {
    event.preventDefault()
    setLoading(true)
    setStatus({ type: 'idle', message: '' })

    try {
      const response = await fetch(config.REST_API.Auth.ForgotPassword, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail }),
      })
      const data = await response.json()

      if (!response.ok) {
        setStatus({ type: 'error', message: data.message || 'Unable to reset your password.' })
        return
      }

      setStatus({ type: 'success', message: data.message })
      setShowPasswordReset(false)
    } catch (error) {
      setStatus({ type: 'error', message: 'Unable to reset your password right now.' })
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
            <h1>Login</h1>
          </div>
        </div>

        {status.message && (
          <div className={`status-banner ${status.type}`}>{status.message}</div>
        )}

        {showPasswordReset ? (
          <form onSubmit={handlePasswordReset} className="signup-form">
            <label>
              Account Email Address
              <input type="email" value={resetEmail} onChange={(event) => setResetEmail(event.target.value)} placeholder="name@example.com" required />
            </label>
            <div className="signup-actions">
              <button type="submit" className="primary-btn" disabled={loading}>{loading ? 'Sending...' : 'Email Temporary Password'}</button>
              <button type="button" className="secondary-btn" onClick={() => setShowPasswordReset(false)} disabled={loading}>Back to Login</button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="signup-form">
            <div className="field-row two-up">
              <label>
                Phone Number / Email
                <input name="identifier" value={form.identifier} onChange={handleChange} placeholder="Enter your phone number or email" required />
              </label>
              <label>
                Password
                <input type="password" name="password" value={form.password} onChange={handleChange} placeholder="Your password" required />
              </label>
            </div>

            <div className="signup-actions">
              <button type="submit" className="primary-btn" disabled={loading}>
                {loading ? 'Logging in...' : 'Log In'}
              </button>
              <button type="button" className="link-btn" onClick={() => setShowPasswordReset(true)}>Forgot password?</button>
            </div>
          </form>
        )}

        <p className="otp-label login-signup-prompt">
          New here? <Link to="/signup">Create an account</Link>
        </p>
      </div>
    </div>
  )
}

export default CustomerLoginPage
