import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import config from '../../config'
import play4PerksLogo from '../../assets/play4perks-logo.png'
import { Icon } from '../ui/Icon'

const emptyForm = {
  name: '',
  phone: '',
  email: '',
  password: '',
  confirmPassword: '',
  playerMobileId: '',
  facebook: '',
  instagram: '',
  telegram: '',
}

const sanitizePhoneInput = (value) => {
  const normalized = String(value || '').trim()
  const digits = normalized.replace(/\D/g, '')

  if (!digits) return ''

  return normalized.startsWith('+') ? `+${digits}` : digits
}

const REQUIRED_SIGNUP_FIELDS = ['name', 'phone', 'email', 'playerMobileId', 'password', 'confirmPassword']

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Letters, spaces, apostrophes, hyphens and periods only (no digits or symbols)
const NAME_PATTERN = /^[A-Za-z][A-Za-z '.-]*$/

// Accepts a 10-digit US number, optionally prefixed with 1 or +1
const US_PHONE_PATTERN = /^(\+?1)?\d{10}$/

// Accepts M-665-778-889 format, letter M is case-insensitive
const PLAYER_MOBILE_ID_PATTERN = /^[Mm]-\d{3}-\d{3}-\d{3}$/

const validateSignupForm = (form) => {
  const errors = {}

  REQUIRED_SIGNUP_FIELDS.forEach((field) => {
    if (!String(form[field] || '').trim()) {
      errors[field] = 'This field is required.'
    }
  })

  if (!errors.name && !NAME_PATTERN.test(form.name.trim())) {
    errors.name = 'Enter a valid name using letters only.'
  }

  if (!errors.phone && !US_PHONE_PATTERN.test(form.phone.trim())) {
    errors.phone = 'Enter a valid US phone number.'
  }

  if (!errors.playerMobileId && !PLAYER_MOBILE_ID_PATTERN.test(form.playerMobileId.trim())) {
    errors.playerMobileId = 'Enter a valid player mobile ID, e.g. M-665-778-889.'
  }

  if (!errors.email && !EMAIL_PATTERN.test(form.email.trim())) {
    errors.email = 'Enter a valid email address.'
  }

  if (!errors.password && form.password.length < 8) {
    errors.password = 'Password must be at least 8 characters.'
  }

  if (!errors.confirmPassword && !errors.password && form.password !== form.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.'
  }

  return errors
}

export function CustomerSignupPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [form, setForm] = useState(emptyForm)
  const [fieldErrors, setFieldErrors] = useState({})
  const [otpCode, setOtpCode] = useState('')
  const [showPasswords, setShowPasswords] = useState({ password: false, confirmPassword: false })
  const [otpError, setOtpError] = useState('')
  const [step, setStep] = useState('form')
  const [status, setStatus] = useState({ type: 'idle', message: '' })
  const [loading, setLoading] = useState(false)
  const [lockoutRemaining, setLockoutRemaining] = useState(location.state?.locked ? location.state.retryAfterSeconds || 1800 : 0)

  useEffect(() => {
    if (location.state?.locked) {
      setStep('locked')
      setStatus({ type: 'error', message: 'Signup is temporarily locked after too many incorrect OTP attempts.' })
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [location.state])

  useEffect(() => {
    if (step !== 'locked' || lockoutRemaining <= 0) return undefined

    const timer = setInterval(() => {
      setLockoutRemaining((remaining) => Math.max(remaining - 1, 0))
    }, 1000)

    return () => clearInterval(timer)
  }, [step, lockoutRemaining])

  const handleChange = (event) => {
    const { name, value } = event.target
    const nextValue = name === 'phone' ? sanitizePhoneInput(value) : value
    setForm((current) => ({ ...current, [name]: nextValue }))
    setFieldErrors((current) => {
      if (!current[name]) return current
      const next = { ...current }
      delete next[name]
      return next
    })
  }

  const handleRequestOtp = async (event) => {
    event.preventDefault()
    setStatus({ type: 'idle', message: '' })

    const errors = validateSignupForm(form)
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setFieldErrors({})
    setLoading(true)

    try {
      const response = await fetch(config.REST_API.Signup.Request, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.code === 'SIGNUP_LOCKED') {
          setLockoutRemaining(data.retryAfterSeconds || 1800)
          setStatus({ type: 'error', message: data.message || 'Signup is temporarily locked after too many incorrect OTP attempts.' })
          setStep('locked')
          return
        }

        if (data.code === 'PHONE_EXISTS') {
          setStatus({ type: 'error', message: 'This phone number is already registered in P4P.' })
        } else {
          setStatus({ type: 'error', message: data.message || 'Unable to send OTP.' })
        }
        return
      }

      setStep('otp')
      setStatus({ type: 'success', message: 'A one-time passcode has been sent to your phone.' })
    } catch (error) {
      setStatus({ type: 'error', message: 'Something went wrong while requesting the OTP.' })
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (event) => {
    event.preventDefault()
    setStatus({ type: 'idle', message: '' })

    if (!otpCode.trim()) {
      setOtpError('This field is required.')
      return
    }

    setOtpError('')
    setLoading(true)

    try {
      const response = await fetch(config.REST_API.Signup.Verify, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: form.phone, otpCode }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.locked) {
          setLockoutRemaining(data.retryAfterSeconds || 1800)
          setStatus({ type: 'error', message: `Too many incorrect attempts. Please wait ${Math.ceil((data.retryAfterSeconds || 1800) / 60)} minutes before restarting signup.` })
          setStep('locked')
          return
        }

        setStatus({ type: 'error', message: data.message || 'The OTP is invalid.' })
        return
      }

      setStatus({ type: 'success', message: 'OTP verified. Your application is now pending review.' })
      setStep('success')
    } catch (error) {
      setStatus({ type: 'error', message: 'Unable to verify the OTP right now.' })
    } finally {
      setLoading(false)
    }
  }

  const startOver = () => {
    setForm(emptyForm)
    setFieldErrors({})
    setOtpCode('')
    setOtpError('')
    setStep('form')
    setLockoutRemaining(0)
    setStatus({ type: 'idle', message: '' })
  }

  return (
    <main className="customer-signup-shell">
      <div className="signup-light signup-light-one" />
      <div className="signup-light signup-light-two" />
      <div className="login-gift" aria-hidden="true"><span className="gift-bow" /><span className="gift-lid" /></div>
      <div className="signup-controller" aria-hidden="true" />
      <div className="customer-signup-content">
        <img className="customer-signup-logo" src={play4PerksLogo} alt="Play4Perks" />
        <p className="signup-tagline">PLAY MORE <span>EARN MORE</span></p>
        <p className="login-reward-copy">Real Players<br />Real Rewards</p>
        <section className="customer-signup-card">
        <div className="signup-header customer-signup-header">
          <div>
            <p className="eyebrow">Customer Signup</p>
            <h1>Rewards <span>Application</span></h1>
            <p className="customer-signup-intro">Create your account and start earning amazing rewards!</p>
          </div>
          <span className="phase-tag">2FA Required</span>
        </div>

        {status.message && (
          <div className={`status-banner ${status.type}`}>{status.message}</div>
        )}

        {step === 'form' && (
          <form onSubmit={handleRequestOtp} className="signup-form" noValidate>
            <div className="field-row two-up">
              <label>
                Full Name
                <span className="signup-input-wrap"><Icon name="user" /><input name="name" value={form.name} onChange={handleChange} placeholder="Enter full name" className={fieldErrors.name ? 'input-error' : ''} /></span>
                {fieldErrors.name && <span className="field-error-msg">{fieldErrors.name}</span>}
              </label>
              <label>
                Phone Number
                <span className="signup-input-wrap"><Icon name="phone" /><input name="phone" value={form.phone} onChange={handleChange} placeholder="5551234567" className={fieldErrors.phone ? 'input-error' : ''} /></span>
                {fieldErrors.phone && <span className="field-error-msg">{fieldErrors.phone}</span>}
              </label>
            </div>

            <div className="field-row two-up">
              <label>
                Email Address
                <span className="signup-input-wrap"><Icon name="mail" /><input type="email" name="email" value={form.email} onChange={handleChange} placeholder="name@example.com" className={fieldErrors.email ? 'input-error' : ''} /></span>
                {fieldErrors.email && <span className="field-error-msg">{fieldErrors.email}</span>}
              </label>
              <label>
                Player Mobile ID
                <span className="signup-input-wrap"><Icon name="gamepad" /><input name="playerMobileId" value={form.playerMobileId} onChange={handleChange} placeholder="e.g. M-665-778-889" className={fieldErrors.playerMobileId ? 'input-error' : ''} /></span>
                {fieldErrors.playerMobileId && <span className="field-error-msg">{fieldErrors.playerMobileId}</span>}
              </label>
            </div>

            <div className="field-row two-up">
              <label>
                Password
                <span className="signup-input-wrap"><Icon name="lock" /><input type={showPasswords.password ? 'text' : 'password'} name="password" value={form.password} onChange={handleChange} placeholder="At least 8 characters" className={fieldErrors.password ? 'input-error' : ''} /><button type="button" className="password-toggle" aria-label={showPasswords.password ? 'Hide password' : 'Show password'} onClick={() => setShowPasswords((current) => ({ ...current, password: !current.password }))}><Icon name={showPasswords.password ? 'eye' : 'eyeOff'} /></button></span>
                {fieldErrors.password && <span className="field-error-msg">{fieldErrors.password}</span>}
              </label>
              <label>
                Confirm Password
                <span className="signup-input-wrap"><Icon name="lock" /><input type={showPasswords.confirmPassword ? 'text' : 'password'} name="confirmPassword" value={form.confirmPassword} onChange={handleChange} placeholder="Re-enter password" className={fieldErrors.confirmPassword ? 'input-error' : ''} /><button type="button" className="password-toggle" aria-label={showPasswords.confirmPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPasswords((current) => ({ ...current, confirmPassword: !current.confirmPassword }))}><Icon name={showPasswords.confirmPassword ? 'eye' : 'eyeOff'} /></button></span>
                {fieldErrors.confirmPassword && <span className="field-error-msg">{fieldErrors.confirmPassword}</span>}
              </label>
            </div>

            <div className="field-row two-up">
              <label>
                Facebook Link
                <span className="signup-input-wrap"><Icon name="facebook" /><input name="facebook" value={form.facebook} onChange={handleChange} placeholder="Optional" /></span>
              </label>
              <label>
                Instagram Handle
                <span className="signup-input-wrap"><Icon name="instagram" /><input name="instagram" value={form.instagram} onChange={handleChange} placeholder="Optional" /></span>
              </label>
            </div>

            <div className="field-row two-up">
              <label>
                Telegram ID
                <span className="signup-input-wrap"><Icon name="telegram" /><input name="telegram" value={form.telegram} onChange={handleChange} placeholder="Optional" /></span>
              </label>
              <div />
            </div>

            <div className="signup-actions">
              <button type="submit" className="primary-btn" disabled={loading}>
                <Icon name="message" />
                <span>{loading ? 'Sending OTP...' : 'Send SMS OTP'}</span>
                <Icon name="arrowRight" />
              </button>
            </div>
            <div className="login-divider"><span>OR</span></div>
            <p className="otp-label">
              Already have an account? <Link to="/login">Go to Login</Link>
            </p>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp} className="otp-form" noValidate>
            <p className="otp-label">Enter the 6-digit OTP sent to {form.phone}</p>
            <input
              className={`otp-input${otpError ? ' input-error' : ''}`}
              inputMode="numeric"
              maxLength={6}
              value={otpCode}
              onChange={(event) => {
                setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))
                if (otpError) setOtpError('')
              }}
              placeholder="123456"
            />
            {otpError && <span className="field-error-msg">{otpError}</span>}
            <div className="signup-actions">
              <button type="submit" className="primary-btn" disabled={loading}>
                {loading ? 'Verifying...' : 'Verify OTP'}
              </button>
              <button type="button" className="secondary-btn" onClick={startOver}>Restart Signup</button>
            </div>
          </form>
        )}

        {step === 'locked' && (
          <div className="locked-state">
            <h2>Signup Locked</h2>
            <p>
              You have exceeded the OTP attempt limit. Please wait {Math.ceil(lockoutRemaining / 60)} minutes before restarting the signup flow.
            </p>
            <button type="button" className="primary-btn" onClick={() => navigate('/login')} disabled={lockoutRemaining > 0}>Restart</button>
          </div>
        )}

        {step === 'success' && (
          <div className="success-state">
            <h2>Application Submitted</h2>
            <p>Your signup has passed SMS verification and is now in Pending Review.</p>
            <button type="button" className="primary-btn" onClick={startOver}>Create Another Application</button>
            <Link to="/login" className="secondary-btn">Go to Login</Link>
          </div>
        )}
        </section>
        <div className="signup-feature-strip" aria-hidden="true">
          <div><span className="feature-mark">P</span><strong>PLAY</strong><small>Your Favorite Games</small></div>
          <div><span className="feature-mark">E</span><strong>EARN</strong><small>Exclusive Rewards</small></div>
          <div><span className="feature-mark">R</span><strong>REDEEM</strong><small>Real Perks</small></div>
        </div>
        <p className="login-bottom-copy">More<br />Than Just Play</p>
      </div>
    </main>
  )
}

export default CustomerSignupPage
