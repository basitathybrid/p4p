import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import config from '../../config'
import { Icon } from '../ui/Icon'
import play4PerksLogo from '../../assets/play4perks-logo.png'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const sanitizePhoneInput = (value) => {
  const normalized = String(value || '').trim()
  const digits = normalized.replace(/\D/g, '')

  if (!digits) return ''

  return normalized.startsWith('+') ? `+${digits}` : digits
}

export function CustomerLoginPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ identifier: '', password: '' })
  const [fieldErrors, setFieldErrors] = useState({})
  const [resetEmail, setResetEmail] = useState('')
  const [resetError, setResetError] = useState('')
  const [showPasswordReset, setShowPasswordReset] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [status, setStatus] = useState({ type: 'idle', message: '' })
  const [loading, setLoading] = useState(false)

  const handleChange = (event) => {
    const { name, value } = event.target
    const nextValue = name === 'identifier' ? sanitizePhoneInput(value) : value
    setForm((current) => ({ ...current, [name]: nextValue }))
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
    setStatus({ type: 'idle', message: '' })

    if (!resetEmail.trim()) {
      setResetError('This field is required.')
      return
    }

    if (!EMAIL_PATTERN.test(resetEmail.trim())) {
      setResetError('Enter a valid email address.')
      return
    }

    setResetError('')
    setLoading(true)

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
    } catch (error) {
      setStatus({ type: 'error', message: 'Unable to reset your password right now.' })
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
            <h1>Customer <span>Login</span></h1>
            <p className="customer-login-intro">Welcome back! Log in to access your account and keep earning rewards.</p>
          </div>
        </div>

        {status.message && (
          <div className={`status-banner ${status.type}`}>{status.message}</div>
        )}

        {showPasswordReset ? (
          <form onSubmit={handlePasswordReset} className="signup-form customer-login-form" noValidate>
            <label>
              Account Email Address
              <span className="login-input-wrap"><Icon name="mail" /><input type="email" value={resetEmail} onChange={(event) => { setResetEmail(event.target.value); if (resetError) setResetError('') }} placeholder="name@example.com" className={resetError ? 'input-error' : ''} /></span>
              {resetError && <span className="field-error-msg">{resetError}</span>}
            </label>
            <div className="signup-actions">
              <button type="submit" className="primary-btn" disabled={loading}>{loading ? 'Sending...' : 'Email Temporary Password'}</button>
              <button type="button" className="secondary-btn" onClick={() => { setShowPasswordReset(false); setStatus({ type: 'idle', message: '' }) }} disabled={loading}>Back to Login</button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="signup-form customer-login-form" noValidate>
            <div className="login-field">
              <label>
                Phone Number
                <span className="login-input-wrap"><Icon name="phone" /><input name="identifier" value={form.identifier} onChange={handleChange} placeholder="5551234567" className={fieldErrors.identifier ? 'input-error' : ''} /></span>
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
              <button type="button" className="link-btn" onClick={() => { setShowPasswordReset(true); setStatus({ type: 'idle', message: '' }) }}>Forgot password?</button>
            </div>
          </form>
        )}

        <div className="login-divider"><span>OR</span></div>
        <p className="otp-label login-signup-prompt">
          New here? <Link to="/signup">Create an account <Icon name="arrowRight" /></Link>
        </p>
        </section>
        <p className="login-bottom-copy">More<br />Than Just Play</p>
      </div>
    </main>
  )
}

export default CustomerLoginPage
