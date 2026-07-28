'use client'

import type { ReactNode } from 'react'
import { Button, Card, Tooltip } from 'antd'
import { EditOutlined, ProjectOutlined, SendOutlined } from '@ant-design/icons'
import ProjectInfoSections from '@/components/project-info/ProjectInfoSections'
import type { ProjectInfoGroupKey } from '@/constants/projectInfoSchema'
import { isMachineProjectType, resolveProjectClassification } from '@/constants/projectTypes'
import { formatProjectInfoValue, getProjectInfoValue, type ProjectInfoProject } from '@/lib/projectInfoValues'

interface TargetProjectInformationViewProps {
  project: ProjectInfoProject
  currentUser: string
  canEdit: boolean
  canConfigure: boolean
  onEdit: () => void
  onApplyTransfer?: () => void
  afterCore?: ReactNode
  visibleGroupKeys?: ProjectInfoGroupKey[]
}

const HEALTH_CONFIG: Record<string, { label: string; color: string }> = {
  normal: { label: '正常', color: '#10b981' },
  warning: { label: '关注', color: '#f59e0b' },
  risk: { label: '风险', color: '#ef4444' },
}

export default function TargetProjectInformationView({
  project,
  currentUser,
  canEdit,
  canConfigure,
  onEdit,
  onApplyTransfer,
  afterCore,
  visibleGroupKeys,
}: TargetProjectInformationViewProps) {
  const isWholeMachine = isMachineProjectType(project.type)
  const classification = resolveProjectClassification(
    project.type,
    typeof project.secondaryCategory === 'string' ? project.secondaryCategory : undefined,
  )
  const classificationLabel = classification.secondaryCategory
    ? `${classification.projectCategory} · ${classification.secondaryCategory}`
    : classification.projectCategory
  const status = String(project.status || '-')
  const health = HEALTH_CONFIG[String(project.healthStatus || 'normal')] || HEALTH_CONFIG.normal
  const showCancelPauseDate = ['暂停', '已暂停', '已取消'].includes(status)
  const coreFields = isWholeMachine ? [
    { label: '项目名称', value: project.name, accent: '#4f46e5' },
    { label: '市场名', value: String(project.marketName || '-'), accent: '#8b5cf6' },
    { label: '品牌', value: String(project.brand || '-'), accent: '#06b6d4' },
    { label: '产品线', value: String(project.productLine || '-'), accent: '#0ea5e9' },
    { label: '项目状态', value: status, accent: '#f59e0b' },
    ...(showCancelPauseDate ? [{ label: '取消暂停时间', value: formatProjectInfoValue(getProjectInfoValue(project, 'cancelPauseDate')), accent: '#f97316' }] : []),
    { label: '项目分类', value: classificationLabel, accent: '#14b8a6' },
    { label: '健康状态', value: health.label, accent: health.color },
    { label: '下一个节点', value: String(project.currentNode || '-'), accent: '#f43f5e' },
  ] : [
    { label: '项目名称', value: project.name, accent: '#4f46e5' },
    { label: '项目状态', value: status, accent: '#f59e0b' },
    { label: '项目分类', value: classificationLabel, accent: '#14b8a6' },
    { label: '健康状态', value: health.label, accent: health.color },
    { label: '下一个节点', value: String(project.currentNode || '-'), accent: '#f43f5e' },
  ]

  return (
    <>
      <Card
        id="section-header"
        className="pms-project-info-core-card"
        title={(
          <div className="pms-project-info-core-title" title={project.name}>
            <ProjectOutlined />
            <div className="pms-project-info-core-name">{project.name}</div>
          </div>
        )}
        extra={(
          <div className="pms-project-info-core-actions">
            {isWholeMachine && onApplyTransfer && <Button type="primary" icon={<SendOutlined />} onClick={onApplyTransfer}>申请转维</Button>}
            {canEdit
              ? <Button icon={<EditOutlined />} onClick={onEdit}>编辑</Button>
              : <Tooltip title="无基础信息编辑权限"><Button icon={<EditOutlined />} disabled>编辑</Button></Tooltip>}
          </div>
        )}
      >
        <div
          className="pms-project-info-core-grid"
          role="region"
          aria-label="项目核心字段"
          tabIndex={0}
          style={{ gridTemplateColumns: `repeat(${coreFields.length}, minmax(0, 1fr))` }}
        >
          {coreFields.map(field => (
            <div key={field.label} className="pms-project-info-core-item" style={{ borderTopColor: field.accent }}>
              <div className="pms-project-info-core-label"><span style={{ background: field.accent }} />{field.label}</div>
              <div className="pms-project-info-core-value" style={{ color: field.accent }} title={String(field.value)}>{field.value}</div>
            </div>
          ))}
        </div>
      </Card>
      {afterCore}
      <ProjectInfoSections
        project={project}
        currentUser={currentUser}
        canConfigure={canConfigure}
        visibleGroupKeys={visibleGroupKeys}
      />
    </>
  )
}
