import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import config from '../../config'
import { Icon } from '../ui/Icon'
import play4PerksLogo from '../../assets/play4perks-logo.png'

export function SupervisorLoginPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ identifier: '', password: '' })
  const [fieldErrors, setFieldErrors] = useState({})
  const [status, setStatus] = useState({ type: 'idle', message: '' })
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

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
        body: JSON.stringify({ identifier: form.identifier, password: form.password, portal: 'supervisor' }),
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
    <main className="customer-login-shell">
      <div className="login-glow login-glow-one" />
      <div className="login-glow login-glow-two" />
      <div className="login-lion-shadow" aria-hidden="true"><img src={play4PerksLogo} alt="" /></div>
      <div className="login-crown" aria-hidden="true">♕</div>
      <div className="login-gift" aria-hidden="true"><span className="gift-bow" /><span className="gift-lid" /></div>
      <div className="login-controller" aria-hidden="true" />
      <div className="customer-login-content">
        <img className="customer-login-logo" src={play4PerksLogo} alt="Play4Perks" />
        <p className="login-tagline">PLAY MORE <span>EARN MORE</span></p>
        <p className="login-reward-copy">Real Players<br />Real Rewards</p>
        <section className="customer-login-card">
        <div className="signup-header customer-login-header">
          <div>
            <p className="eyebrow">P4P Account</p>
            <h1>Supervisor <span>Login</span></h1>
            <p className="customer-login-intro">Sign in to manage player rewards and approvals.</p>
          </div>
        </div>

        {status.message && (
          <div className={`status-banner ${status.type}`}>{status.message}</div>
        )}

        <form onSubmit={handleSubmit} className="signup-form customer-login-form" noValidate>
          <div className="login-field">
            <label>
              Username or Email
              <span className="login-input-wrap"><Icon name="user" /><input name="identifier" value={form.identifier} onChange={handleChange} placeholder="Enter your username or email" className={fieldErrors.identifier ? 'input-error' : ''} /></span>
              {fieldErrors.identifier && <span className="field-error-msg">{fieldErrors.identifier}</span>}
            </label>
          </div>
          <div className="login-field">
            <label>
              Password
              <span className="login-input-wrap"><Icon name="lock" /><input type={showPassword ? 'text' : 'password'} name="password" value={form.password} onChange={handleChange} placeholder="Your password" className={fieldErrors.password ? 'input-error' : ''} /><button type="button" className="password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((visible) => !visible)}><Icon name={showPassword ? 'eye' : 'eyeOff'} /></button></span>
              {fieldErrors.password && <span className="field-error-msg">{fieldErrors.password}</span>}
            </label>
          </div>

          <div className="signup-actions">
            <button type="submit" className="primary-btn" disabled={loading}>
              <span>{loading ? 'Logging in...' : 'Log In'}</span><Icon name="arrowRight" />
            </button>
          </div>
        </form>
        </section>
        <p className="login-bottom-copy">More<br />Than Just Play</p>
      </div>
    </main>
  )
}

export default SupervisorLoginPage
