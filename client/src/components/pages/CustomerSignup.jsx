import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import config from '../../config'

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
    <div className="signup-shell">
      <div className="signup-card">
        <div className="signup-header">
          <div>
            <p className="eyebrow">Customer Signup</p>
            <h1>Rewards Application</h1>
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
                <input name="name" value={form.name} onChange={handleChange} placeholder="Enter full name" className={fieldErrors.name ? 'input-error' : ''} />
                {fieldErrors.name && <span className="field-error-msg">{fieldErrors.name}</span>}
              </label>
              <label>
                Phone Number
                <input name="phone" value={form.phone} onChange={handleChange} placeholder="5551234567" className={fieldErrors.phone ? 'input-error' : ''} />
                {fieldErrors.phone && <span className="field-error-msg">{fieldErrors.phone}</span>}
              </label>
            </div>

            <div className="field-row two-up">
              <label>
                Email Address
                <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="name@example.com" className={fieldErrors.email ? 'input-error' : ''} />
                {fieldErrors.email && <span className="field-error-msg">{fieldErrors.email}</span>}
              </label>
              <label>
                Player Mobile ID
                <input name="playerMobileId" value={form.playerMobileId} onChange={handleChange} placeholder="e.g. M-665-778-889" className={fieldErrors.playerMobileId ? 'input-error' : ''} />
                {fieldErrors.playerMobileId && <span className="field-error-msg">{fieldErrors.playerMobileId}</span>}
              </label>
            </div>

            <div className="field-row two-up">
              <label>
                Password
                <input type="password" name="password" value={form.password} onChange={handleChange} placeholder="At least 8 characters" className={fieldErrors.password ? 'input-error' : ''} />
                {fieldErrors.password && <span className="field-error-msg">{fieldErrors.password}</span>}
              </label>
              <label>
                Confirm Password
                <input type="password" name="confirmPassword" value={form.confirmPassword} onChange={handleChange} placeholder="Re-enter password" className={fieldErrors.confirmPassword ? 'input-error' : ''} />
                {fieldErrors.confirmPassword && <span className="field-error-msg">{fieldErrors.confirmPassword}</span>}
              </label>
            </div>

            <div className="field-row two-up">
              <label>
                Facebook Link
                <input name="facebook" value={form.facebook} onChange={handleChange} placeholder="Optional" />
              </label>
              <label>
                Instagram Handle
                <input name="instagram" value={form.instagram} onChange={handleChange} placeholder="Optional" />
              </label>
            </div>

            <div className="field-row two-up">
              <label>
                Telegram ID
                <input name="telegram" value={form.telegram} onChange={handleChange} placeholder="Optional" />
              </label>
              <div />
            </div>

            <div className="signup-actions">
              <button type="submit" className="primary-btn" disabled={loading}>
                {loading ? 'Sending OTP...' : 'Send SMS OTP'}
              </button>
            </div>
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
      </div>
    </div>
  )
}

export default CustomerSignupPage
