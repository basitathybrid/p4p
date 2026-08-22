import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const emptyForm = {
  name: '',
  phone: '',
  email: '',
  password: '',
  confirmPassword: '',
  playerMobileId: '',
  playerId: '',
  facebook: '',
  instagram: '',
  telegram: '',
}

export function CustomerSignupPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [form, setForm] = useState(emptyForm)
  const [otpCode, setOtpCode] = useState('')
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
    setForm((current) => ({ ...current, [name]: value }))
  }

  const handleRequestOtp = async (event) => {
    event.preventDefault()
    setStatus({ type: 'idle', message: '' })

    if (form.password.length < 8) {
      setStatus({ type: 'error', message: 'Password must be at least 8 characters.' })
      return
    }

    if (form.password !== form.confirmPassword) {
      setStatus({ type: 'error', message: 'Passwords do not match.' })
      return
    }

    setLoading(true)

    try {
      const response = await fetch(`${API_BASE}/signup/request`, {
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
    setLoading(true)
    setStatus({ type: 'idle', message: '' })

    try {
      const response = await fetch(`${API_BASE}/signup/verify`, {
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
    setOtpCode('')
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
          <form onSubmit={handleRequestOtp} className="signup-form">
            <div className="field-row two-up">
              <label>
                Full Name
                <input name="name" value={form.name} onChange={handleChange} placeholder="Enter full name" required />
              </label>
              <label>
                Phone Number
                <input name="phone" value={form.phone} onChange={handleChange} placeholder="+1 (555) 123-4567" required />
              </label>
            </div>

            <div className="field-row two-up">
              <label>
                Player ID
                <input type="number" name="playerId" value={form.playerId} onChange={handleChange} placeholder="Enter numeric player ID" min="0" step="1" />
              </label>
              <div />
            </div>

            <div className="field-row two-up">
              <label>
                Email Address
                <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="name@example.com" required />
              </label>
              <label>
                Player Mobile ID
                <input name="playerMobileId" value={form.playerMobileId} onChange={handleChange} placeholder="Enter player mobile ID" required />
              </label>
            </div>

            <div className="field-row two-up">
              <label>
                Password
                <input type="password" name="password" value={form.password} onChange={handleChange} placeholder="At least 8 characters" required minLength={8} />
              </label>
              <label>
                Confirm Password
                <input type="password" name="confirmPassword" value={form.confirmPassword} onChange={handleChange} placeholder="Re-enter password" required minLength={8} />
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
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp} className="otp-form">
            <p className="otp-label">Enter the 6-digit OTP sent to {form.phone}</p>
            <input
              className="otp-input"
              inputMode="numeric"
              maxLength={6}
              value={otpCode}
              onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              required
            />
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
