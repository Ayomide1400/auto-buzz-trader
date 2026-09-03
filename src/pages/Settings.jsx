import { useEffect, useState } from 'react'
import { fetchJson, fmtPct } from '../lib/api'

const FIELDS = [
  { key: 'notionalPerTrade', label: 'Dollars per trade', min: 5, max: 500, step: 5, format: (v) => `$${v}` },
  { key: 'maxOpenPositions', label: 'Max open positions', min: 1, max: 15, step: 1, format: (v) => v },
  { key: 'takeProfitPct', label: 'Take-profit target', min: 0.01, max: 0.5, step: 0.01, format: (v) => fmtPct(v) },
  { key: 'stopLossPct', label: 'Stop-loss limit', min: 0.01, max: 0.3, step: 0.01, format: (v) => fmtPct(v) },
  { key: 'minPrice', label: 'Minimum share price', min: 1, max: 100, step: 1, format: (v) => `$${v}` },
  { key: 'minVolume', label: 'Minimum daily volume', min: 0, max: 5_000_000, step: 50_000, format: (v) => v.toLocaleString() },
]

export default function Settings() {
  const [config, setConfig] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetchJson('/api/config').then(setConfig)
  }, [])

  function updateField(key, value) {
    setConfig((c) => ({ ...c, [key]: Number(value) }))
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const next = await fetchJson('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      setConfig(next)
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  if (!config) return <div className="empty-state">Loading settings…</div>

  return (
    <div className="panel panel-full">
      <div className="panel-title">
        <h2>Strategy settings</h2>
      </div>
      <p className="panel-note">
        No code to edit — every threshold the daily cron uses lives here. Changes apply on the next scheduled
        run.
      </p>

      <div className="settings-grid">
        {FIELDS.map((f) => (
          <div className="settings-row" key={f.key}>
            <div className="settings-label">
              <span>{f.label}</span>
              <span className="settings-value">{f.format(config[f.key])}</span>
            </div>
            <input
              type="range"
              min={f.min}
              max={f.max}
              step={f.step}
              value={config[f.key]}
              onChange={(e) => updateField(f.key, e.target.value)}
            />
          </div>
        ))}

        <label className="settings-toggle-row">
          <input
            type="checkbox"
            checked={config.requirePositiveDay}
            onChange={(e) => {
              setConfig((c) => ({ ...c, requirePositiveDay: e.target.checked }))
              setSaved(false)
            }}
          />
          Only buy stocks that are also up on the day (not just trending)
        </label>
      </div>

      <button className="save-btn" onClick={handleSave} disabled={saving}>
        {saving ? 'Saving…' : 'Save settings'}
      </button>
      {saved && <span className="trade-message">Saved — takes effect on the next cron run.</span>}
    </div>
  )
}
