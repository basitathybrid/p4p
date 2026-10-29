import { useEffect, useRef, useState } from 'react'
import config from '../../config'
import { useProfilePicture } from '../../useProfilePicture'
import { Icon } from '../ui/Icon'

const ACCOUNT_CONFIG = {
  customer: {
    profileUrl: config.REST_API.Customer.Profile,
    tokenKey: 'p4p_customer_token',
    profilePath: 'profile',
    saveUrl: config.REST_API.Customer.Profile,
  },
  supervisor: {
    profileUrl: config.REST_API.Supervisor.Profile,
    tokenKey: 'p4p_supervisor_token',
    profilePath: 'profile',
    saveUrl: config.REST_API.Supervisor.Profile,
  },
  basic: {
    profileUrl: config.REST_API.Basic.Profile,
    tokenKey: 'p4p_basic_token',
    profilePath: 'profile',
    saveUrl: config.REST_API.Basic.Profile,
  },
}

export function AccountSettings({ role, onProfileChange, displayUser }) {
  const account = ACCOUNT_CONFIG[role]
  const [form, setForm] = useState(() => ({
    name: displayUser.name || '',
    email: displayUser.email || '',
  }))
  const [profileDirty, setProfileDirty] = useState(false)
  const [loading, setLoading] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileStatus, setProfileStatus] = useState({ type: 'idle', message: '' })
  const [password, setPassword] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' })
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordStatus, setPasswordStatus] = useState({ type: 'idle', message: '' })
  const fileInputRef = useRef(null)
  const { profileImage, uploadProfilePicture, uploading, error: pictureError } = useProfilePicture(role)

  useEffect(() => {
    if (profileDirty) return
    setForm((current) => ({
      name: displayUser.name || current.name,
      email: displayUser.email || current.email,
    }))
  }, [displayUser.name, displayUser.email, profileDirty])

  useEffect(() => {
    if (!account.profileUrl) {
      setLoading(false)
      return undefined
    }

    const controller = new AbortController()
    const token = localStorage.getItem(account.tokenKey)

    async function loadProfile() {
      try {
        const response = await fetch(account.profileUrl, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.message || 'Unable to load account settings.')
        const profile = data[account.profilePath]
        if (!profile) throw new Error('Account profile was not returned.')
        setForm({ name: profile.name || '', email: profile.email || '' })
      } catch (error) {
        if (!controller.signal.aborted) {
          setProfileStatus({ type: 'error', message: error.message || 'Unable to load account settings.' })
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    loadProfile()
    return () => controller.abort()
  }, [account])

  const handleProfileSubmit = async (event) => {
    event.preventDefault()
    setProfileStatus({ type: 'idle', message: '' })
    const name = form.name.trim()
    const email = form.email.trim()
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setProfileStatus({ type: 'error', message: 'Enter your name and a valid email address.' })
      return
    }

    setSavingProfile(true)
    try {
      const response = await fetch(account.saveUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem(account.tokenKey)}`,
        },
        body: JSON.stringify({ name, email }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Unable to save profile changes.')
      const profile = data.profile
      setForm({ name: profile.name, email: profile.email })
      setProfileDirty(false)
      onProfileChange(profile)
      if (role === 'supervisor' || role === 'basic') {
        if (data.token) localStorage.setItem(account.tokenKey, data.token)
        localStorage.setItem(`p4p_${role}_name`, profile.name)
        localStorage.setItem(`p4p_${role}_email`, profile.email)
      }
      setProfileStatus({ type: 'success', message: 'Profile details updated.' })
    } catch (error) {
      setProfileStatus({ type: 'error', message: error.message || 'Unable to save profile changes.' })
    } finally {
      setSavingProfile(false)
    }
  }

  const handlePasswordSubmit = async (event) => {
    event.preventDefault()
    setPasswordStatus({ type: 'idle', message: '' })
    if (!password.oldPassword || !password.newPassword || !password.confirmPassword) {
      setPasswordStatus({ type: 'error', message: 'Complete all password fields.' })
      return
    }
    if (password.newPassword.length < 8) {
      setPasswordStatus({ type: 'error', message: 'New password must be at least 8 characters.' })
      return
    }
    if (password.newPassword !== password.confirmPassword) {
      setPasswordStatus({ type: 'error', message: 'New passwords do not match.' })
      return
    }

    setSavingPassword(true)
    try {
      const response = await fetch(config.REST_API.Auth.ChangePassword, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem(account.tokenKey)}`,
        },
        body: JSON.stringify({ oldPassword: password.oldPassword, newPassword: password.newPassword }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Unable to change password.')
      setPassword({ oldPassword: '', newPassword: '', confirmPassword: '' })
      setPasswordStatus({ type: 'success', message: data.message || 'Password updated successfully.' })
    } catch (error) {
      setPasswordStatus({ type: 'error', message: error.message || 'Unable to change password.' })
    } finally {
      setSavingPassword(false)
    }
  }

  const handlePictureChange = async (event) => {
    const file = event.target.files?.[0]
    if (file) await uploadProfilePicture(file)
    event.target.value = ''
  }

  return (
    <section className="account-settings-page">
      <header className="account-settings-heading">
        <div>
          <p className="eyebrow">Account</p>
          <h1>Settings</h1>
          <p>Manage your profile, picture, and password.</p>
        </div>
      </header>

      <section className="account-settings-card">
        <div className="account-settings-card-heading">
          <div className="account-settings-avatar">
            {profileImage ? <img src={profileImage} alt="Your profile" /> : <Icon name="user" />}
          </div>
          <div>
            <h2>Profile picture</h2>
            <p>JPEG, PNG, or WebP up to 5 MB.</p>
          </div>
          <input
            ref={fileInputRef}
            className="account-settings-file"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-label="Choose profile picture"
            onChange={handlePictureChange}
          />
          <button
            className="edit-btn"
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? 'Uploading...' : 'Change picture'}
          </button>
        </div>
        {pictureError && <div className="status-banner error">{pictureError}</div>}
      </section>

      {account.saveUrl && (
      <section className="account-settings-card">
        <div className="account-settings-card-title">
          <h2>Personal information</h2>
          <p>Update the name and email address associated with your account.</p>
        </div>
        {profileStatus.message && <div className={`status-banner ${profileStatus.type}`}>{profileStatus.message}</div>}
        <form className="account-settings-form" onSubmit={handleProfileSubmit}>
          <label>
            Name
            <input
              autoComplete="name"
              maxLength="255"
              value={form.name}
              onChange={(event) => {
                setProfileDirty(true)
                setForm((current) => ({ ...current, name: event.target.value }))
              }}
              disabled={loading || savingProfile}
            />
          </label>
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              maxLength="255"
              value={form.email}
              onChange={(event) => {
                setProfileDirty(true)
                setForm((current) => ({ ...current, email: event.target.value }))
              }}
              disabled={loading || savingProfile}
            />
          </label>
          <button className="edit-btn" type="submit" disabled={loading || savingProfile}>
            {loading ? 'Loading...' : savingProfile ? 'Saving...' : 'Save profile'}
          </button>
        </form>
      </section>
      )}

      <section className="account-settings-card">
        <div className="account-settings-card-title">
          <h2>Change password</h2>
          <p>Choose a new password with at least 8 characters.</p>
        </div>
        {passwordStatus.message && <div className={`status-banner ${passwordStatus.type}`}>{passwordStatus.message}</div>}
        <form className="account-settings-form" onSubmit={handlePasswordSubmit}>
          <label>
            Current password
            <input
              type="password"
              autoComplete="current-password"
              value={password.oldPassword}
              onChange={(event) => setPassword((current) => ({ ...current, oldPassword: event.target.value }))}
              disabled={savingPassword}
            />
          </label>
          <label>
            New password
            <input
              type="password"
              autoComplete="new-password"
              value={password.newPassword}
              onChange={(event) => setPassword((current) => ({ ...current, newPassword: event.target.value }))}
              disabled={savingPassword}
            />
          </label>
          <label>
            Confirm new password
            <input
              type="password"
              autoComplete="new-password"
              value={password.confirmPassword}
              onChange={(event) => setPassword((current) => ({ ...current, confirmPassword: event.target.value }))}
              disabled={savingPassword}
            />
          </label>
          <button className="edit-btn" type="submit" disabled={savingPassword}>
            {savingPassword ? 'Updating...' : 'Update password'}
          </button>
        </form>
      </section>
    </section>
  )
}
