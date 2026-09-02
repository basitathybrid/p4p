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
    user: (<svg {...common}><path d="M16 19a4 4 0 0 0-8 0" /><circle cx="12" cy="8" r="3.5" /></svg>),
    card: (<svg {...common}><rect x="3.5" y="5" width="17" height="14" rx="2" /><path d="M3.5 10.5h17" /></svg>),
    bell: (<svg {...common}><path d="M12 4a4 4 0 0 1 4 4v2.4c0 1.4.5 2.8 1.4 3.8l.7.7H5.9l.7-.7A5.4 5.4 0 0 0 8 10.4V8a4 4 0 0 1 4-4Z" /><path d="M10 18a2 2 0 0 0 4 0" /></svg>),
    check: (<svg {...common}><path d="M5 12.5 9 16l10-10" /></svg>),
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
