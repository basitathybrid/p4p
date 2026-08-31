import { useEffect, useMemo, useState } from 'react'
import roles, { tierMap } from '../../data/roles'
import config from '../../config'
import { AppLayout } from '../layout/AppLayout'
import { Icon, StatCard, StatusBadge } from '../ui/Icon'

const SUPERVISOR_HEADERS = () => ({
  'Content-Type': 'application/json',
  'x-user-role': 'supervisor',
  ...(localStorage.getItem('p4p_supervisor_token')
    ? { Authorization: `Bearer ${localStorage.getItem('p4p_supervisor_token')}` }
    : {}),
})

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

function formatPhone(phone) {
  if (!phone) return ''
  return phone.startsWith('+') ? phone : `+${phone}`
}

function formatSubmittedAt(value) {
  if (!value) return 'Submitted recently'
  return `Submitted on ${new Date(value).toLocaleString()}`
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

function escapeCsvValue(value) {
  const stringValue = value === undefined || value === null ? '' : String(value)
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }
  return stringValue
}

function buildCsv(rows) {
  const header = CSV_COLUMNS.map(([, label]) => escapeCsvValue(label)).join(',')
  const lines = rows.map((row) =>
    CSV_COLUMNS.map(([key]) => {
      if (key === 'phone') return escapeCsvValue(formatPhone(row[key]))
      if (key === 'reviewedAt') return escapeCsvValue(row[key] ? new Date(row[key]).toLocaleString() : '')
      return escapeCsvValue(row[key])
    }).join(','),
  )
  return [header, ...lines].join('\n')
}

