import roles, { tierMap } from '../../data/roles'
import { AppLayout } from '../layout/AppLayout'
import { Icon, StatCard, StatusBadge } from '../ui/Icon'

function SupervisorTable() {
  return (
    <div className="supervisor-layout">
      <div className="supervisor-main">
        <div className="supervisor-queue card-light">
          <div className="section-title-row">
            <h3>Pending Applications</h3>
            <span className="secondary-badge">2</span>
          </div>
          <div className="queue-list">
            {roles.supervisor.queue.map((item) => (
              <div key={item[0]} className="queue-item">
                <div className="queue-avatar">{item[0].split(' ').map((part) => part[0]).slice(0, 2).join('')}</div>
                <div className="queue-copy">
                  <div className="queue-name">{item[0]}</div>
                  <div className="queue-phone">{item[1]}</div>
                  <div className="queue-meta">{item[2]}</div>
                </div>
                <button className="chevron-btn"><Icon name="chevron" /></button>
              </div>
            ))}
          </div>
          <button className="ghost-link">View all pending applications</button>
        </div>

        <div className="supervisor-details card-light">
          <div className="detail-meta">Application Details</div>
          <div className="detail-name-row">
            <div className="detail-avatar">MT</div>
            <div>
              <h3>{roles.supervisor.details.name}</h3>
              <div>{roles.supervisor.details.phone}</div>
            </div>
          </div>
          <div className="detail-grid">
            <div><span>Name</span><strong>{roles.supervisor.details.name}</strong></div>
            <div><span>Phone Number</span><strong>{roles.supervisor.details.phone}</strong></div>
            <div><span>Email Address</span><strong>{roles.supervisor.details.email}</strong></div>
            <div><span>Player Mobile ID</span><strong>{roles.supervisor.details.mobileId}</strong></div>
            <div><span>Player ID</span><strong>{roles.supervisor.details.playerId}</strong></div>
            <div><span>Facebook Link</span><strong>{roles.supervisor.details.facebook}</strong></div>
            <div><span>Instagram Handle</span><strong>{roles.supervisor.details.instagram}</strong></div>
            <div><span>Telegram ID</span><strong>{roles.supervisor.details.telegram}</strong></div>
          </div>
          <div className="approval-actions">
            <button className="approve-btn">Approve</button>
            <button className="reject-btn">Reject</button>
            <button className="save-btn">Save Changes</button>
          </div>
        </div>

        <div className="workflow-panel card-light">
          <div className="workflow-head">Application Status & Workflow</div>
          <div className="workflow-steps">
            {roles.supervisor.workflow.map((step, index) => (
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
        {roles.supervisor.stats.map((card) => (
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
