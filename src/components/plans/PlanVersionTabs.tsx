'use client'

import { useRef, type ReactNode, type KeyboardEvent } from 'react'
import type { PlanVersionLike } from '@/lib/marketRules'
import { comparePlanVersions } from '@/lib/planVersioning'

interface PlanVersionTabsProps {
  versions: readonly PlanVersionLike[]
  activeVersion: string
  latestPublishedId?: string
  onChange: (id: string) => void
  renderLabel: (version: PlanVersionLike) => ReactNode
  createRevision?: ReactNode
  draftActions?: ReactNode
}

export function PlanVersionTabs({ versions, activeVersion, latestPublishedId, onChange, renderLabel, createRevision, draftActions }: PlanVersionTabsProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const orderedVersions = [...versions].sort((a, b) => comparePlanVersions(b, a))
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const nextIndex = event.key === 'ArrowRight' ? (index + 1) % orderedVersions.length
      : event.key === 'ArrowLeft' ? (index + orderedVersions.length - 1) % orderedVersions.length
        : event.key === 'Home' ? 0 : event.key === 'End' ? orderedVersions.length - 1 : -1
    if (nextIndex < 0) return
    event.preventDefault()
    listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[nextIndex]?.focus()
  }
  return (
    <div className="pms-plan-version-tabs" role="tablist" aria-label="计划版本" ref={listRef}>
      {!latestPublishedId && createRevision}
      {orderedVersions.map((version, index) => {
        const active = version.id === activeVersion
        return (
          <div className="pms-plan-version-item" key={version.id}>
            {version.id === latestPublishedId && createRevision}
            <div className={`pms-plan-version-tab${active ? ' is-active' : ''}`}>
              <button
                type="button"
                role="tab"
                aria-selected={active}
                tabIndex={active ? 0 : -1}
                onClick={() => { if (!active) onChange(version.id) }}
                onKeyDown={event => handleKeyDown(event, index)}
              >
                {renderLabel(version)}
              </button>
              {active && version.status === '修订中' && <span className="pms-plan-version-actions">{draftActions}</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
