import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchJson, fmtMoney, fmtSignedMoney, fmtTime } from '../lib/api'
import PieChart from '../components/PieChart'

export default function History() {
  const [events, setEvents] = useState([])
  const [positions, setPositions] = useState([])

  const refresh = useCallback(async () => {
    const [tradeLogData, positionsData] = await Promise.all([
      fetchJson('/api/trade-log').catch(() => ({ events: [] })),
      fetchJson('/api/positions').catch(() => ({ positions: [] })),
    ])
    setEvents(tradeLogData.events || [])
    setPositions(positionsData.positions || [])
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const segments = positions.map((p) => ({ label: p.symbol, value: Number(p.marketValue) || 0 }))

  return (
    <>
      <div className="panel panel-full">
        <div className="panel-title">
          <h2>Portfolio allocation</h2>
        </div>
        {segments.length === 0 ? <div className="empty-state">No open positions</div> : <PieChart segments={segments} />}
      </div>

      <div className="panel panel-full">
        <div className="panel-title">
          <h2>Full trade history</h2>
          <span className="count">{events.length}</span>
        </div>
        {events.length === 0 ? (
          <div className="empty-state">No trades placed yet</div>
        ) : (
          <div className="table-wrap">
            <table className="activity">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Side</th>
                  <th>Size</th>
                  <th>Price</th>
                  <th>Realized P/L</th>
                  <th>Why</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <Link to={`/stock/${e.symbol}`}>{e.symbol}</Link>
                    </td>
                    <td className={e.kind === 'buy' ? 'side-buy' : 'side-sell'}>{e.kind.toUpperCase()}</td>
                    <td>{e.qty} sh</td>
                    <td>{fmtMoney(e.price)}</td>
                    <td>
                      {e.kind === 'sell' ? (
                        <span className={Number(e.realizedPl) >= 0 ? 'pl-positive' : 'pl-negative'}>
                          {fmtSignedMoney(e.realizedPl)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="reason-cell">{e.reason}</td>
                    <td>{fmtTime(e.timestamp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
