'use client'

import { Avatar, Collapse, Space, Tag } from 'antd'
import { InfoCircleOutlined, LinkOutlined, TeamOutlined, ToolOutlined } from '@ant-design/icons'
import FieldVisibilityPicker from '@/components/project-info/FieldVisibilityPicker'
import {
  getFieldsForGroup,
  getProjectInfoGroups,
  type ProjectInfoGroupDefinition,
  type ProjectInfoGroupKey,
} from '@/constants/projectInfoSchema'
import { useProjectFieldVisibility } from '@/hooks/useProjectFieldVisibility'
import { formatJiraProjectTag, getJiraProjectUrl, type JiraProjectConfig } from '@/lib/jiraProject'
import {
  buildProjectInfoValues,
  formatProjectInfoValue,
  getProjectInfoValue,
  type ProjectInfoProject,
} from '@/lib/projectInfoValues'

interface ProjectInfoSectionsProps {
  project: ProjectInfoProject
  currentUser: string
  canConfigure: boolean
}

const GROUP_ICON: Record<ProjectInfoGroupKey, React.ReactNode> = {
  basic: <InfoCircleOutlined style={{ color: '#6366f1' }} />,
  extended: <ToolOutlined style={{ color: '#f59e0b' }} />,
  team: <TeamOutlined style={{ color: '#14b8a6' }} />,
}

const isJiraArray = (value: unknown): value is JiraProjectConfig[] => (
  Array.isArray(value) && value.every(item => !!item && typeof item === 'object' && 'id' in item)
)

const renderNormalValue = (value: ReturnType<typeof getProjectInfoValue>, inputType: string) => {
  if (inputType === 'jira' && isJiraArray(value)) {
    if (!value.length) return <span className="pms-project-info-empty">-</span>
    return (
      <Space size={[4, 6]} wrap>
        {value.map(item => (
          <Tag key={item.id} color="blue" icon={<LinkOutlined />}>
            <a href={getJiraProjectUrl(item)} target="_blank" rel="noreferrer">{formatJiraProjectTag(item)}</a>
          </Tag>
        ))}
      </Space>
    )
  }
  const text = formatProjectInfoValue(value)
  if (inputType === 'link' && text !== '-') {
    const isUrl = /^https?:\/\//i.test(text)
    return isUrl ? <a href={text} target="_blank" rel="noreferrer">{text}</a> : <span>{text}</span>
  }
  return <span className={text === '-' ? 'pms-project-info-empty' : undefined}>{text}</span>
}

function ProjectInfoGroupPanel({
  group,
  project,
  currentUser,
  canConfigure,
}: ProjectInfoSectionsProps & { group: ProjectInfoGroupDefinition }) {
  const fields = getFieldsForGroup(project.type, group.key)
  const { visibleFieldKeys, setVisibleFieldKeys } = useProjectFieldVisibility({
    userId: currentUser,
    projectId: project.id,
    groupKey: group.key,
    fields,
  })
  const values = buildProjectInfoValues(project, fields.map(field => field.key))
  const visibleFields = fields.filter(field => (
    visibleFieldKeys.includes(field.key)
    && (!field.visibleWhen || field.visibleWhen(values))
  ))

  return (
    <Collapse
      className="pms-project-info-collapse"
      defaultActiveKey={[]}
      items={[{
        key: group.key,
        label: (
          <Space size={8}>
            {GROUP_ICON[group.key]}
            <strong>{group.label}</strong>
            <Tag bordered={false}>{visibleFields.length} 项</Tag>
          </Space>
        ),
        extra: (
          <FieldVisibilityPicker
            fields={fields}
            visibleFieldKeys={visibleFieldKeys}
            onChange={setVisibleFieldKeys}
            disabled={!canConfigure}
          />
        ),
        children: group.key === 'team' ? (
          <div className="pms-project-info-role-grid">
            {visibleFields.map(field => {
              const value = formatProjectInfoValue(getProjectInfoValue(project, field.key))
              return (
                <div key={field.key} className="pms-project-info-role-card">
                  <Avatar size={30} className="pms-project-info-role-avatar">{value === '-' ? '?' : value.slice(0, 1)}</Avatar>
                  <div>
                    <div className={value === '-' ? 'pms-project-info-empty' : 'pms-project-info-role-name'}>{value}</div>
                    <div className="pms-project-info-role-label">{field.label}</div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="pms-project-info-display-grid">
            {visibleFields.map(field => (
              <div key={field.key} className="pms-project-info-display-item">
                <div className="pms-project-info-display-label">{field.label}</div>
                <div className="pms-project-info-display-value">{renderNormalValue(getProjectInfoValue(project, field.key), field.inputType)}</div>
              </div>
            ))}
          </div>
        ),
      }]}
    />
  )
}

export default function ProjectInfoSections({ project, currentUser, canConfigure }: ProjectInfoSectionsProps) {
  const groups = getProjectInfoGroups(project.type)
  return (
    <div id="section-basic" className="pms-project-info-sections">
      {groups.map(group => (
        <ProjectInfoGroupPanel
          key={group.key}
          group={group}
          project={project}
          currentUser={currentUser}
          canConfigure={canConfigure}
        />
      ))}
    </div>
  )
}
