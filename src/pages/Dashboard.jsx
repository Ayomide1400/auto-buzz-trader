import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchJson, fmtMoney, fmtPct, fmtSignedMoney, fmtSignedPct } from '../lib/api'
import LineChart from '../components/LineChart'

const POLL_MS = 30000

export default function Dashboard() {
  const [account, setAccount] = useState(null)
  const [positions, setPositions] = useState([])
  const [trending, setTrending] = useState([])
  const [summary, setSummary] = useState(null)
  const [benchmark, setBenchmark] = useState(null)

  const refresh = useCallback(async () => {
    const [accountData, positionsData, trendingData, tradeLogData, benchmarkData] = await Promise.all([
      fetchJson('/api/account').catch(() => null),
      fetchJson('/api/positions').catch(() => ({ positions: [] })),
      fetchJson('/api/trending').catch(() => ({ symbols: [] })),
      fetchJson('/api/trade-log').catch(() => ({ summary: null })),
      fetchJson('/api/benchmark').catch(() => null),
    ])
    setAccount(accountData)
    setPositions(positionsData.positions || [])
    setTrending(trendingData.symbols || [])
    setSummary(tradeLogData.summary)
    setBenchmark(benchmarkData)
  }, [])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, POLL_MS)
    return () => clearInterval(id)
  }, [refresh])

  const heldSymbols = new Set(positions.map((p) => p.symbol))
  const botPositions = positions.filter((p) => p.isBotOwned)
  const externalPositions = positions.filter((p) => !p.isBotOwned)

  const chartLines =
    benchmark?.series?.length > 1
      ? [
          { key: 'strategyPl' },
          { key: 'benchmarkPl' },
        ]
      : null

  return (
    <>
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-label">Equity</div>
          <div className="stat-value">{account ? fmtMoney(account.equity) : '—'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Cash</div>
          <div className="stat-value">{account ? fmtMoney(account.cash) : '—'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Buying Power</div>
          <div className="stat-value">{account ? fmtMoney(account.buyingPower) : '—'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Bot Positions</div>
          <div className="stat-value">{botPositions.length} / 5</div>
          {externalPositions.length > 0 && (
            <div className="stat-footnote">+{externalPositions.length} not managed by this bot</div>
          )}
        </div>
      </div>

      <div className="strategy-card">
        <div className="strategy-card-title">Strategy: Buzz Momentum</div>
        <dl className="strategy-rules">
          <div>
            <dt>Candidates</dt>
            <dd>
              Symbols newly appearing on Stocktwits' trending list (ranked by how much people are talking
              about them, not by performance) that aren't already held.
            </dd>
          </div>
          <div>
            <dt>Entry filter</dt>
            <dd>Must be up at least 2% on the day, priced $5+, with 500k+ daily volume — buzz alone doesn't qualify.</dd>
          </div>
          <div>
            <dt>Position sizing</dt>
            <dd>
              ~$35 per position, up to 5 concurrent positions — filled by the strongest qualifying movers
              first, not just whichever's most talked about.
            </dd>
          </div>
          <div>
            <dt>Exit</dt>
            <dd>
              Automatic take-profit or stop-loss on every entry. Any position still open when its symbol drops
              off the trending list is closed regardless.
            </dd>
          </div>
          <div>
            <dt>Filters</dt>
            <dd>Skips anything under $5/share or 500k daily volume.</dd>
          </div>
        </dl>
        <p className="strategy-tune">
          <Link to="/settings">Every number here is adjustable in Settings</Link> — nothing is hardcoded.
        </p>
      </div>

      <details className="risk-panel">
        <summary>Before you'd trust this with real money — read this</summary>
        <ul>
          <li>
            <strong>This trades without anyone watching.</strong> The stop-loss and take-profit exist
            specifically to be the missing safety net for that.
          </li>
          <li>
            <strong>"Trending" is attention, not quality.</strong> The 2% momentum filter rules out obviously
            weak entries, but it doesn't turn buzz into a proven edge — professional use of sentiment data
            treats it as a confirming signal alongside other conditions, not a standalone reason to buy.
          </li>
          <li>
            <strong>Stop-losses limit damage, they don't prevent it.</strong> A fast-moving or illiquid stock
            can fill below the stop price (slippage).
          </li>
          <li>
            <strong>This is paper money.</strong> The benchmark chart below exists so you can see whether this
            rule actually beats just buying an index fund — not to claim that it already does.
          </li>
        </ul>
      </details>

      <div className="grid">
        <div className="panel">
          <div className="panel-title">
            <h2>Trending now</h2>
            <span className="count">{trending.length}</span>
          </div>
          {trending.length === 0 ? (
            <div className="empty-state">No trending data yet</div>
          ) : (
            <div className="buzz-list">
              {trending.map((s) => (
                <Link className="buzz-row" key={s.symbol} to={`/stock/${s.symbol}`}>
                  <div>
                    <div className="buzz-symbol">{s.symbol}</div>
                    {s.title && <div className="buzz-title">{s.title}</div>}
                  </div>
                  <div className="buzz-right">
                    {s.changePct !== null && (
                      <span className={Number(s.changePct) >= 0 ? 'pl-positive' : 'pl-negative'}>
                        {fmtSignedPct(s.changePct)}
                      </span>
                    )}
                    <span className="confidence-badge" title="Momentum + liquidity + buzz, 0-100">
                      {s.confidence}
                    </span>
                    <span className={`pill ${heldSymbols.has(s.symbol) ? 'held' : 'not-held'}`}>
                      {heldSymbols.has(s.symbol) ? 'Held' : 'Not held'}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-title">
            <h2>Open positions</h2>
            <span className="count">{positions.length}</span>
          </div>
          {positions.length === 0 ? (
            <div className="empty-state">No open positions</div>
          ) : (
            <div>
              {positions.map((p) => (
                <Link className="position-row" key={p.symbol} to={`/stock/${p.symbol}`}>
                  <div>
                    <div className="position-symbol">
                      {p.symbol}
                      {!p.isBotOwned && <span className="external-tag">not managed by bot</span>}
                    </div>
                    <div className="position-meta">
                      {p.qty} sh @ {fmtMoney(p.avgEntryPrice)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className={Number(p.unrealizedPl) >= 0 ? 'pl-positive' : 'pl-negative'}>
                      {fmtMoney(p.unrealizedPl)}
                    </div>
                    <div className="position-meta">{fmtPct(p.unrealizedPlPct)}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="panel panel-full">
        <div className="panel-title">
          <h2>Performance vs. just buying the S&amp;P 500</h2>
        </div>
        <div className="performance-body">
          <div className="performance-stats">
            <div className="stat-card">
              <div className="stat-label">Closed trades</div>
              <div className="stat-value">{summary?.closedCount ?? 0}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Win rate</div>
              <div className="stat-value">
                {summary?.winRate === null || summary?.winRate === undefined ? '—' : fmtPct(summary.winRate)}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Strategy P/L</div>
              <div className={`stat-value ${(summary?.totalRealizedPl ?? 0) >= 0 ? 'pl-positive' : 'pl-negative'}`}>
                {summary ? fmtSignedMoney(summary.totalRealizedPl) : '—'}
              </div>
            </div>
            {benchmark?.series?.length > 1 && (
              <div className="stat-card">
                <div className="stat-label">S&amp;P 500, same $</div>
                <div
                  className={`stat-value ${benchmark.series[benchmark.series.length - 1].benchmarkPl >= 0 ? 'pl-positive' : 'pl-negative'}`}
                >
                  {fmtSignedMoney(benchmark.series[benchmark.series.length - 1].benchmarkPl)}
                </div>
              </div>
            )}
            <div className="stat-card">
              <div className="stat-label">Sharpe ratio</div>
              <div className="stat-value">
                {summary?.sharpeRatio === null || summary?.sharpeRatio === undefined
                  ? '—'
                  : summary.sharpeRatio.toFixed(2)}
              </div>
              <div className="stat-footnote">Needs a few days of history</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Max drawdown</div>
              <div className="stat-value pl-negative">
                {summary?.maxDrawdownPct === null || summary?.maxDrawdownPct === undefined
                  ? '—'
                  : fmtPct(summary.maxDrawdownPct)}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Avg win / avg loss</div>
              <div className="stat-value">
                <span className="pl-positive">{summary?.avgWin ? fmtSignedMoney(summary.avgWin) : '—'}</span>
                {' / '}
                <span className="pl-negative">{summary?.avgLoss ? fmtSignedMoney(summary.avgLoss) : '—'}</span>
              </div>
            </div>
            <div className="chart-legend">
              <span className="legend-swatch strategy" /> This strategy
              {chartLines && (
                <>
                  <span className="legend-swatch benchmark" /> S&amp;P 500
                </>
              )}
            </div>
          </div>
          <div className="chart-wrap">
            {chartLines ? (
              <LineChart series={benchmark.series} lines={chartLines} />
            ) : (
              <LineChart series={summary?.series?.map((s) => ({ strategyPl: s.cumulative })) ?? []} lines={[{ key: 'strategyPl' }]} />
            )}
          </div>
        </div>
      </div>
    </>
  )
}
