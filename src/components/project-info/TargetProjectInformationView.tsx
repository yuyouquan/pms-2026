'use client'

import type { ReactNode } from 'react'
import { Button, Tooltip } from 'antd'
import { CalendarOutlined, EditOutlined, ProjectOutlined, SendOutlined, SettingOutlined } from '@ant-design/icons'
import ProjectInfoSections from '@/components/project-info/ProjectInfoSections'
import ProjectInformationFrame from '@/components/project-info/ProjectInformationFrame'
import type { ProjectInfoGroupKey } from '@/constants/projectInfoSchema'
import { PROJECT_CATEGORY_MACHINE, isMachineProjectType, resolveProjectClassification } from '@/constants/projectTypes'
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

export interface HealthPresentation {
  label: string
  color: string
}

export function getHealthPresentation(value: unknown): HealthPresentation {
  const snapshot = String(value || '').trim()
  if (['normal', '正常'].includes(snapshot)) return { label: '正常', color: '#10b981' }
  if (['warning', '关注', '预警'].includes(snapshot)) return { label: '关注', color: '#f59e0b' }
  if (['risk', '风险'].includes(snapshot)) return { label: '风险', color: '#ef4444' }
  return { label: snapshot || '-', color: '#94a3b8' }
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
  const classificationLabel = classification.projectCategory === PROJECT_CATEGORY_MACHINE && classification.secondaryCategory
    ? `${classification.projectCategory} · ${classification.secondaryCategory}`
    : classification.projectCategory
  const status = String(project.status || '-')
  const health = getHealthPresentation(project.healthStatus)
  const showCancelPauseDate = ['暂停', '已暂停', '已取消'].includes(status)
  const coreFields = isWholeMachine ? [
    { label: '项目名称', value: project.name, accent: 'var(--pms-brand-strong)' },
    { label: '市场名', value: String(project.marketName || '-'), accent: '#8b5cf6' },
    { label: '品牌', value: String(project.brand || '-'), accent: '#06b6d4' },
    { label: '产品线', value: String(project.productLine || '-'), accent: '#0ea5e9' },
    { label: '项目状态', value: status, accent: '#f59e0b' },
    ...(showCancelPauseDate ? [{ label: '取消暂停时间', value: formatProjectInfoValue(getProjectInfoValue(project, 'cancelPauseDate')), accent: '#f97316' }] : []),
    { label: '项目分类', value: classificationLabel, accent: '#14b8a6' },
    { label: '健康状态', value: health.label, accent: health.color },
    { label: '下一个节点', value: String(project.currentNode || '-'), accent: '#f43f5e' },
  ] : [
    { label: '项目名称', value: project.name, accent: 'var(--pms-brand-strong)' },
    { label: '项目状态', value: status, accent: '#f59e0b' },
    { label: '项目分类', value: classificationLabel, accent: '#14b8a6' },
    { label: '健康状态', value: health.label, accent: health.color },
    { label: '下一个节点', value: String(project.currentNode || '-'), accent: '#f43f5e' },
  ]

  return (
    <ProjectInformationFrame
      embedded
      projectName={project.name}
      coreFields={coreFields}
      actions={(
        <div className="pms-project-info-core-actions">
          {isWholeMachine && onApplyTransfer && <Button type="primary" icon={<SendOutlined />} onClick={onApplyTransfer}>申请转维</Button>}
          {canEdit
            ? <Button icon={<EditOutlined />} onClick={onEdit}>编辑</Button>
            : <Tooltip title="无基础信息编辑权限"><Button icon={<EditOutlined />} disabled>编辑</Button></Tooltip>}
        </div>
      )}
      planInformation={afterCore}
      informationSections={(
        <ProjectInfoSections
          project={project}
          currentUser={currentUser}
          canConfigure={canConfigure}
          visibleGroupKeys={visibleGroupKeys}
        />
      )}
      anchorItems={[
        { id: 'section-header', label: '项目名称', icon: <ProjectOutlined /> },
        { id: 'section-plan', label: '计划信息', icon: <CalendarOutlined /> },
        { id: 'section-basic', label: '项目信息', icon: <SettingOutlined /> },
      ]}
    />
  )
}
