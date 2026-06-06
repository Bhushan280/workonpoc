import { useState } from 'react'
import { DEFAULT_POC_ID, POCS } from '../pocs/registry'
import './PocShell.css'

export default function PocShell() {
  const [activeId, setActiveId] = useState(DEFAULT_POC_ID)
  const activePoc = POCS.find((poc) => poc.id === activeId) ?? POCS[0]

  if (!activePoc) {
    return (
      <div className="poc-shell poc-shell_empty">
        <p>No POCs registered. Add entries to <code>src/pocs/registry.tsx</code>.</p>
      </div>
    )
  }

  const ActiveComponent = activePoc.component

  return (
    <div className="poc-shell">
      <aside className="poc-shell__sidebar" aria-label="POC navigation">
        <header className="poc-shell__brand">
          <span className="poc-shell__brand-title">POC Lab</span>
          <span className="poc-shell__brand-subtitle">Experiments</span>
        </header>
        <nav className="poc-shell__nav">
          <ul className="poc-shell__nav-list">
            {POCS.map((poc) => {
              const isActive = poc.id === activeId
              return (
                <li key={poc.id} className="poc-shell__nav-item">
                  <button
                    type="button"
                    className={`poc-shell__nav-btn${isActive ? ' poc-shell__nav-btn_active' : ''}`}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => setActiveId(poc.id)}
                  >
                    <span className="poc-shell__nav-label">{poc.label}</span>
                    {poc.description ? (
                      <span className="poc-shell__nav-desc">{poc.description}</span>
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>
      </aside>
      <main className="poc-shell__main" id="poc-main">
        <ActiveComponent />
      </main>
    </div>
  )
}
