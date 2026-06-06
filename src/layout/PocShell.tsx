import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { DEFAULT_POC_ID, POCS } from '../pocs/registry'
import type { PocEntry } from '../pocs/types'
import ParticleBackground from '../background/ParticleBackground'
import { getThemeForPoc } from '../background/particleThemes'
import './PocShell.css'

const ORDER_STORAGE_KEY = 'poc-lab:nav-order'

/** Move the dragged entry so it sits where the entry it was dropped onto is. */
function reorder(list: PocEntry[], fromId: string, toId: string): PocEntry[] {
  if (fromId === toId) return list
  const next = [...list]
  const fromIdx = next.findIndex((p) => p.id === fromId)
  const toIdx = next.findIndex((p) => p.id === toId)
  if (fromIdx === -1 || toIdx === -1) return list
  const [moved] = next.splice(fromIdx, 1)
  next.splice(toIdx, 0, moved)
  return next
}

/**
 * Restore the saved nav order from localStorage, reconciled against the current
 * registry: known ids keep their saved order, unknown saved ids are dropped, and
 * any newly-registered POCs are appended in registry order.
 */
function loadOrder(): PocEntry[] {
  try {
    const raw = localStorage.getItem(ORDER_STORAGE_KEY)
    if (!raw) return POCS
    const savedIds = JSON.parse(raw) as unknown
    if (!Array.isArray(savedIds)) return POCS
    const byId = new Map(POCS.map((p) => [p.id, p]))
    const ordered: PocEntry[] = []
    for (const id of savedIds) {
      const poc = typeof id === 'string' ? byId.get(id) : undefined
      if (poc) {
        ordered.push(poc)
        byId.delete(poc.id)
      }
    }
    for (const poc of POCS) if (byId.has(poc.id)) ordered.push(poc)
    return ordered
  } catch {
    return POCS
  }
}

export default function PocShell() {
  const [activeId, setActiveId] = useState(DEFAULT_POC_ID)
  const [pocs, setPocs] = useState<PocEntry[]>(loadOrder)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const dragId = useRef<string | null>(null)

  // Persist the chosen order so it survives a refresh.
  useEffect(() => {
    try {
      localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(pocs.map((p) => p.id)))
    } catch {
      /* ignore storage failures (private mode, quota, etc.) */
    }
  }, [pocs])

  const activePoc = pocs.find((poc) => poc.id === activeId) ?? pocs[0]

  if (!activePoc) {
    return (
      <div className="poc-shell poc-shell_empty">
        <p>No POCs registered. Add entries to <code>src/pocs/registry.tsx</code>.</p>
      </div>
    )
  }

  const ActiveComponent = activePoc.component
  const accent = getThemeForPoc(activeId).accent
  const shellStyle = { '--lab-accent': accent.join(', ') } as CSSProperties

  const handleDragStart = (id: string): void => {
    dragId.current = id
    setDraggingId(id)
  }

  // Reorder live as the dragged item passes over another, so the list animates.
  const handleDragEnter = (targetId: string): void => {
    const from = dragId.current
    if (!from || from === targetId) return
    setPocs((prev) => reorder(prev, from, targetId))
  }

  const handleDragEnd = (): void => {
    dragId.current = null
    setDraggingId(null)
  }

  return (
    <div className="poc-shell" style={shellStyle}>
      <ParticleBackground activeId={activeId} />
      <aside className="poc-shell__sidebar" aria-label="POC navigation">
        <header className="poc-shell__brand">
          <span className="poc-shell__brand-title">POC Lab</span>
          <span className="poc-shell__brand-subtitle">Experiments · drag to reorder</span>
        </header>
        <nav className="poc-shell__nav">
          <ul className="poc-shell__nav-list">
            {pocs.map((poc) => {
              const isActive = poc.id === activeId
              const isDragging = poc.id === draggingId
              return (
                <li
                  key={poc.id}
                  className={`poc-shell__nav-item${isDragging ? ' poc-shell__nav-item_dragging' : ''}`}
                  draggable
                  onDragStart={() => handleDragStart(poc.id)}
                  onDragEnter={() => handleDragEnter(poc.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDragEnd={handleDragEnd}
                  onDrop={(e) => e.preventDefault()}
                >
                  <button
                    type="button"
                    className={`poc-shell__nav-btn${isActive ? ' poc-shell__nav-btn_active' : ''}`}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => setActiveId(poc.id)}
                  >
                    <span className="poc-shell__nav-grip" aria-hidden="true" />
                    <span className="poc-shell__nav-text">
                      <span className="poc-shell__nav-label">{poc.label}</span>
                      {poc.description ? (
                        <span className="poc-shell__nav-desc">{poc.description}</span>
                      ) : null}
                    </span>
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
