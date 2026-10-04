export function GlobalLoader({ message = 'Loading your account...' }) {
  return (
    <div className="global-loader" role="status" aria-live="polite">
      <div className="global-loader-inner">
        <span className="global-loader-spinner" aria-hidden="true" />
        <p className="global-loader-text">{message}</p>
      </div>
    </div>
  )
}

export default GlobalLoader
