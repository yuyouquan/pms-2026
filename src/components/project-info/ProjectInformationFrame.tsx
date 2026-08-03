'use client'

import type { ReactNode } from 'react'
import { Card } from 'antd'
import { ProjectOutlined } from '@ant-design/icons'

export interface ProjectInformationCoreField {
  label: string
  value: ReactNode
  accent: string
  fullWidth?: boolean
}

export interface ProjectInformationAnchorItem {
  id: string
  label: string
  icon: ReactNode
}

interface ProjectInformationFrameProps {
  projectName: string
  coreFields: ProjectInformationCoreField[]
  actions: ReactNode
  planInformation: ReactNode
  informationSections: ReactNode
  anchorItems: ProjectInformationAnchorItem[]
  /**
   * Compatibility mode for a host that still owns the page width and anchor navigation.
   * This is a layout concern only and must not contain project-type decisions.
   */
  embedded?: boolean
}

function ProjectInformationAnchorNav({ items }: { items: ProjectInformationAnchorItem[] }) {
  const scrollToSection = (id: string) => {
    const container = document.getElementById('basic-info-scroll-container')
    const target = document.getElementById(id)
    if (!container || !target) return

    const containerRect = container.getBoundingClientRect()
    const targetRect = target.getBoundingClientRect()
    const offset = targetRect.top - containerRect.top + container.scrollTop - 16
    container.scrollTo({ top: offset, behavior: 'smooth' })
  }

  return (
    <nav
      aria-label="项目信息导航"
      style={{ position: 'fixed', right: 32, top: 130, zIndex: 50, width: 150 }}
    >
      <div style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(12px)', borderRadius: 14, border: '1px solid rgba(99,102,241,0.1)', padding: '16px 0 12px', boxShadow: '0 4px 16px rgba(99,102,241,0.08)' }}>
        <div style={{ padding: '0 16px 10px', fontSize: 10, fontWeight: 700, color: '#a5b4fc', letterSpacing: 3, textTransform: 'uppercase' }}>导航</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {items.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => scrollToSection(item.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 16px', color: '#64748b', fontSize: 12, fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer', border: 0, borderLeft: '2px solid transparent', background: 'transparent', transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)' }}
              onMouseEnter={(event) => {
                event.currentTarget.style.background = 'linear-gradient(90deg, rgba(99,102,241,0.08) 0%, transparent 100%)'
                event.currentTarget.style.color = '#6366f1'
                event.currentTarget.style.borderLeftColor = '#6366f1'
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.background = 'transparent'
                event.currentTarget.style.color = '#64748b'
                event.currentTarget.style.borderLeftColor = 'transparent'
              }}
            >
              <span style={{ fontSize: 13, opacity: 0.7 }}>{item.icon}</span>
              <span style={{ fontWeight: 500 }}>{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </nav>
  )
}

function ProjectCoreFieldsCard({
  projectName,
  coreFields,
  actions,
}: Pick<ProjectInformationFrameProps, 'projectName' | 'coreFields' | 'actions'>) {
  return (
    <Card
      id="section-header"
      className="pms-project-info-core-card"
      title={(
        <div className="pms-project-info-core-title" title={projectName}>
          <ProjectOutlined />
          <div className="pms-project-info-core-name">{projectName}</div>
        </div>
      )}
      extra={actions}
    >
      <div
        className="pms-project-info-core-grid"
        role="region"
        aria-label="项目核心字段"
        tabIndex={0}
        style={{ gridTemplateColumns: `repeat(${coreFields.length}, minmax(0, 1fr))` }}
      >
        {coreFields.map(field => (
          <div
            key={field.label}
            className={`pms-project-info-core-item${field.fullWidth ? ' pms-project-info-core-item--full-width' : ''}`}
            style={{
              borderTopColor: field.accent,
              ...(field.fullWidth ? { gridColumn: '1 / -1' } : {}),
            }}
          >
            <div className="pms-project-info-core-label"><span style={{ background: field.accent }} />{field.label}</div>
            <div className="pms-project-info-core-value" style={{ color: field.accent }} title={typeof field.value === 'string' ? field.value : undefined}>{field.value}</div>
          </div>
        ))}
      </div>
    </Card>
  )
}

function ProjectInformationSlot({ anchorId, children }: { anchorId: string; children: ReactNode }) {
  return (
    <section id={anchorId} className="pms-project-information-slot">
      {children}
    </section>
  )
}

export default function ProjectInformationFrame({
  projectName,
  coreFields,
  actions,
  planInformation,
  informationSections,
  anchorItems,
  embedded = false,
}: ProjectInformationFrameProps) {
  return (
    <div
      className={`pms-project-information-frame${embedded ? ' pms-project-information-frame--embedded' : ''}`}
      style={embedded ? undefined : { maxWidth: 1200, margin: '0 auto', paddingRight: 170 }}
    >
      {!embedded && <ProjectInformationAnchorNav items={anchorItems} />}
      <ProjectCoreFieldsCard projectName={projectName} coreFields={coreFields} actions={actions} />
      {embedded ? planInformation : <ProjectInformationSlot anchorId="section-plan">{planInformation}</ProjectInformationSlot>}
      {embedded ? informationSections : <ProjectInformationSlot anchorId="section-basic">{informationSections}</ProjectInformationSlot>}
    </div>
  )
}
