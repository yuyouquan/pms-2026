'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Avatar, Button, Space, Tabs, Tag, Tooltip, Typography } from 'antd'
import {
  CalendarOutlined,
  EditOutlined,
  FileOutlined,
  InfoCircleOutlined,
  LinkOutlined,
  ProjectOutlined,
  SettingOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import CollapsibleInformationSection from '@/components/project-info/CollapsibleInformationSection'
import ProjectInformationFrame from '@/components/project-info/ProjectInformationFrame'
import SubprojectConfigModal from '@/components/technical-project/SubprojectConfigModal'
import TechnicalPlanSummary from '@/components/technical-project/TechnicalPlanSummary'
import TechnicalProjectBasicInfo from '@/components/technical-project/TechnicalProjectBasicInfo'
import {
  TECHNICAL_PROJECT_SPACE_BASIC_FIELDS,
  TECHNICAL_PROJECT_SPACE_CORE_FIELDS,
} from '@/constants/projectInfoSchema'
import { TECHNICAL_DELIVERABLE_FIELDS, TECHNICAL_TEAM_FIELDS } from '@/constants/technicalProject'
import {
  isTechnicalSubprojectConfigured,
  resolveTechnicalInformationModules,
  sanitizeTechnicalDeliverableUrl,
  type TechnicalInformationTab,
} from '@/lib/technicalProjectRules'
import { getTechnicalPlanKey, type TechnicalPlanScope } from '@/stores/technicalPlan'
import { useProjectStore } from '@/stores/project'
import { useTechnicalProjectStore } from '@/stores/technicalProject'
import type { ProjectItem } from '@/types/app'
import type { DeliverableValue, TechnicalSubproject } from '@/types/technicalProject'

const { Text } = Typography

type ProjectRole = { name: string; members: string[]; isFixed?: boolean }

export interface TechnicalProjectInformationViewProps {
  project: ProjectItem
  stage: string
  customRoles?: readonly ProjectRole[]
  currentLoginUser?: string
  onEdit?: () => void
  canEdit?: boolean
  canEditPlan?: boolean
}

const valueOf = (project: ProjectItem, key: string) => (
  (project as unknown as Record<string, unknown>)[key] ?? project.fieldValues?.[key]
)

const displayText = (value: unknown) => String(value ?? '').trim() || '-'

const membersOf = (value: unknown) => {
  if (Array.isArray(value)) return value.map(String).map(item => item.trim()).filter(Boolean)
  const member = String(value ?? '').trim()
  return member ? [member] : []
}

const renderDeliverable = (value: unknown) => {
  const deliverable = value as DeliverableValue | undefined
  if (!deliverable) return <Text type="secondary">未上传</Text>
  if (deliverable.kind === 'url') {
    const safeUrl = sanitizeTechnicalDeliverableUrl(deliverable.url)
    return safeUrl ? (
      <a href={safeUrl} target="_blank" rel="noopener noreferrer" className="technical-deliverable-link">
        <LinkOutlined aria-hidden />
        <span>打开链接</span>
      </a>
    ) : <Text type="secondary">链接不可用</Text>
  }
  return (
    <Space size={8} wrap>
      <FileOutlined style={{ color: 'var(--pms-brand)' }} aria-hidden />
      <Text ellipsis={{ tooltip: deliverable.name }} style={{ maxWidth: 220 }}>{deliverable.name}</Text>
      <Tag color="geekblue">{Math.max(1, Math.ceil(deliverable.size / 1024))} KB</Tag>
    </Space>
  )
}

export default function TechnicalProjectInformationView({
  project,
  stage,
  currentLoginUser,
  onEdit,
  canEdit = false,
  canEditPlan = false,
}: TechnicalProjectInformationViewProps) {
  const tdtKey = getTechnicalPlanKey({ kind: 'tdt', parentProjectId: project.id })
  const [activeKey, setActiveKey] = useState(tdtKey)
  const [configuringChild, setConfiguringChild] = useState<TechnicalSubproject | null>(null)
  const [configTrigger, setConfigTrigger] = useState<HTMLElement | null>(null)
  const initializedProject = useRef('')
  const projects = useProjectStore(state => state.projects)
  const subprojects = useTechnicalProjectStore(state => state.subprojects)
  const allChildren = useMemo(() => subprojects
    .filter(item => item.parentProjectId === project.id)
    .sort((left, right) => left.ipmOrder - right.ipmOrder || left.id.localeCompare(right.id)), [project.id, subprojects])
  const visibleChildren = useMemo(() => allChildren.filter(item => item.active), [allChildren])

  useEffect(() => {
    if (initializedProject.current === project.id) return
    initializedProject.current = project.id
    setConfiguringChild(null)
    setConfigTrigger(null)
    setActiveKey(tdtKey)
  }, [project.id, tdtKey])

  useEffect(() => {
    const targetChildId = window.sessionStorage.getItem('pms:technical-project-list-target-child') || ''
    if (targetChildId) window.sessionStorage.removeItem('pms:technical-project-list-target-child')
    const target = allChildren.find(child => child.id === targetChildId && child.active)
    if (!target) return
    setActiveKey(getTechnicalPlanKey({ kind: 'subproject', parentProjectId: project.id, subprojectId: target.id }))
  }, [allChildren, project.id, tdtKey])

  useEffect(() => {
    if (activeKey === tdtKey) return
    const activeChildId = activeKey.split(':subproject:')[1]
    if (!visibleChildren.some(child => child.id === activeChildId)) setActiveKey(tdtKey)
  }, [activeKey, tdtKey, visibleChildren])

  const activeChild = visibleChildren.find(child => (
    getTechnicalPlanKey({ kind: 'subproject', parentProjectId: project.id, subprojectId: child.id }) === activeKey
  ))
  const activeTab: TechnicalInformationTab = activeChild
    ? { kind: 'subproject', active: activeChild.active }
    : { kind: 'tdt' }
  const modules = resolveTechnicalInformationModules(activeTab)
  const activeScope: TechnicalPlanScope = activeChild
    ? { kind: 'subproject', parentProjectId: project.id, subprojectId: activeChild.id }
    : { kind: 'tdt', parentProjectId: project.id }
  const activeLabel = activeChild?.name || 'TDT'
  const machineName = (id: string) => projects.find(item => item.id === id)?.name || id || '-'

  const roles = TECHNICAL_TEAM_FIELDS.map(field => ({
    name: field.label,
    members: membersOf(valueOf(project, field.key)),
  }))
  const technicalCoreAccentByKey: Record<string, string> = {
    secondaryCategory: '#14b8a6', technicalTrack: '#0891b2', tmg: '#7c3aed', subdomain: '#2563eb',
    status: '#f59e0b', projectStage: '#d97706', projectYear: '#059669', projectValue: '#475569',
    preProjectId: '#0f766e', tdtAndSubprojectName: 'var(--pms-brand-strong)',
  }
  const technicalCoreValue = (key: string) => {
    if (key === 'projectStage') return stage
    if (key === 'preProjectId') return machineName(displayText(valueOf(project, key)) === '-' ? '' : displayText(valueOf(project, key)))
    if (key === 'tdtAndSubprojectName') return [project.name, ...visibleChildren.map(child => child.name)].join('、')
    return displayText(valueOf(project, key))
  }
  const coreFields = TECHNICAL_PROJECT_SPACE_CORE_FIELDS.map(field => ({
    label: field.label,
    value: technicalCoreValue(field.key),
    accent: technicalCoreAccentByKey[field.key] || 'var(--pms-brand-strong)',
    fullWidth: field.key === 'projectValue',
  }))
  const technicalBasicValue = (key: string) => (
    key === 'firstMachineProjectId'
      ? machineName(displayText(valueOf(project, key)) === '-' ? '' : displayText(valueOf(project, key)))
      : displayText(valueOf(project, key))
  )
  const tabItems = [
    { key: tdtKey, label: 'TDT' },
    ...visibleChildren.map(child => ({
      key: getTechnicalPlanKey({ kind: 'subproject', parentProjectId: project.id, subprojectId: child.id }),
      label: (
        <Space size={5} className="technical-child-tab-label">
          <span>{child.name}</span>
          {!isTechnicalSubprojectConfigured(child) && <Tag color="warning" style={{ margin: 0 }}>待配置</Tag>}
          {(
            <Tooltip title="配置子任务信息">
              <Button
                type="text"
                size="small"
                className="technical-child-config-button"
                aria-label={`配置子任务 ${child.name}`}
                icon={<SettingOutlined />}
                onClick={event => {
                  event.preventDefault()
                  event.stopPropagation()
                  setConfigTrigger(event.currentTarget)
                  setConfiguringChild(child)
                }}
              />
            </Tooltip>
          )}
        </Space>
      ),
    })),
  ]

  return (
    <div className="technical-project-space pms-project-space" aria-label="技术项目基础信息">
      <ProjectInformationFrame
        projectName={project.name}
        coreFields={coreFields}
        actions={onEdit && (
          <div className="pms-project-info-core-actions">
            {canEdit
              ? <Button icon={<EditOutlined />} onClick={onEdit}>编辑</Button>
              : <Tooltip title="无基础信息编辑权限"><Button icon={<EditOutlined />} disabled>编辑</Button></Tooltip>}
          </div>
        )}
        planInformation={(
          <div className="technical-information-plan pms-solid-surface">
            <div className="technical-information-tabs pms-toolbar" aria-label="技术信息分类">
              <Tabs activeKey={activeKey} onChange={setActiveKey} items={tabItems} />
            </div>
            {modules.plan && <TechnicalPlanSummary scope={activeScope} label={activeLabel} canEditPlan={canEditPlan} />}
            {activeTab.kind === 'subproject' && (
              <div className="technical-information-subproject-basic">
                <TechnicalProjectBasicInfo
                  subproject={activeChild!}
                  machineName={machineName}
                  readOnly={modules.readOnly}
                />
              </div>
            )}
          </div>
        )}
        informationSections={(
          <div className="pms-project-info-sections" aria-label="技术信息内容">
            {activeTab.kind === 'tdt' && (
              <div data-section="technical-basic-information">
                <CollapsibleInformationSection title="基础信息" icon={<InfoCircleOutlined />} variant="basic" count={TECHNICAL_PROJECT_SPACE_BASIC_FIELDS.length}>
                  <div className="pms-project-info-display-rows">
                    <div className="pms-project-info-display-grid pms-project-info-display-grid--technical-basic">
                      {TECHNICAL_PROJECT_SPACE_BASIC_FIELDS.map(field => (
                        <div className="pms-project-info-display-item" key={field.key}>
                          <div className="pms-project-info-display-label">{field.label}</div>
                          <div className="pms-project-info-display-value">{technicalBasicValue(field.key)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CollapsibleInformationSection>
              </div>
            )}
            <CollapsibleInformationSection title="团队信息" icon={<TeamOutlined />} variant="team" count={roles.length}>
              <div className="pms-project-info-team-grid">
                {roles.map(role => (
                  <div className="pms-project-info-team-role" key={role.name}>
                    <div className="pms-project-info-team-role-name">
                      {role.name}
                    </div>
                    <div className="pms-project-info-team-members">
                      {role.members.length ? role.members.map(member => (
                        <div className="pms-project-info-team-member" key={member}>
                          <Avatar size={26} className="pms-project-info-role-avatar">{member.slice(0, 1)}</Avatar>
                          <span>{member}</span>
                        </div>
                      )) : <span className="pms-project-info-empty">未配置</span>}
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleInformationSection>
            <CollapsibleInformationSection title="交付物信息" icon={<FileOutlined />} variant="deliverable" count={TECHNICAL_DELIVERABLE_FIELDS.length}>
              <div className="technical-deliverable-grid">
                {TECHNICAL_DELIVERABLE_FIELDS.map(field => (
                  <div className="technical-deliverable-item" key={field.key}>
                    <Text type="secondary" className="technical-deliverable-label">{field.label}</Text>
                    {renderDeliverable(valueOf(project, field.key))}
                  </div>
                ))}
              </div>
            </CollapsibleInformationSection>
          </div>
        )}
        anchorItems={[
          { id: 'section-header', label: '核心信息', icon: <ProjectOutlined /> },
          { id: 'section-plan', label: '计划信息', icon: <CalendarOutlined /> },
          { id: 'section-basic', label: '基础信息', icon: <SettingOutlined /> },
        ]}
      />
      <SubprojectConfigModal
        open={Boolean(configuringChild)}
        subproject={configuringChild}
        currentLoginUser={currentLoginUser}
        returnFocusTo={configTrigger}
        onCancel={() => setConfiguringChild(null)}
      />
    </div>
  )
}
