export function Icon({ name, className = '' }) {
  const common = {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '1.8',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  }

  const icons = {
    dashboard: (<svg {...common}><path d="M4 11.5h7V4H4zm9 0h7V4h-7zm-9 9h7v-7H4zm9 0h7v-7h-7z" /></svg>),
    home: (<svg {...common}><path d="M3 10.5 12 3l9 7.5" /><path d="M5.5 9.5V19h13V9.5" /><path d="M10 19v-6h4v6" /></svg>),
    user: (<svg {...common}><path d="M16 19a4 4 0 0 0-8 0" /><circle cx="12" cy="8" r="3.5" /></svg>),
    edit: (<svg {...common}><path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" /><path d="M13.5 6.5l4 4" /></svg>),
    gift: (<svg {...common}><rect x="5" y="10" width="14" height="9" rx="2" /><path d="M12 10v9M5 14h14M9 10V7.8A1.8 1.8 0 0 1 10.8 6h2.4A1.8 1.8 0 0 1 15 7.8V10" /><path d="M9 10h6" /></svg>),
    history: (<svg {...common}><path d="M4 12a8 8 0 1 0 2.5-5.7" /><path d="M4 4v4h4" /><path d="M12 8v4l2.7 1.8" /></svg>),
    controller: (<svg {...common}><path d="M7.2 9h9.6c2.1 0 3.6 1.6 4.1 4l.7 3.1c.4 1.8-1 3.4-2.8 3.4-1 0-1.8-.5-2.4-1.3l-1.2-1.7H8.8l-1.2 1.7c-.6.8-1.4 1.3-2.4 1.3-1.8 0-3.2-1.6-2.8-3.4l.7-3.1c.5-2.4 2-4 4.1-4Z" /><path d="M8 12v4M6 14h4M16.5 12.5h.01M19 15h.01" /></svg>),
    card: (<svg {...common}><rect x="3.5" y="5" width="17" height="14" rx="2" /><path d="M3.5 10.5h17" /></svg>),
    bell: (<svg {...common}><path d="M12 4a4 4 0 0 1 4 4v2.4c0 1.4.5 2.8 1.4 3.8l.7.7H5.9l.7-.7A5.4 5.4 0 0 0 8 10.4V8a4 4 0 0 1 4-4Z" /><path d="M10 18a2 2 0 0 0 4 0" /></svg>),
    check: (<svg {...common}><path d="M5 12.5 9 16l10-10" /></svg>),
    pending: (<svg {...common}><path d="M12 7v5l3 2" /><circle cx="12" cy="12" r="8" /><path d="M7 5.5A8.5 8.5 0 0 1 12 3.5" /></svg>),
    headset: (<svg {...common}><path d="M5 12a7 7 0 0 1 14 0v5.5a2.5 2.5 0 0 1-2.5 2.5H15v-7h2" /><path d="M5 12v5.5A2.5 2.5 0 0 0 7.5 20H9v-7H7" /><path d="M9 17v-3M15 17v-3" /></svg>),
    question: (<svg {...common}><circle cx="12" cy="12" r="8" /><path d="M9.3 9.6A2.8 2.8 0 0 1 12 7.5a2.7 2.7 0 0 1 2 4.7c-.8.7-1.5 1.1-1.8 2.2" /><circle cx="12" cy="16.8" r=".7" fill="currentColor" stroke="none" /></svg>),
    x: (<svg {...common}><path d="M6 6l12 12M18 6 6 18" /></svg>),
    plus: (<svg {...common}><path d="M12 5v14M5 12h14" /></svg>),
    search: (<svg {...common}><circle cx="11" cy="11" r="5.5" /><path d="M16 16l4 4" /></svg>),
    calendar: (<svg {...common}><rect x="3.5" y="5.5" width="17" height="15" rx="2" /><path d="M8 3.5v4M16 3.5v4M3.5 9.5h17" /></svg>),
    upload: (<svg {...common}><path d="M12 15V4m0 0 4 4m-4-4-4 4M5 18.5v.5h14v-.5" /></svg>),
    shield: (<svg {...common}><path d="M12 3.5 18 6v5.6c0 4.1-2.1 7.9-6 10.9-3.9-3-6-6.8-6-10.9V6l6-2.5Z" /><path d="M9.5 12.5 11 14l3.5-4" /></svg>),
    money: (<svg {...common}><path d="M12 3.5v17M16 7.5c0-1.5-1.8-2.5-4-2.5s-4 1-4 2.5 1.8 2.5 4 2.5 4 1 4 2.5-1.8 2.5-4 2.5-4-1-4-2.5" /></svg>),
    table: (<svg {...common}><path d="M4 7h16M4 12h16M4 17h16M8 4v16M16 4v16" /></svg>),
    star: (<svg {...common}><path d="m12 3 2.6 5.4 5.9.8-4.2 4.1 1 5.9L12 0 6.7 19.2l1-5.9-4.2-4.1 5.9-.8L12 3Z" /></svg>),
    alert: (<svg {...common}><path d="M12 4.5 19 17H5l7-12.5Z" /><path d="M12 9v4" /><circle cx="12" cy="15.5" r=".8" fill="currentColor" stroke="none" /></svg>),
    info: (<svg {...common}><circle cx="12" cy="12" r="8" /><path d="M12 10.5V16M12 7.8h.01" /></svg>),
    trophy: (<svg {...common}><path d="M7 4h10v3a5 5 0 0 1-10 0V4Zm0 0H5.5a2.5 2.5 0 0 0 0 5M17 4h1.5a2.5 2.5 0 0 1 0 5M12 15v3M9 20h6" /></svg>),
    chevron: (<svg {...common}><path d="m9 6 6 6-6 6" /></svg>),
    menu: (<svg {...common}><path d="M4 7h16M4 12h16M4 17h16" /></svg>),
    spark: (<svg {...common}><path d="m12 2 2.2 6.8L21 11l-6.8 2.2L12 20l-2.2-6.8L3 11l6.8-2.2L12 2Z" /></svg>),
    phone: (<svg {...common}><path d="M7.1 4.5 9.2 8 7.5 9.7c1.1 2.3 2.8 4.1 5.1 5.1l1.7-1.7 3.5 2.1c.5.3.7.9.5 1.4l-.7 1.8c-.2.5-.7.8-1.2.8C9.8 18.6 5.4 14.2 4.8 7.6c0-.5.3-1 .8-1.2l1.8-.7c.5-.2 1.1 0 1.4.5Z" /></svg>),
    lock: (<svg {...common}><rect x="6" y="10" width="12" height="10" rx="2" /><path d="M8.5 10V7a3.5 3.5 0 0 1 7 0v3" /></svg>),
    eyeOff: (<svg {...common}><path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A10.8 10.8 0 0 1 12 5c5 0 8.5 4.8 9 7-.2 1-1 2.3-2.2 3.5M6.2 6.2C4.4 7.4 3.3 9.2 3 12c.3 2.3 3.7 7 9 7 1.2 0 2.3-.2 3.3-.6" /></svg>),
    eye: (<svg {...common}><path d="M3 12s3.2-6 9-6 9 6 9 6-3.2 6-9 6-9-6-9-6Z" /><circle cx="12" cy="12" r="2.5" /></svg>),
    arrowRight: (<svg {...common}><path d="M4 12h15M13 6l6 6-6 6" /></svg>),
    logout: (<svg {...common}><path d="M9 7V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6a2 2 0 0 1-2-2v-2" /><path d="M10 12H3" /><path d="m6 9 3 3-3 3" /></svg>),
    mail: (<svg {...common}><rect x="3.5" y="5" width="17" height="14" rx="2" /><path d="m4.5 7 7.5 6 7.5-6" /></svg>),
    gamepad: (<svg {...common}><path d="M7.2 8.5h9.6c2.1 0 3.6 1.6 4.1 4l.7 3.1c.4 1.8-1 3.4-2.8 3.4-1 0-1.8-.5-2.4-1.3l-1.2-1.7H8.8l-1.2 1.7c-.6.8-1.4 1.3-2.4 1.3-1.8 0-3.2-1.6-2.8-3.4l.7-3.1c.5-2.4 2-4 4.1-4Z" /><path d="M7 11v4M5 13h4M16.5 12.5h.01M19 15h.01" /></svg>),
    facebook: (<svg {...common}><circle cx="12" cy="12" r="9" /><path d="M13.5 8.5h-1c-.8 0-1.5.7-1.5 1.5v8M8.5 13h6" /></svg>),
    instagram: (<svg {...common}><rect x="4" y="4" width="16" height="16" rx="4" /><circle cx="12" cy="12" r="3.5" /><path d="M17.3 6.7h.01" /></svg>),
    telegram: (<svg {...common}><path d="m21 4-3.2 16-6.1-5.1-3.7 2.8.9-4.2L4 12l17-8Z" /><path d="m8.9 13.5 8.2-6.4" /></svg>),
    message: (<svg {...common}><path d="M4 5.5h16v10H9l-4 3v-13Z" /><path d="M8 9.5h8M8 12.5h5" /></svg>),
  }

  return icons[name] || icons.info
}

export function StatusBadge({ text, tone = 'info' }) {
  return <span className={`status-badge ${tone}`}>{text}</span>
}

export function TierBadge({ label }) {
  return <span className={`tier-badge ${tierMap[label] || 'tier-default'}`}>{label}</span>
}

export function StatCard({ title, value, note, tone = 'blue' }) {
  return (
    <div className={`stat-card ${tone}`}>
      <div className="stat-icon"><Icon name={tone === 'green' ? 'check' : tone === 'purple' ? 'upload' : tone === 'orange' ? 'alert' : 'user'} /></div>
      <div className="stat-title">{title}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-note">{note}</div>
    </div>
  )
}

const tierMap = {
  Bronze: 'tier-bronze',
  Silver: 'tier-silver',
  Gold: 'tier-gold',
  Diamond: 'tier-diamond',
}
