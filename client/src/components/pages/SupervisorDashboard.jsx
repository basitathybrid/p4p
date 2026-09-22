import { useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import roles, { tierMap } from '../../data/roles'
import config from '../../config'
import play4PerksLogo from '../../assets/play4perks-logo.png'
import goldenDragonImg from '../../assets/games/golden-dragon.png'
import magicCityImg from '../../assets/games/magic-city.png'
import ultraPandaImg from '../../assets/games/ultra-panda.png'
import vblinkImg from '../../assets/games/vblink.png'
import { AppLayout } from '../layout/AppLayout'
import { Icon, StatCard, StatusBadge } from '../ui/Icon'

const SUPERVISOR_HEADERS = () => ({
  'Content-Type': 'application/json',
  'x-user-role': 'supervisor',
  ...(localStorage.getItem('p4p_supervisor_token')
    ? { Authorization: `Bearer ${localStorage.getItem('p4p_supervisor_token')}` }
    : {}),
})

const SUPERVISOR_AUTH_HEADERS = () => ({
  ...(localStorage.getItem('p4p_supervisor_token')
    ? { Authorization: `Bearer ${localStorage.getItem('p4p_supervisor_token')}` }
    : {}),
})

const PROFILE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const PROFILE_IMAGE_MAX_SIZE = 5 * 1024 * 1024

const emptyDetails = {
  name: '',
  phone: '',
  email: '',
  playerMobileId: '',
  playerId: '',
  facebook: '',
  instagram: '',
  telegram: '',
  status: 'Pending Review',
}

const DEFAULT_THRESHOLDS = [
  { name: 'Bronze', minimum: 0 },
  { name: 'Silver', minimum: 5000 },
  { name: 'Gold', minimum: 10000 },
  { name: 'Diamond', minimum: 15000 },
]

function formatPhone(phone) {
  if (!phone) return ''
  if (phone.startsWith('+')) return phone
  const digits = phone.replace(/\D/g, '')
  return digits.length === 10 ? `+1${digits}` : `+${digits}`
}

function formatSubmittedAt(value) {
  if (!value) return 'Submitted recently'
  return `Submitted on ${new Date(value).toLocaleString()}`
}

function getInitials(name) {
  return String(name || 'Supervisor')
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'S'
}

const CSV_COLUMNS = [
  ['name', 'Name'],
  ['phone', 'Phone'],
  ['email', 'Email'],
  ['playerMobileId', 'Player Mobile ID'],
  ['playerId', 'Player ID'],
  ['facebook', 'Facebook'],
  ['instagram', 'Instagram'],
  ['telegram', 'Telegram'],
  ['status', 'Status'],
  ['reviewedAt', 'Reviewed At'],
]

function buildApprovedCustomersWorkbook(rows) {
  const headers = CSV_COLUMNS.map(([, label]) => label)
  const worksheetRows = rows.map((row) =>
    Object.fromEntries(CSV_COLUMNS.map(([key, label]) => [
      label,
      key === 'phone'
        ? Number(String(row[key] || '').replace(/\D/g, ''))
        : key === 'reviewedAt' && row[key]
          ? new Date(row[key]).toLocaleString()
          : row[key] ?? '',
    ])),
  )
  const worksheet = XLSX.utils.json_to_sheet(worksheetRows, { header: headers })

  worksheetRows.forEach((_, index) => {
    const cell = worksheet[XLSX.utils.encode_cell({ r: index + 1, c: 1 })]
    if (cell) cell.z = '0'
  })

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Approved Customers')
  return workbook
}

function SupervisorTable({ onStatusCountsChange }) {
  const [applications, setApplications] = useState([])
  const [approvedCustomers, setApprovedCustomers] = useState([])
  const [selectedPhone, setSelectedPhone] = useState('')
  const [form, setForm] = useState(emptyDetails)
  const [status, setStatus] = useState({ type: 'idle', message: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadStats, setUploadStats] = useState(roles.supervisor.upload)
  const [uploadStatus, setUploadStatus] = useState({ type: 'idle', message: '', details: [] })
  const [statusCounts, setStatusCounts] = useState({ submitted: 0, pendingReview: 0, decided: 0, active: 0 })
  const [thresholds, setThresholds] = useState(DEFAULT_THRESHOLDS)
  const [savingThresholds, setSavingThresholds] = useState(false)
  const [selectedTierCustomer, setSelectedTierCustomer] = useState('')
  const [selectedTier, setSelectedTier] = useState('Bronze')

  const selectedApplication = useMemo(
    () => applications.find((item) => item.phone === selectedPhone) || null,
    [applications, selectedPhone],
  )

  const playerIdError = useMemo(() => {
    if (!selectedApplication) return ''
    const raw = String(form.playerId || '').trim()
    if (!raw) return 'Player ID is required.'
    if (!/^\d{7}$/.test(raw) || Number(raw) <= 0) return 'Player ID must be a 7-digit number greater than 0.'
    return ''
  }, [selectedApplication, form.playerId])

  const missingRequiredFields = Boolean(selectedApplication) &&
    (Boolean(playerIdError) || !String(form.playerMobileId || '').trim())

  const missingApprovalFields = missingRequiredFields

  const loadApplications = async (preferredPhone) => {
    setLoading(true)

    try {
      const response = await fetch(config.REST_API.Review.Applications, {
        headers: SUPERVISOR_HEADERS(),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Unable to load applications.')
      }

      const allApplications = data.applications || []
      const pendingApplications = allApplications.filter((item) => item.status === 'pending_review')

      setApplications(pendingApplications)
      setApprovedCustomers(allApplications.filter((item) => item.status === 'approved'))
      const nextStatusCounts = {
        submitted: allApplications.length,
        pendingReview: pendingApplications.length,
        decided: allApplications.filter((item) => item.status === 'approved' || item.status === 'rejected').length,
        active: allApplications.filter((item) => item.status === 'approved').length,
      }
      setStatusCounts(nextStatusCounts)
      onStatusCountsChange(nextStatusCounts)

      const nextSelectedPhone = preferredPhone && pendingApplications.some((item) => item.phone === preferredPhone)
        ? preferredPhone
        : pendingApplications[0]?.phone || ''

      setSelectedPhone(nextSelectedPhone)
      setStatus({ type: 'idle', message: '' })
    } catch (error) {
      setApplications([])
      onStatusCountsChange({ submitted: 0, pendingReview: 0, decided: 0, active: 0 })
      setStatusCounts({ submitted: 0, pendingReview: 0, decided: 0, active: 0 })
      setSelectedPhone('')
      setStatus({ type: 'error', message: error.message || 'Unable to load pending applications.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadApplications()
  }, [])

  useEffect(() => {
    fetch(config.REST_API.Tiers.Thresholds, { headers: SUPERVISOR_HEADERS() })
      .then((response) => response.json())
      .then((data) => { if (data.success) setThresholds(data.thresholds) })
      .catch(() => {})
  }, [])

  const saveThresholds = async () => {
    setSavingThresholds(true)
    try {
      const response = await fetch(config.REST_API.Tiers.Thresholds, {
        method: 'PUT',
        headers: SUPERVISOR_HEADERS(),
        body: JSON.stringify({ thresholds }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Unable to save tier thresholds.')
      setStatus({ type: 'success', message: 'Tier thresholds updated.' })
    } catch (error) {
      setStatus({ type: 'error', message: error.message })
    } finally {
      setSavingThresholds(false)
    }
  }

  const updateCustomerTier = async () => {
    if (!selectedTierCustomer) return
    try {
      const response = await fetch(config.REST_API.Tiers.CustomerTier(selectedTierCustomer), {
        method: 'POST',
        headers: SUPERVISOR_HEADERS(),
        body: JSON.stringify({ tier: selectedTier }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Unable to update customer tier.')
      setStatus({ type: 'success', message: 'Customer tier updated.' })
    } catch (error) {
      setStatus({ type: 'error', message: error.message })
    }
  }

  useEffect(() => {
    if (!selectedApplication) {
      setForm(emptyDetails)
      return
    }

    setForm({
      name: selectedApplication.name || '',
      phone: formatPhone(selectedApplication.phone),
      email: selectedApplication.email || '',
      playerMobileId: selectedApplication.playerMobileId || '',
      playerId: selectedApplication.playerId || '',
      facebook: selectedApplication.facebook || '',
      instagram: selectedApplication.instagram || '',
      telegram: selectedApplication.telegram || '',
      status: selectedApplication.status === 'pending_review' ? 'Pending Review' : selectedApplication.status,
    })
  }, [selectedApplication])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const saveApplicationDetails = async (phone) => {
    const response = await fetch(config.REST_API.Review.GetApplicationByPhone(phone), {
      method: 'PATCH',
      headers: SUPERVISOR_HEADERS(),
      body: JSON.stringify({
        name: form.name,
        email: form.email,
        playerMobileId: form.playerMobileId,
        playerId: form.playerId,
        facebook: form.facebook,
        instagram: form.instagram,
        telegram: form.telegram,
      }),
    })
    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || 'Unable to save application changes.')
    }

    return data
  }

  const handleDecision = async (decision) => {
    if (!selectedApplication) return

    if (decision === 'approved' && missingApprovalFields) {
      setStatus({
        type: 'error',
        message: 'Player ID and Player Mobile ID are required before an application can be approved.',
      })
      return
    }

    setSaving(true)
    setStatus({ type: 'idle', message: '' })

    try {
      // Persist any edits the supervisor made before recording the decision.
      await saveApplicationDetails(selectedApplication.phone)

      const response = await fetch(config.REST_API.Review.SubmitDecision(selectedApplication.phone), {
        method: 'POST',
        headers: SUPERVISOR_HEADERS(),
        body: JSON.stringify({
          decision,
          reviewer: roles.supervisor.user.name,
        }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || `Unable to mark application ${decision}.`)
      }

      await loadApplications()
      setStatus({ type: 'success', message: `Application ${decision}. SMS notification ${data.sms?.mode === 'twilio' ? 'sent' : 'mocked'}.` })
    } catch (error) {
      setStatus({ type: 'error', message: error.message || `Unable to mark application ${decision}.` })
    } finally {
      setSaving(false)
    }
  }

  const handleExportApproved = async () => {
    setExporting(true)
    setStatus({ type: 'idle', message: '' })

    try {
      const response = await fetch(`${config.REST_API.Review.Applications}?status=approved`, {
        headers: SUPERVISOR_HEADERS(),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Unable to load approved applications.')
      }

      const approvedApplications = data.applications || []

      if (approvedApplications.length === 0) {
        setStatus({ type: 'error', message: 'No approved applications to export.' })
        return
      }

      const timestamp = new Date().toISOString().slice(0, 10)
      const workbook = buildApprovedCustomersWorkbook(approvedApplications)
      XLSX.writeFile(workbook, `approved-customers-${timestamp}.xlsx`)
      setStatus({ type: 'success', message: `Exported ${approvedApplications.length} approved customer(s).` })
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'Unable to export approved applications.' })
    } finally {
      setExporting(false)
    }
  }

  const handleTransactionUpload = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setUploading(true)
    setUploadStatus({ type: 'idle', message: '', details: [] })

    try {
      const isExcel = /\.(xlsx|xls)$/i.test(file.name)
      const workbook = isExcel ? XLSX.read(await file.arrayBuffer(), { type: 'array' }) : null
      const csv = isExcel
        ? XLSX.utils.sheet_to_csv(workbook.Sheets[workbook.SheetNames[0]])
        : await file.text()
      const response = await fetch(config.REST_API.Uploads.Transactions, {
        method: 'POST',
        headers: { ...SUPERVISOR_HEADERS(), 'Content-Type': 'text/csv' },
        body: csv,
      })
      const data = await response.json()

      if (!response.ok) {
        setUploadStatus({
          type: 'error',
          message: data.message || 'Unable to process transaction upload.',
          details: data.code === 'INVALID_HEADERS'
            ? [`Required columns: ${data.expectedHeaders.join(', ')}.`, `Columns found: ${data.receivedHeaders.length ? data.receivedHeaders.join(', ') : 'none'}.`]
            : [],
        })
        return
      }

      setUploadStats({
        fileName: file.name,
        uploadedAt: new Date().toLocaleString(),
        rows: data.totals.imported,
        skipped: data.totals.duplicates,
        unmatched: data.totals.unmatched,
      })
      setUploadStatus({
        type: 'success',
        message: `Imported ${data.totals.imported} transaction(s).`,
        details: [`${data.totals.duplicates} duplicate(s) skipped, ${data.totals.unmatched} unmatched, ${data.totals.invalid} invalid.`],
      })
    } catch (error) {
      setUploadStatus({ type: 'error', message: error.message || 'Unable to process transaction upload.', details: [] })
    } finally {
      setUploading(false)
    }
  }

  const workflow = [
    { label: 'Submitted', count: String(statusCounts.submitted), active: statusCounts.submitted > 0 },
    { label: 'Pending Supervisor Review', count: String(statusCounts.pendingReview), active: statusCounts.pendingReview > 0 },
    { label: 'Approved / Rejected', count: String(statusCounts.decided), active: statusCounts.decided > 0 },
    { label: 'Active & Eligible', count: String(statusCounts.active), active: statusCounts.active > 0 },
  ]

  return (
    <div className="supervisor-layout">
      <div className="supervisor-main">
        <div className="supervisor-queue card-light">
          <div className="section-title-row">
            <h3>Pending Applications</h3>
            <span className="secondary-badge">{applications.length}</span>
            <button className="ghost-link" onClick={handleExportApproved} disabled={exporting}>
              {exporting ? 'Exporting…' : 'Export Approved (Excel)'}
            </button>
          </div>
          {status.message && (
            <div className={`status-banner ${status.type}`}>{status.message}</div>
          )}
          <div className="queue-list">
            {!loading && applications.length === 0 && (
              <div className="queue-item">
                <div className="queue-copy">
                  <div className="queue-name">No applications pending review</div>
                  <div className="queue-meta">Verified applications will appear here after SMS confirmation.</div>
                </div>
              </div>
            )}
            {applications.map((item) => (
              <button
                key={item.phone}
                type="button"
                className="queue-item"
                onClick={() => setSelectedPhone(item.phone)}
              >
                <div className="queue-avatar">{item.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</div>
                <div className="queue-copy">
                  <div className="queue-name">{item.name}</div>
                  <div className="queue-phone">{formatPhone(item.phone)}</div>
                  <div className="queue-meta">{formatSubmittedAt(item.submittedAt)}</div>
                </div>
                <span className="chevron-btn"><Icon name="chevron" /></span>
              </button>
            ))}
          </div>
          <button className="ghost-link">View all pending applications</button>
        </div>

        <div className="supervisor-details card-light">
          <div className="detail-meta">Application Details</div>
          <div className="detail-name-row">
            <div className="detail-avatar">{form.name ? form.name.split(' ').map((part) => part[0]).slice(0, 2).join('') : '--'}</div>
            <div>
              <h3>{form.name || 'No application selected'}</h3>
              <div>{form.phone || 'Select a pending application'}</div>
            </div>
          </div>
          <div className="detail-grid">
            <label>
              <span>Name</span>
              <input name="name" value={form.name} onChange={handleChange} disabled={!selectedApplication || saving} />
            </label>
            <div><span>Phone Number</span><strong>{form.phone || '-'}</strong></div>
            <label>
              <span>Email Address</span>
              <input name="email" value={form.email} onChange={handleChange} disabled={!selectedApplication || saving} />
            </label>
            <label>
              <span>Player Mobile ID</span>
              <input name="playerMobileId" value={form.playerMobileId} onChange={handleChange} disabled={!selectedApplication || saving} />
            </label>
            <label>
              <span>Player ID</span>
              <input type="number" name="playerId" value={form.playerId} onChange={handleChange} min="1" step="1" className={playerIdError ? 'input-error' : ''} disabled={!selectedApplication || saving} />
              {playerIdError && <span className="field-error-msg">{playerIdError}</span>}
            </label>
            <label>
              <span>Facebook Link</span>
              <input name="facebook" value={form.facebook} onChange={handleChange} disabled={!selectedApplication || saving} />
            </label>
            <label>
              <span>Instagram Handle</span>
              <input name="instagram" value={form.instagram} onChange={handleChange} disabled={!selectedApplication || saving} />
            </label>
            <label>
              <span>Telegram ID</span>
              <input name="telegram" value={form.telegram} onChange={handleChange} disabled={!selectedApplication || saving} />
            </label>
            <div><span>Status</span><strong>{form.status}</strong></div>
          </div>
          {missingRequiredFields && (
            <div className="field-error">Player ID (7-digit number) and Player Mobile ID are required before this application can be approved.</div>
          )}
          <div className="approval-actions">
            <button
              className="approve-btn"
              onClick={() => handleDecision('approved')}
              disabled={!selectedApplication || saving || missingApprovalFields}
            >
              Approve
            </button>
            <button className="reject-btn" onClick={() => handleDecision('rejected')} disabled={!selectedApplication || saving}>Reject</button>
          </div>
        </div>

        <div className="workflow-panel card-light">
          <div className="workflow-head">Application Status & Workflow</div>
          <div className="workflow-steps">
            {workflow.map((step) => (
              <div key={step.label} className={`workflow-step ${step.active ? 'active' : ''}`}>
                {step.active && <div className="step-dot">✓</div>}
                <div className="step-count">{step.count}</div>
                <div className="step-name">{step.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="supervisor-side">
        <div className="upload-panel card-light">
          <div className="upload-header">
            <h3>P3M Upload</h3>
          </div>
          <div className="upload-zone">
            <div className="upload-illustration"><Icon name="upload" /></div>
            <div className="upload-prompt">Drag and drop a CSV or Excel file here</div>
            <label className="approve-btn" htmlFor="transaction-upload">{uploading ? 'Uploading...' : 'Choose File'}</label>
            <input id="transaction-upload" type="file" accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" onChange={handleTransactionUpload} hidden disabled={uploading} />
          </div>
          {uploadStatus.message && (
            <div className={`status-banner ${uploadStatus.type}`}>
              <strong>{uploadStatus.message}</strong>
              {uploadStatus.details.map((detail) => <div key={detail}>{detail}</div>)}
            </div>
          )}
          <ul className="upload-list">
            <li>Source: P3M CSV file containing last 24 hours of transactions.</li>
            <li>Match on Phone Number only.</li>
            <li>Skip duplicate transactions.</li>
            <li>Only transactions for approved profiles will be processed.</li>
          </ul>
          <div className="upload-stats">
            <div><span>File Name</span><strong>{uploadStats.fileName}</strong></div>
            <div><span>Upload Date</span><strong>{uploadStats.uploadedAt}</strong></div>
            <div><span>New Transactions Added</span><strong>{uploadStats.rows}</strong></div>
            <div><span>Duplicates Skipped</span><strong>{uploadStats.skipped}</strong></div>
            <div><span>Unmatched Phone Numbers</span><strong>{uploadStats.unmatched}</strong></div>
          </div>
          <button className="ghost-link block-link">View upload history</button>
        </div>

        <div className="threshold-panel card-light">
          <div className="threshold-header">
            <h3>Lifetime Tier Thresholds</h3>
            <button className="edit-btn" onClick={saveThresholds} disabled={savingThresholds}>
              {savingThresholds ? 'Saving...' : 'Save Thresholds'}
            </button>
          </div>
          <div className="threshold-list">
            {thresholds.map(({ name, minimum }) => (
              <div key={name} className="threshold-item">
                <div className={`threshold-icon ${tierMap[name] || 'tier-default'}`}><Icon name="star" /></div>
                <div className="threshold-copy">
                  <div className="threshold-name">{name}</div>
                  <div className="threshold-meta">Lifetime volume minimum</div>
                </div>
                <input
                  className="threshold-amount"
                  type="number"
                  min="0"
                  value={minimum}
                  onChange={(event) => setThresholds((current) => current.map((tier) => tier.name === name ? { ...tier, minimum: Number(event.target.value) } : tier))}
                />
              </div>
            ))}
          </div>
          <div className="tier-override-controls">
            <strong>Manual Customer Tier</strong>
            <select value={selectedTierCustomer} onChange={(event) => setSelectedTierCustomer(event.target.value)}>
              <option value="">Select approved customer</option>
              {approvedCustomers.map((customer) => <option key={customer.phone} value={customer.phone}>{customer.name}</option>)}
            </select>
            <select value={selectedTier} onChange={(event) => setSelectedTier(event.target.value)}>
              {['Bronze', 'Silver', 'Gold', 'Diamond'].map((tier) => <option key={tier} value={tier}>{tier}</option>)}
            </select>
            <button className="edit-btn" onClick={updateCustomerTier} disabled={!selectedTierCustomer}>Update Tier</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function SupervisorDashboard() {
  const [supervisorProfile, setSupervisorProfile] = useState(null)
  const [profileImageUrl, setProfileImageUrl] = useState('')
  const [profilePreviewUrl, setProfilePreviewUrl] = useState('')
  const [selectedProfileImage, setSelectedProfileImage] = useState(null)
  const [profileStatus, setProfileStatus] = useState({ type: 'idle', message: '' })
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileUploading, setProfileUploading] = useState(false)
  const profileInputRef = useRef(null)
  const profileImageObjectUrlRef = useRef('')

  const replaceProfileImageUrl = (nextUrl) => {
    if (profileImageObjectUrlRef.current) {
      URL.revokeObjectURL(profileImageObjectUrlRef.current)
    }
    profileImageObjectUrlRef.current = nextUrl
    setProfileImageUrl(nextUrl)
  }

  const fetchProfileImage = async () => {
    const response = await fetch(config.REST_API.Supervisor.ProfilePicture, {
      headers: SUPERVISOR_AUTH_HEADERS(),
    })

    if (response.status === 404) return ''
    if (!response.ok) throw new Error('Unable to load the supervisor profile picture.')

    return URL.createObjectURL(await response.blob())
  }

  useEffect(() => {
    let active = true

    const loadSupervisorProfile = async () => {
      try {
        const response = await fetch(config.REST_API.Supervisor.Profile, {
          headers: SUPERVISOR_AUTH_HEADERS(),
        })
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.message || 'Unable to load the supervisor profile.')
        }

        const nextImageUrl = data.profile?.profilePictureUrl ? await fetchProfileImage() : ''
        if (!active) {
          if (nextImageUrl) URL.revokeObjectURL(nextImageUrl)
          return
        }

        setSupervisorProfile(data.profile || null)
        replaceProfileImageUrl(nextImageUrl)
      } catch (error) {
        if (active) {
          setProfileStatus({ type: 'error', message: error.message || 'Unable to load the supervisor profile.' })
        }
      } finally {
        if (active) setProfileLoading(false)
      }
    }

    loadSupervisorProfile()

    return () => {
      active = false
      if (profileImageObjectUrlRef.current) {
        URL.revokeObjectURL(profileImageObjectUrlRef.current)
      }
    }
  }, [])

  const openProfilePicker = () => {
    if (!profileUploading) profileInputRef.current?.click()
  }

  const handleProfileImageChange = (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) return

    if (!PROFILE_IMAGE_TYPES.includes(file.type)) {
      setProfileStatus({ type: 'error', message: 'Choose a JPG, PNG, or WebP image.' })
      return
    }

    if (file.size > PROFILE_IMAGE_MAX_SIZE) {
      setProfileStatus({ type: 'error', message: 'Profile images must be 5 MB or smaller.' })
      return
    }

    if (profilePreviewUrl) URL.revokeObjectURL(profilePreviewUrl)
    setSelectedProfileImage(file)
    setProfilePreviewUrl(URL.createObjectURL(file))
    setProfileStatus({ type: 'idle', message: '' })
  }

  const cancelProfileImageChange = () => {
    if (profilePreviewUrl) URL.revokeObjectURL(profilePreviewUrl)
    setProfilePreviewUrl('')
    setSelectedProfileImage(null)
  }

  const handleSaveProfileImage = async () => {
    if (!selectedProfileImage) return

    setProfileUploading(true)
    setProfileStatus({ type: 'idle', message: '' })

    try {
      const response = await fetch(config.REST_API.Supervisor.ProfilePicture, {
        method: 'POST',
        headers: {
          ...SUPERVISOR_AUTH_HEADERS(),
          'Content-Type': selectedProfileImage.type,
        },
        body: selectedProfileImage,
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Unable to update the profile picture.')
      }

      const nextImageUrl = await fetchProfileImage()
      replaceProfileImageUrl(nextImageUrl)
      cancelProfileImageChange()
      setSupervisorProfile((current) => ({ ...current, profilePictureUrl: data.profilePictureUrl }))
      setProfileStatus({ type: 'success', message: 'Profile picture updated.' })
    } catch (error) {
      setProfileStatus({ type: 'error', message: error.message || 'Unable to update the profile picture.' })
    } finally {
      setProfileUploading(false)
    }
  }

  const handleRemoveProfileImage = async () => {
    if (!profileImageUrl || !window.confirm('Remove your profile picture?')) return

    setProfileUploading(true)
    setProfileStatus({ type: 'idle', message: '' })

    try {
      const response = await fetch(config.REST_API.Supervisor.ProfilePicture, {
        method: 'DELETE',
        headers: SUPERVISOR_AUTH_HEADERS(),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Unable to remove the profile picture.')
      }

      replaceProfileImageUrl('')
      setSupervisorProfile((current) => ({ ...current, profilePictureUrl: null }))
      setProfileStatus({ type: 'success', message: 'Profile picture removed.' })
    } catch (error) {
      setProfileStatus({ type: 'error', message: error.message || 'Unable to remove the profile picture.' })
    } finally {
      setProfileUploading(false)
    }
  }

  useEffect(() => () => {
    if (profilePreviewUrl) URL.revokeObjectURL(profilePreviewUrl)
  }, [profilePreviewUrl])

  const transactions = [
    { date: 'May 26, 2026 10:15 AM', type: 'Buy', label: 'Bank Transfer', amount: '$750.00', status: 'Completed', ref: 'TXN-849112' },
    { date: 'May 25, 2026 09:32 AM', type: 'Reward', label: 'Daily Bonus', amount: '$10.00', status: 'Completed', ref: 'TXN-849111' },
    { date: 'May 24, 2026 06:08 PM', type: 'Redeem', label: 'Play', amount: '$300.00', status: 'Completed', ref: 'TXN-849097' },
    { date: 'May 23, 2026 11:47 AM', type: 'Buy', label: 'Credit Card', amount: '$450.00', status: 'Completed', ref: 'TXN-849073' },
    { date: 'May 22, 2026 04:21 PM', type: 'Reward', label: 'Referral Bonus', amount: '$25.00', status: 'Completed', ref: 'TXN-849061' },
  ]

  const games = [
    { name: 'Golden Dragon', image: goldenDragonImg },
    { name: 'Magic City', image: magicCityImg },
    { name: 'Ultra Panda', image: ultraPandaImg },
    { name: 'VBLink', image: vblinkImg },
  ]
  const supervisorName = supervisorProfile?.name || localStorage.getItem('p4p_supervisor_name') || 'Supervisor'
  const profileAvatarUrl = profilePreviewUrl || profileImageUrl

  return (
    <div className="p4p-dashboard">
      <div className="hero">
        <div className="hero-left">
          <img className="hero-logo" src={play4PerksLogo} alt="Play4Perks" />

          <div className="hero-text-wrap">
            <h1 className="hero-title">
              Welcome back, <span>{supervisorName}!</span> 👋
            </h1>
            <p className="hero-subtitle">Play more. Earn more. Get exclusive perks with Play4Perks.</p>
          </div>
        </div>

        <div className="hero-right" aria-hidden="true" />
      </div>

      <div className="overview-grid highlight-grid">
        <div className="info-card profile-card">
          <div className="card-title-row">
            <div className="card-title">Profile Summary</div>
            <button type="button" className="card-link">View Profile →</button>
          </div>
          <div className="profile-summary-inner">
            <input
              ref={profileInputRef}
              className="profile-image-input"
              type="file"
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
              onChange={handleProfileImageChange}
              disabled={profileUploading}
            />
            <div className="profile-avatar-wrap">
              <button
                type="button"
                className="profile-avatar-button"
                onClick={openProfilePicker}
                disabled={profileUploading}
                aria-label="Choose a profile picture"
              >
                {profileAvatarUrl ? (
                  <img src={profileAvatarUrl} alt={`${supervisorName} profile`} className="profile-avatar-image" />
                ) : (
                  getInitials(supervisorName)
                )}
              </button>
              <button
                type="button"
                className="profile-camera-button"
                onClick={openProfilePicker}
                disabled={profileUploading}
                aria-label="Upload a profile picture"
              >
                <Icon name="upload" />
              </button>
            </div>
            {profilePreviewUrl && (
              <div className="profile-image-actions">
                <span className="profile-image-preview-label">Preview selected</span>
                <div className="profile-image-action-buttons">
                  <button type="button" className="profile-image-cancel" onClick={cancelProfileImageChange} disabled={profileUploading}>Cancel</button>
                  <button type="button" className="profile-image-save" onClick={handleSaveProfileImage} disabled={profileUploading}>
                    {profileUploading ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            )}
            {!profilePreviewUrl && profileImageUrl && (
              <button type="button" className="profile-image-remove" onClick={handleRemoveProfileImage} disabled={profileUploading}>
                {profileUploading ? 'Updating...' : 'Remove picture'}
              </button>
            )}
            {profileLoading && <div className="profile-image-status">Loading profile...</div>}
            {profileStatus.message && (
              <div className={`profile-image-status ${profileStatus.type}`}>{profileStatus.message}</div>
            )}
            <div className="profile-topline">
              <div className="profile-name">{supervisorName}</div>
              <div className="profile-tier-tag">{supervisorProfile?.role || 'Supervisor'}</div>
            </div>
            <div className="profile-meta-list">
              <div className="meta-line"><span className="meta-icon">◉</span> Username <strong>{supervisorProfile?.username || '—'}</strong></div>
              <div className="meta-line"><span className="meta-icon">✉</span> Email <strong>{supervisorProfile?.email || '—'}</strong></div>
              <div className="meta-line"><span className="meta-icon">✓</span> Status <strong>{supervisorProfile ? 'Active' : '—'}</strong></div>
              <div className="meta-line"><span className="meta-icon">⚑</span> Picture <strong>{profileImageUrl ? 'Uploaded' : 'Not set'}</strong></div>
            </div>
          </div>
        </div>

        <div className="info-card verified-card">
          <div className="card-title-row">
            <div className="card-title">Account Status</div>
            <button type="button" className="card-link">View Details →</button>
          </div>
          <div className="shield-wrap">✓</div>
          <div className="verified-title">Verified</div>
          <div className="verified-copy">Your account is fully verified and ready to play!</div>
          <div className="check-row"><span className="check-mark">✓</span> Phone &amp; Email Verified</div>
        </div>

        <div className="info-card tier-card">
          <div className="card-title-row">
            <div className="card-title">Current Tier</div>
            <button type="button" className="card-link">View Tiers →</button>
          </div>
          <div className="tier-icon-wrap">★</div>
          <div className="tier-name">Silver</div>
          <div className="tier-copy">You&apos;re on the Silver Tier!</div>
          <div className="tier-progress-line"><span /></div>
          <div className="tier-stat"><strong>2,340</strong> / 5,000 points</div>
          <div className="tier-subtle">Earn 2,660 more points to reach Gold Tier</div>
        </div>

        <div className="info-card promo-card">
          <div className="promo-emoji">🎁</div>
          <div className="promo-head">EXCLUSIVE<br />BONUS &amp; PROMOS</div>
          <div className="promo-copy">More Play. More Perks.</div>
          <button type="button" className="promo-button">Check Now →</button>
        </div>
      </div>

      <div className="metrics-grid">
        <div className="metric-card wallet-card">
          <div className="metric-header">
            <div className="metric-title">Wallet Balance</div>
            <span className="metric-icon">💰</span>
          </div>
          <div className="metric-value">$120.50</div>
          <div className="metric-foot">+12% this week</div>
        </div>

        <div className="metric-card reward-card">
          <div className="metric-header">
            <div className="metric-title">Total Reward Earned</div>
            <span className="metric-icon">🎉</span>
          </div>
          <div className="metric-value">$532.00</div>
          <div className="metric-foot">+8% this month</div>
        </div>

        <div className="metric-card games-card">
          <div className="metric-header">
            <div className="metric-title">Games Played</div>
            <span className="metric-icon">🎮</span>
          </div>
          <div className="metric-value">26</div>
          <div className="metric-foot">+4% this week</div>
        </div>

        <div className="metric-card volume-card">
          <div className="metric-header">
            <div className="metric-title">Lifetime Transaction Volume</div>
            <span className="metric-icon">🏆</span>
          </div>
          <div className="metric-value">$12,210.00</div>
          <div className="metric-foot">+18% since joining</div>
        </div>
      </div>

      <div className="bottom-grid">
        <div className="panel-card transactions-panel">
          <div className="panel-header">
            <div className="panel-title">Recent Transactions</div>
            <button type="button" className="panel-link">View All →</button>
          </div>
          <table>
            <thead>
              <tr>
                <th>Date / Time</th>
                <th>Type</th>
                <th>Game / Channel</th>
                <th>Amount (USD)</th>
                <th>Status</th>
                <th>Reference ID</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((entry) => (
                <tr key={entry.ref}>
                  <td>{entry.date}</td>
                  <td>{entry.type}</td>
                  <td>{entry.label}</td>
                  <td>{entry.amount}</td>
                  <td><span className="status-pill success">✓ Completed</span></td>
                  <td>{entry.ref}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="panel-card games-panel">
          <div className="panel-header">
            <div className="panel-title">Popular Games</div>
            <button type="button" className="panel-link">View All →</button>
          </div>
          <div className="game-grid">
            {games.map((game) => (
              <a key={game.name} href={game.url} className="game-card game-tile">
                <img src={game.image} alt={game.name} />
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="cta-row">
        <div className="cta-card profile-cta">
          <div className="cta-icon"><Icon name="edit" /></div>
          <div className="cta-copy">
            <div className="cta-title">Complete Your Profile</div>
            <div className="cta-subtitle">Keep your profile up to date for a safer and smoother experience.</div>
          </div>
          <button type="button" className="cta-button">Update Profile →</button>
        </div>

        <div className="cta-card referral-cta">
          <div className="cta-icon">🎁</div>
          <div className="cta-copy">
            <div className="cta-title">Refer a Friend</div>
            <div className="cta-subtitle">Invite friends and earn amazing rewards!</div>
          </div>
          <button type="button" className="cta-button alt">Invite Now →</button>
        </div>
      </div>
    </div>
  )
}

export function SupervisorPage() {
  return (
    <AppLayout route="supervisor">
      <SupervisorDashboard />
    </AppLayout>
  )
}
