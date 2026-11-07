import { useState } from 'react'
import { AppLayout } from '../layout/AppLayout'
import { Icon } from '../ui/Icon'

const MISSIONS = [
  {
    id: 'play-three',
    title: 'Play 3 Games',
    description: 'Play any three eligible games today and earn bonus points.',
    progress: 1,
    target: 3,
    reward: '250 points',
    icon: 'gamepad',
    tone: 'purple',
  },
  {
    id: 'daily-streak',
    title: 'Keep Your Streak',
    description: 'Log in and play today to keep your daily streak alive.',
    progress: 1,
    target: 1,
    reward: '100 points',
    icon: 'spark',
    tone: 'gold',
  },
  {
    id: 'try-new-game',
    title: 'Try Something New',
    description: 'Play a game you have not played this week.',
    progress: 0,
    target: 1,
    reward: '150 points',
    icon: 'gift',
    tone: 'cyan',
  },
]

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
  return (
    <div className="missions-page">
      <section className="missions-header">
        <div>
          <span className="mission-eyebrow">Play &amp; earn</span>
          <h1>Daily Missions</h1>
          <p>Complete today&apos;s missions and earn more points!</p>
        </div>
        <div className="mission-streak-card"><span className="streak-flame">✦</span><div><strong>4 days streak</strong><small>Keep it going!</small></div></div>
      </section>
      <div className="mission-list-header"><h2>Today&apos;s missions</h2><span>Refreshes daily at midnight</span></div>
      <section className="mission-card-grid">
        {MISSIONS.map((mission) => (
          <div className="mission-card panel-card" key={mission.id}>
            <div className={`mission-card-icon ${mission.tone}`}><Icon name={mission.icon} /></div>
            <div className="mission-card-copy"><div className="mission-card-title"><h3>{mission.title}</h3></div><p>{mission.description}</p></div>
            <MissionProgress mission={mission} />
            <div className="mission-card-footer"><span><Icon name="gift" /> {mission.reward}</span><strong>{mission.progress >= mission.target ? 'Completed' : 'In progress'}</strong></div>
          </div>
        ))}
      </section>
    </div>
  )
}

function SupervisorMissions() {
  const [missions, setMissions] = useState(MISSIONS.map((mission, index) => ({ ...mission, status: index === 2 ? 'Inactive' : 'Active' })))
  const [editingMission, setEditingMission] = useState(null)
  const [missionFormOpen, setMissionFormOpen] = useState(false)
  const [missionForm, setMissionForm] = useState({ title: '', missionType: 'Transaction Count', target: 1, reward: '', status: 'Active' })
  const toggleStatus = (id) => setMissions((current) => current.map((mission) => mission.id === id ? { ...mission, status: mission.status === 'Active' ? 'Inactive' : 'Active' } : mission))
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
  const saveMission = (event) => {
    event.preventDefault()
    const missionValues = {
      title: missionForm.title.trim(),
      missionType: missionForm.missionType,
      description: missionForm.missionType === 'Login Streak'
        ? `Log in for ${Math.max(1, Number(missionForm.target) || 1)} consecutive days`
        : `Complete ${Math.max(1, Number(missionForm.target) || 1)} transactions`,
      target: Math.max(1, Number(missionForm.target) || 1),
      reward: `${missionForm.reward.trim()} points`,
      status: missionForm.status,
    }
    if (editingMission) {
      setMissions((current) => current.map((mission) => mission.id === editingMission.id ? { ...mission, ...missionValues } : mission))
    } else {
      setMissions((current) => [...current, {
        ...missionValues,
        id: `mission-${Date.now()}`,
        progress: 0,
        icon: 'spark',
        tone: 'purple',
        status: missionForm.status,
      }])
    }
    closeMissionForm()
  }

  return (
    <div className="missions-page supervisor-missions-page">
      <section className="missions-header supervisor-missions-header">
        <div><h1>Daily Missions</h1><p>Configure and manage daily missions for your customers.</p></div>
        <button type="button" className="mission-primary-button" onClick={() => openMissionForm()}><Icon name="plus" /> Add New Mission</button>
      </section>
      <div className="mission-list-header"><div className="mission-filter"><Icon name="search" /><input aria-label="Search missions" placeholder="Search missions" /></div></div>
      <section className="panel-card mission-admin-table">
        <div className="mission-admin-table-head"><span>Mission Name</span><span>Requirements</span><span>Reward Points</span><span>Status</span><span>Actions</span></div>
        {missions.map((mission) => (
          <div className="mission-admin-row" key={mission.id}>
            <div className="mission-admin-name"><span className={`mission-card-icon ${mission.tone}`}><Icon name={mission.icon} /></span><div><strong>{mission.title}</strong><small>{mission.description}</small></div></div>
            <span>{mission.progress} of {mission.target} completed</span><strong>{mission.reward}</strong>
            <button type="button" className={`mission-status-toggle ${mission.status === 'Active' ? 'active' : ''}`} aria-pressed={mission.status === 'Active'} aria-label={`${mission.status === 'Active' ? 'Deactivate' : 'Activate'} ${mission.title}`} onClick={() => toggleStatus(mission.id)}>
              <span />
            </button>
            <button type="button" className="mission-row-action" onClick={() => openMissionForm(mission)}>Edit</button>
          </div>
        ))}
      </section>
      {missionFormOpen && (
        <div className="modal-overlay" onClick={closeMissionForm}>
          <div className="modal-card mission-form-modal" role="dialog" aria-modal="true" aria-labelledby="mission-form-title" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3 id="mission-form-title">{editingMission ? 'Edit Mission' : 'Add New Mission'}</h3>
              <button type="button" className="modal-close" aria-label="Close" onClick={closeMissionForm}><Icon name="x" /></button>
            </div>
            <form className="mission-form" onSubmit={saveMission}>
              <label>Mission Name<input name="title" value={missionForm.title} onChange={handleMissionFormChange} placeholder="e.g. Play 3 Games" required /></label>
              <label>Mission Type<select name="missionType" value={missionForm.missionType} onChange={handleMissionFormChange}><option>Transaction Count</option><option>Login Streak</option></select></label>
              <div className="mission-form-row">
                <label>Requirement<span className="mission-number-with-unit"><input name="target" type="number" min="1" value={missionForm.target} onChange={handleMissionFormChange} required /><span>{missionForm.missionType === 'Login Streak' ? 'login' : 'transactions'}</span></span></label>
                <label>Reward points<input name="reward" type="number" min="0" value={missionForm.reward} onChange={handleMissionFormChange} placeholder="250" required /></label>
              </div>
              <div className="mission-form-status-row"><span>Status</span><button type="button" className={`mission-status-toggle ${missionForm.status === 'Active' ? 'active' : ''}`} aria-pressed={missionForm.status === 'Active'} onClick={() => setMissionForm((current) => ({ ...current, status: current.status === 'Active' ? 'Inactive' : 'Active' }))}><span /></button><strong>{missionForm.status}</strong>
              </div>
              <div className="mission-form-actions">
                <button type="button" className="mission-form-cancel" onClick={closeMissionForm}>Cancel</button>
                <button type="submit" className="mission-primary-button">{editingMission ? 'Save Changes' : 'Add Mission'}</button>
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
