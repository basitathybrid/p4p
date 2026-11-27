
import { useState } from 'react'
import { Link } from 'react-router-dom'
import '../assets/homepage.css'

import dragon from '../assets/play4perks-extracted/dragon-carousel.png'
import queen from '../assets/play4perks-extracted/egyptian-queen-carousel.png'
import panda from '../assets/play4perks-extracted/panda-carousel.png'
import city from '../assets/play4perks-extracted/city-artwork.png'
import diamond from '../assets/play4perks-extracted/diamond-artwork.png'
import gift from '../assets/play4perks-extracted/gift-box-artwork.png'

const games = [
  { name: 'Royal Queen', image: queen },
  { name: 'Golden Dragon', image: dragon },
  { name: 'Lucky Panda', image: panda },
]

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeGame, setActiveGame] = useState(1)

  const previousGame = () => {
    setActiveGame((current) => (current - 1 + games.length) % games.length)
  }

  const nextGame = () => {
    setActiveGame((current) => (current + 1) % games.length)
  }

  const features = [
    { title: 'Games', icon: '🎮', link: '/signup' },
    { title: 'Rewards', icon: '🎁', link: '/signup' },
    { title: 'VIP Perks', icon: '👑', link: '/signup' },
    { title: 'Promos', icon: '⚡', link: '/signup' },
  ]

  return (
    <main className="p4p-home">
      <div className="p4p-frame">

        <header className="p4p-header">
          <button
            className="p4p-menu-button"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
          >
            <span /><span /><span /><span />
          </button>

          <Link to="/" className="p4p-brand">
            <img src="/images/p4p-logo.png" alt="Play4Perks" />
          </Link>

          {menuOpen && (
            <nav className="p4p-menu">
              <Link to="/signup">Create Account</Link>
              <Link to="/login">Sign In</Link>
            </nav>
          )}
        </header>

        <div className="p4p-actions">
          <Link to="/login" className="p4p-signin">Sign In</Link>
          <Link to="/signup" className="p4p-signup">Sign Up</Link>
        </div>

        <section className="p4p-showcase" aria-label="Featured games and rewards">
        <svg className="p4p-lightning-art" viewBox="0 0 768 465" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          <defs>
            <filter id="lightning-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="5" />
            </filter>
          </defs>
          <g fill="none" stroke="#b000ff" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" opacity=".8" filter="url(#lightning-glow)">
            <path d="M-8 42 57 84 44 92 128 147 111 154 177 204" />
            <path d="M776 42 711 84 724 92 640 147 657 154 591 204" />
            <path d="M-10 220 65 230 52 241 132 265 119 276 187 292" />
            <path d="M778 220 703 230 716 241 636 265 649 276 581 292" />
          </g>
          <g fill="none" stroke="#ffb5ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity=".92">
            <path d="M-8 42 57 84 44 92 128 147 111 154 177 204" />
            <path d="M776 42 711 84 724 92 640 147 657 154 591 204" />
            <path d="M-10 220 65 230 52 241 132 265 119 276 187 292" />
            <path d="M778 220 703 230 716 241 636 265 649 276 581 292" />
          </g>
        </svg>
        <section className="p4p-game-section">
          <div className="p4p-game-art">
            <button
              className="p4p-carousel-arrow p4p-arrow-left"
              onClick={previousGame}
              aria-label="Previous game"
            >
              ‹
            </button>

            <img
              className="p4p-side-art p4p-left-art"
              src={games[(activeGame + games.length - 1) % games.length].image}
              alt={games[(activeGame + games.length - 1) % games.length].name}
            />

            <img
              className="p4p-main-game"
              src={games[activeGame].image}
              alt={games[activeGame].name}
            />

            <img
              className="p4p-side-art p4p-right-art"
              src={games[(activeGame + 1) % games.length].image}
              alt={games[(activeGame + 1) % games.length].name}
            />

            <svg className="p4p-controller" viewBox="0 0 360 210" aria-hidden="true" focusable="false">
              <defs>
                <linearGradient id="controller-shell" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#6b18d4" />
                  <stop offset="0.52" stopColor="#210054" />
                  <stop offset="1" stopColor="#8300b8" />
                </linearGradient>
                <linearGradient id="controller-controls" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#ff8cff" />
                  <stop offset="1" stopColor="#d000ff" />
                </linearGradient>
              </defs>
              <path
                d="M77 31h206c22 0 38 14 44 36l19 66c7 24-13 43-34 32l-44-24c-12-7-23-10-37-10H129c-14 0-25 3-37 10l-44 24c-21 11-41-8-34-32l19-66c6-22 22-36 44-36Z"
                fill="url(#controller-shell)"
                stroke="#ff67ff"
                strokeWidth="7"
                strokeLinejoin="round"
              />
              <path d="M76 42h208" fill="none" stroke="#ffb5ff" strokeOpacity=".78" strokeWidth="3" />
              <path d="M87 73v42m-21-21h42" fill="none" stroke="url(#controller-controls)" strokeWidth="13" strokeLinecap="round" />
              <circle cx="145" cy="111" r="18" fill="#13002f" stroke="#e04aff" strokeWidth="5" />
              <circle cx="145" cy="111" r="8" fill="#7722c9" />
              <circle cx="215" cy="111" r="18" fill="#13002f" stroke="#e04aff" strokeWidth="5" />
              <circle cx="215" cy="111" r="8" fill="#7722c9" />
              <circle cx="267" cy="76" r="10" fill="url(#controller-controls)" />
              <circle cx="289" cy="96" r="10" fill="url(#controller-controls)" />
              <circle cx="245" cy="96" r="10" fill="url(#controller-controls)" />
              <circle cx="267" cy="116" r="10" fill="url(#controller-controls)" />
              <circle cx="267" cy="76" r="3" fill="#fff" />
              <circle cx="289" cy="96" r="3" fill="#fff" />
              <circle cx="245" cy="96" r="3" fill="#fff" />
              <circle cx="267" cy="116" r="3" fill="#fff" />
              <path d="M174 73h12m-6-6v12m12-6h12" stroke="#f7caff" strokeWidth="3" strokeLinecap="round" />
            </svg>

            <button
              className="p4p-carousel-arrow p4p-arrow-right"
              onClick={nextGame}
              aria-label="Next game"
            >
              ›
            </button>

            
          </div>

        </section>

        <section className="p4p-support-art" aria-hidden="true">
          <img src={city} alt="" />
          <img src={diamond} alt="" />
        </section>
        </section>

        <section className="p4p-brand-message">
          <div className="p4p-wordmark">PLAY<span>4</span>PERKS</div>
          <p>PLAY <span>★</span> EARN <span>★</span> REDEEM</p>
        </section>

        <section className="p4p-features">
          {features.map((feature) => (
            <Link
              to={feature.link}
              className="p4p-feature-card"
              key={feature.title}
            >
              <span>{feature.icon}</span>
              <strong>{feature.title}</strong>
            </Link>
          ))}
        </section>

        <Link to="/signup" className="p4p-gift-banner">
          <img src={gift} alt="Gift box" />
          <div>
            <h2>Get Started Today</h2>
            <p>Play your favorite games, earn perks and unlock exclusive rewards!</p>
          </div>
          <span className="p4p-gift-arrow">›</span>
        </Link>

      </div>
    </main>
  )
}
