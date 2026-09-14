'use client'

import type { CSSProperties, ReactNode } from 'react'
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

export const resolveProjectInformationCoreColumnCount = (
  fields: readonly Pick<ProjectInformationCoreField, 'fullWidth'>[],
) => Math.min(8, Math.max(1, fields.filter(field => !field.fullWidth).length))

function ProjectCoreFieldsCard({
  projectName,
  coreFields,
  actions,
}: Pick<ProjectInformationFrameProps, 'projectName' | 'coreFields' | 'actions'>) {
  const coreColumnCount = resolveProjectInformationCoreColumnCount(coreFields)
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
        style={{ '--pms-project-info-core-columns': coreColumnCount } as CSSProperties}
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
    <section id={anchorId} className="pms-project-information-slot pms-project-section pms-solid-surface">
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
  embedded = false,
}: ProjectInformationFrameProps) {
  return (
    <div
      className={`pms-project-information-frame pms-project-information-surface${embedded ? ' pms-project-information-frame--embedded' : ''}`}
      style={embedded ? undefined : { maxWidth: 1400, margin: '0 auto' }}
    >
      <ProjectCoreFieldsCard projectName={projectName} coreFields={coreFields} actions={actions} />
      {embedded ? planInformation : <ProjectInformationSlot anchorId="section-plan">{planInformation}</ProjectInformationSlot>}
      {embedded ? informationSections : <ProjectInformationSlot anchorId="section-basic">{informationSections}</ProjectInformationSlot>}
    </div>
  )
}
