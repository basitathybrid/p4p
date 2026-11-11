import { useEffect, useMemo, useState } from 'react'
import { AppLayout } from '../layout/AppLayout'
import { Icon } from '../ui/Icon'
import config from '../../config'

function MissionProgress({ mission }) {
  const percent = Math.min(100, (mission.progress / mission.target) * 100)
  return (
    <div className="mission-progress">
      <div className="mission-progress-label">
        <span>{mission.progress} of {mission.target} complete</span>
        <strong>{Math.round(percent)}%</strong>
      </div>
      <div className="mission-progress-track"><span style={{ width: `${percent}%` }} /></div>
    </div>
  )
}

function CustomerMissions() {
  const [missions, setMissions] = useState([])
  const [loginStreak, setLoginStreak] = useState(null)
  const [loading, setLoading] = useState(true)
  const [missionError, setMissionError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    const token = window.localStorage.getItem('p4p_customer_token')

    fetch(config.REST_API.Customer.Missions, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json().catch(() => null)
        if (!response.ok) throw new Error(data?.message || 'Unable to load daily missions.')
        setMissions(data?.missions || [])
        setLoginStreak(Number(data?.loginStreak) || 0)
      })
      .catch((error) => {
        if (controller.signal.aborted) return
        setMissionError(error.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [])

  return (
    <div className="missions-page">
      <section className="missions-header">
        <div>
          <span className="mission-eyebrow">Play &amp; earn</span>
          <h1>Daily Missions</h1>
          <p>Complete today&apos;s missions and earn more points!</p>
        </div>
        <div className="mission-streak-card"><span className="streak-flame">✦</span><div><strong>{loginStreak === null ? '—' : `${loginStreak} day${loginStreak === 1 ? '' : 's'} streak`}</strong><small>{loginStreak > 0 ? 'Keep it going!' : 'Log in today to start your streak!'}</small></div></div>
      </section>
      <div className="mission-list-header"><h2>Today&apos;s missions</h2><span>Refreshes daily at midnight</span></div>
      <section className="mission-card-grid">
        {loading && <p role="status">Loading daily missions...</p>}
        {missionError && <p className="mission-api-message" role="alert">{missionError}</p>}
        {!loading && !missionError && missions.length === 0 && (
          <div className="panel-card mission-card">
            <div className="mission-card-copy">
              <div className="mission-card-title"><h3>No active missions</h3></div>
              <p>Check back later for new daily mission opportunities.</p>
            </div>
          </div>
        )}
        {missions.map((mission) => (
          <div className="mission-card panel-card" key={mission.id}>
            <div className={`mission-card-icon ${mission.tone}`}><Icon name={mission.icon} /></div>
            <div className="mission-card-copy"><div className="mission-card-title"><h3>{mission.title}</h3></div><p>{mission.description}</p></div>
            <MissionProgress mission={mission} />
            <div className="mission-card-footer"><span><Icon name="gift" /> {mission.reward}</span><strong>{mission.completed ? 'Points earned' : 'In progress'}</strong></div>
          </div>
        ))}
      </section>
    </div>
  )
}

function SupervisorMissions() {
  const [missions, setMissions] = useState([])
  const [editingMission, setEditingMission] = useState(null)
  const [missionFormOpen, setMissionFormOpen] = useState(false)
  const [missionSearch, setMissionSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [updatingMissionId, setUpdatingMissionId] = useState(null)
  const [missionError, setMissionError] = useState('')
  const [missionForm, setMissionForm] = useState({ title: '', missionType: 'Transaction Count', target: 1, reward: '', status: 'Active' })

  useEffect(() => {
    const controller = new AbortController()
    const token = window.localStorage.getItem('p4p_supervisor_token')

    fetch(config.REST_API.Supervisor.Missions, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json().catch(() => null)
        if (!response.ok) throw new Error(data?.message || 'Unable to load daily missions.')
        setMissions(data?.missions || [])
      })
      .catch((error) => {
        if (controller.signal.aborted) return
        setMissionError(error.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [])

  const toggleStatus = async (mission) => {
    setMissionError('')
    setUpdatingMissionId(mission.id)
    try {
      const token = window.localStorage.getItem('p4p_supervisor_token')
      const response = await fetch(`${config.REST_API.Supervisor.Missions}/${mission.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: mission.status === 'Active' ? 'Inactive' : 'Active' }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.message || 'Unable to update mission status.')
      setMissions((current) => current.map((item) => item.id === mission.id ? data.mission : item))
    } catch (error) {
      setMissionError(error.message)
    } finally {
      setUpdatingMissionId(null)
    }
  }
  const openMissionForm = (mission = null) => {
    setEditingMission(mission)
    setMissionFormOpen(true)
    setMissionForm(mission
      ? { title: mission.title, missionType: mission.missionType || 'Transaction Count', target: mission.target, reward: mission.reward.replace(' points', ''), status: mission.status }
      : { title: '', missionType: 'Transaction Count', target: 1, reward: '', status: 'Active' })
  }
  const closeMissionForm = () => {
    setEditingMission(null)
    setMissionFormOpen(false)
  }
  const handleMissionFormChange = (event) => {
    const { name, value } = event.target
    setMissionForm((current) => ({ ...current, [name]: name === 'target' ? Number(value) : value }))
  }
  const saveMission = async (event) => {
    event.preventDefault()
    setMissionError('')
    setSaving(true)
    const payload = {
      title: missionForm.title.trim(),
      missionType: missionForm.missionType,
      target: Number(missionForm.target),
      rewardPoints: Number(missionForm.reward),
      status: missionForm.status,
    }
    try {
      const token = window.localStorage.getItem('p4p_supervisor_token')
      const response = await fetch(
        editingMission
          ? `${config.REST_API.Supervisor.Missions}/${editingMission.id}`
          : config.REST_API.Supervisor.Missions,
        {
          method: editingMission ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        },
      )
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.message || 'Unable to save daily mission.')

      if (editingMission) {
        setMissions((current) => current.map((mission) => mission.id === editingMission.id ? data.mission : mission))
      } else {
        setMissions((current) => [...current, data.mission])
      }
      closeMissionForm()
    } catch (error) {
      setMissionError(error.message)
    } finally {
      setSaving(false)
    }
  }

  const filteredMissions = useMemo(() => {
    const normalizedSearch = missionSearch.trim().toLowerCase()
    if (!normalizedSearch) return missions
    return missions.filter((mission) => (
      mission.title.toLowerCase().includes(normalizedSearch)
      || mission.description.toLowerCase().includes(normalizedSearch)
      || mission.status.toLowerCase().includes(normalizedSearch)
    ))
  }, [missionSearch, missions])

  return (
    <div className="missions-page supervisor-missions-page">
      <section className="missions-header supervisor-missions-header">
        <div><h1>Daily Missions</h1><p>Configure and manage daily missions for your customers.</p></div>
        <button type="button" className="mission-primary-button" onClick={() => openMissionForm()}><Icon name="plus" /> Add New Mission</button>
      </section>
      {missionError && <p className="mission-api-message" role="alert">{missionError}</p>}
      <div className="mission-list-header"><div className="mission-filter"><Icon name="search" /><input aria-label="Search missions" placeholder="Search missions" value={missionSearch} onChange={(event) => setMissionSearch(event.target.value)} /></div></div>
      <section className="panel-card mission-admin-table">
        <div className="mission-admin-table-head"><span>Mission Name</span><span>Requirements</span><span>Reward Points</span><span>Status</span><span>Actions</span></div>
        {loading && <div className="mission-admin-row"><span role="status">Loading daily missions...</span></div>}
        {!loading && filteredMissions.map((mission) => (
          <div className="mission-admin-row" key={mission.id}>
            <div className="mission-admin-name"><span className={`mission-card-icon ${mission.tone}`}><Icon name={mission.icon} /></span><div><strong>{mission.title}</strong><small>{mission.description}</small></div></div>
            <span>{mission.target} {mission.missionType === 'Login Streak' ? 'days' : 'transactions'}</span><strong>{mission.reward}</strong>
            <button type="button" className={`mission-status-toggle ${mission.status === 'Active' ? 'active' : ''}`} aria-pressed={mission.status === 'Active'} aria-label={`${mission.status === 'Active' ? 'Deactivate' : 'Activate'} ${mission.title}`} disabled={updatingMissionId === mission.id} onClick={() => toggleStatus(mission)}>
              <span />
            </button>
            <button type="button" className="mission-row-action" onClick={() => openMissionForm(mission)}>Edit</button>
          </div>
        ))}
        {!loading && !missionError && filteredMissions.length === 0 && (
          <div className="mission-admin-row">
            <span>No missions found.</span>
          </div>
        )}
      </section>
      {missionFormOpen && (
        <div className="modal-overlay" onClick={closeMissionForm}>
          <div className="modal-card mission-form-modal" role="dialog" aria-modal="true" aria-labelledby="mission-form-title" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3 id="mission-form-title">{editingMission ? 'Edit Mission' : 'Add New Mission'}</h3>
              <button type="button" className="modal-close" aria-label="Close" onClick={closeMissionForm}><Icon name="x" /></button>
            </div>
            <form className="mission-form" onSubmit={saveMission}>
              {missionError && <p className="mission-api-message" role="alert">{missionError}</p>}
              <label>Mission Name<input name="title" value={missionForm.title} onChange={handleMissionFormChange} placeholder="e.g. Play 3 Games" required /></label>
              <label>Mission Type<select name="missionType" value={missionForm.missionType} onChange={handleMissionFormChange}><option>Transaction Count</option><option>Login Streak</option></select></label>
              <div className="mission-form-row">
                <label>Requirement<span className="mission-number-with-unit"><input name="target" type="number" min="1" value={missionForm.target} onChange={handleMissionFormChange} required /><span>{missionForm.missionType === 'Login Streak' ? 'days' : 'transactions'}</span></span></label>
                <label>Reward points<input name="reward" type="number" min="0" value={missionForm.reward} onChange={handleMissionFormChange} placeholder="250" required /></label>
              </div>
              <div className="mission-form-status-row"><span>Status</span><button type="button" className={`mission-status-toggle ${missionForm.status === 'Active' ? 'active' : ''}`} aria-pressed={missionForm.status === 'Active'} onClick={() => setMissionForm((current) => ({ ...current, status: current.status === 'Active' ? 'Inactive' : 'Active' }))}><span /></button><strong>{missionForm.status}</strong>
              </div>
              <div className="mission-form-actions">
                <button type="button" className="mission-form-cancel" onClick={closeMissionForm}>Cancel</button>
                <button type="submit" className="mission-primary-button" disabled={saving}>{saving ? 'Saving...' : editingMission ? 'Save Changes' : 'Add Mission'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export function CustomerMissionsPage() {
  return <AppLayout route="customer"><CustomerMissions /></AppLayout>
}

export function SupervisorMissionsPage() {
  return <AppLayout route="supervisor"><SupervisorMissions /></AppLayout>
}