function downloadCsv(filename, csvContent) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function SupervisorTable() {
  const [applications, setApplications] = useState([])
  const [selectedPhone, setSelectedPhone] = useState('')
  const [form, setForm] = useState(emptyDetails)
  const [status, setStatus] = useState({ type: 'idle', message: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)

  const selectedApplication = useMemo(
    () => applications.find((item) => item.phone === selectedPhone) || null,
    [applications, selectedPhone],
  )

  const missingRequiredFields = Boolean(selectedApplication) &&
    (!String(form.playerId || '').trim() || !String(form.playerMobileId || '').trim())

  const loadApplications = async (preferredPhone) => {
    setLoading(true)

    try {
      const response = await fetch(`${config.REST_API.Review.Applications}?status=pending_review`, {
        headers: SUPERVISOR_HEADERS(),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Unable to load applications.')
      }

      const nextApplications = data.applications || []
      setApplications(nextApplications)

      const nextSelectedPhone = preferredPhone && nextApplications.some((item) => item.phone === preferredPhone)
        ? preferredPhone
        : nextApplications[0]?.phone || ''

      setSelectedPhone(nextSelectedPhone)
      setStatus({ type: 'idle', message: '' })
    } catch (error) {
      setApplications([])
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

  const handleSave = async () => {
    if (!selectedApplication) return

    setSaving(true)
    setStatus({ type: 'idle', message: '' })

    try {
      await saveApplicationDetails(selectedApplication.phone)
      await loadApplications(selectedApplication.phone)
      setStatus({ type: 'success', message: 'Application changes saved.' })
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'Unable to save application changes.' })
    } finally {
      setSaving(false)
    }
  }

  const handleDecision = async (decision) => {
    if (!selectedApplication) return

    if (missingRequiredFields) {
      setStatus({
        type: 'error',
        message: 'Player ID and Player Mobile ID are required before an application can be approved or rejected.',
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

      const csvContent = buildCsv(approvedApplications)
      const timestamp = new Date().toISOString().slice(0, 10)
      downloadCsv(`approved-customers-${timestamp}.csv`, csvContent)
      setStatus({ type: 'success', message: `Exported ${approvedApplications.length} approved customer(s).` })
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'Unable to export approved applications.' })
    } finally {
      setExporting(false)
    }
  }

  const stats = [
    { ...roles.supervisor.stats[0], value: String(applications.length), note: applications.length ? 'Requires your review' : 'Queue is clear', tone: 'blue' },
    ...roles.supervisor.stats.slice(1),
  ]

  const workflow = [
    { label: 'Submitted', count: String(applications.length), active: applications.length > 0 },
    { label: 'Pending Supervisor Review', count: String(applications.length), active: applications.length > 0 },
    roles.supervisor.workflow[2],
    roles.supervisor.workflow[3],
  ]

  return (
    <div className="supervisor-layout">
      <div className="supervisor-main">
        <div className="supervisor-queue card-light">
          <div className="section-title-row">
            <h3>Pending Applications</h3>
            <span className="secondary-badge">{applications.length}</span>
            <button className="ghost-link" onClick={handleExportApproved} disabled={exporting}>
              {exporting ? 'Exporting…' : 'Export Approved (CSV)'}
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
              <input type="number" name="playerId" value={form.playerId} onChange={handleChange} min="0" step="1" disabled={!selectedApplication || saving} />
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
            <div className="field-error">Player ID and Player Mobile ID are required before this application can be approved or rejected.</div>
          )}
          <div className="approval-actions">
            <button
              className="approve-btn"
              onClick={() => handleDecision('approved')}
              disabled={!selectedApplication || saving || missingRequiredFields}
            >
              Approve
            </button>
            <button className="reject-btn" onClick={() => handleDecision('rejected')} disabled={!selectedApplication || saving || missingRequiredFields}>Reject</button>
            <button className="save-btn" onClick={handleSave} disabled={!selectedApplication || saving}>Save Changes</button>
          </div>
        </div>

        <div className="workflow-panel card-light">
          <div className="workflow-head">Application Status & Workflow</div>
          <div className="workflow-steps">
            {workflow.map((step, index) => (
              <div key={step.label} className={`workflow-step ${step.active ? 'active' : ''}`}>
                <div className="step-dot">{step.active ? '✓' : index + 1}</div>
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
            <span className="phase-tag">Phase 2</span>
          </div>
          <div className="upload-zone">
            <div className="upload-illustration"><Icon name="upload" /></div>
            <div>Drag and drop this CSV file here</div>
            <button>Choose File</button>
          </div>
          <ul className="upload-list">
            <li>Source: P3M CSV file containing last 24 hours of transactions.</li>
            <li>Match on Phone Number only.</li>
            <li>Skip duplicate transactions.</li>
            <li>Only transactions for approved profiles will be processed.</li>
          </ul>
          <div className="upload-stats">
            <div><span>File Name</span><strong>{roles.supervisor.upload.fileName}</strong></div>
            <div><span>Upload Date</span><strong>{roles.supervisor.upload.uploadedAt}</strong></div>
            <div><span>New Transactions Added</span><strong>{roles.supervisor.upload.rows}</strong></div>
            <div><span>Duplicates Skipped</span><strong>{roles.supervisor.upload.skipped}</strong></div>
            <div><span>Unmatched Phone Numbers</span><strong>{roles.supervisor.upload.unmatched}</strong></div>
          </div>
          <button className="ghost-link block-link">View upload history</button>
        </div>

        <div className="threshold-panel card-light">
          <div className="threshold-header">
            <h3>Lifetime Tier Thresholds</h3>
            <button className="edit-btn">Edit Thresholds</button>
          </div>
          <div className="threshold-list">
            {roles.supervisor.tiers.map(([name, amount, text]) => (
              <div key={name} className="threshold-item">
                <div className={`threshold-icon ${tierMap[name] || 'tier-default'}`}><Icon name="star" /></div>
                <div className="threshold-copy">
                  <div className="threshold-name">{name}</div>
                  <div className="threshold-meta">{text}</div>
                </div>
                <div className="threshold-amount">{amount}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function SupervisorDashboard() {
  const stats = [
    { ...roles.supervisor.stats[0], value: roles.supervisor.stats[0].value },
    ...roles.supervisor.stats.slice(1),
  ]

  return (
    <>
      <div className="page-header compact">
        <div>
          <h1>PayFe Supervisor Dashboard</h1>
          <p>Review applications, audits and customer data.</p>
        </div>
        <div className="state-pills">
          <span className="phase-pill"><Icon name="spark" /> Phase 2</span>
          <span className="approved-pill">Account Approved</span>
        </div>
      </div>
      <div className="summary-grid five-up supervisor-stats">
        {stats.map((card) => (
          <StatCard key={card.title} title={card.title} value={card.value} note={card.note} tone={card.tone} />
        ))}
      </div>
      <SupervisorTable />
    </>
  )
}

export function SupervisorPage() {
  return (
    <AppLayout route="supervisor">
      <SupervisorDashboard />
    </AppLayout>
  )
}
