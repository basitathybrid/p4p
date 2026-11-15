import { useEffect, useState } from 'react'
import config from '../../config'

export function SupervisorMissionRewards({ phone }) {
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    const token = localStorage.getItem('p4p_supervisor_token')
    setLoading(true)
    setError('')
    fetch(`${config.REST_API.Supervisor.MissionRewards(phone)}?page=${page}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok) throw new Error(result.message || 'Unable to load mission rewards.')
        setData(result)
      })
      .catch((loadError) => {
        if (loadError.name !== 'AbortError') setError(loadError.message || 'Unable to load mission rewards.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [phone, page])

  return (
    <section className="internal-profile-usage" aria-label="Mission reward history">
      <div className="internal-history-heading">
        <h4>Mission Reward History</h4>
        <span>{loading ? 'Loading...' : `${Number(data?.pagination.total || 0).toLocaleString()} records`}</span>
      </div>
      {error && <div className="status-banner error" role="alert">{error}</div>}
      <div className="table-scroll internal-history-scroll">
        <table className="data-table internal-history-table">
          <thead><tr><th>Mission date</th><th>Description</th><th>Points</th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan="3">Loading mission rewards...</td></tr>}
            {!loading && !error && data?.rewards.length === 0 && <tr><td colSpan="3">No mission rewards.</td></tr>}
            {!loading && !error && data?.rewards.map((reward) => (
              <tr key={reward.id}>
                <td>{reward.activityDate}</td>
                <td>{reward.description}{reward.usesCurrentMissionTitle && <div>Current mission name; original name unavailable</div>}</td>
                <td>+{reward.points.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data?.pagination.pageCount > 1 && (
        <div className="internal-history-pagination">
          <button type="button" onClick={() => setPage((current) => current - 1)} disabled={loading || page <= 1}>Previous</button>
          <span>Page {data.pagination.page} of {data.pagination.pageCount}</span>
          <button type="button" onClick={() => setPage((current) => current + 1)} disabled={loading || page >= data.pagination.pageCount}>Next</button>
        </div>
      )}
    </section>
  )
}
