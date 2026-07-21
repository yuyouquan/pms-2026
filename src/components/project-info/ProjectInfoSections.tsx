'use client'

import { useMemo } from 'react'
import { Avatar, Collapse, Space, Tag, message } from 'antd'
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
  normalizeTeamMembers,
  type ProjectInfoProject,
} from '@/lib/projectInfoValues'

interface ProjectInfoSectionsProps {
  project: ProjectInfoProject
  currentUser: string
  canConfigure: boolean
  visibleGroupKeys?: ProjectInfoGroupKey[]
}

const GROUP_ICON: Record<ProjectInfoGroupKey, React.ReactNode> = {
  basic: <InfoCircleOutlined />,
  extended: <ToolOutlined />,
  team: <TeamOutlined />,
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
  const [messageApi, messageContextHolder] = message.useMessage()
  const fields = useMemo(
    () => getFieldsForGroup(project.type, group.key),
    [group.key, project.type],
  )
  const { visibleFieldKeys, setVisibleFieldKeys } = useProjectFieldVisibility({
    userId: currentUser,
    projectId: project.id,
    groupKey: group.key,
    fields,
    onSaveError: () => {
      void messageApi.error('字段显示配置保存失败')
    },
  })
  const values = buildProjectInfoValues(project, fields.map(field => field.key))
  const visibleFields = fields.filter(field => (
    visibleFieldKeys.includes(field.key)
    && (!field.visibleWhen || field.visibleWhen(values))
  ))
  return (
    <>
      {messageContextHolder}
      <Collapse
        className={`pms-project-info-collapse pms-project-info-collapse--${group.key}`}
        defaultActiveKey={[]}
        items={[{
          key: group.key,
          label: (
            <div className="pms-project-info-group-heading">
              <span className="pms-project-info-group-icon" aria-hidden="true">
                {GROUP_ICON[group.key]}
              </span>
              <span className="pms-project-info-group-title">
                <strong>{group.label}</strong>
                <span className="pms-project-info-group-count">{visibleFields.length} 项</span>
              </span>
            </div>
          ),
          extra: (
            <FieldVisibilityPicker
              groupLabel={group.label}
              fields={fields}
              visibleFieldKeys={visibleFieldKeys}
              onChange={setVisibleFieldKeys}
              disabled={!canConfigure}
            />
          ),
          children: group.key === 'team' ? (
            <div className="pms-project-info-team-grid">
              {visibleFields.map(field => {
                const members = normalizeTeamMembers(getProjectInfoValue(project, field.key))
                return (
                  <article key={field.key} className="pms-project-info-team-role">
                    <div className="pms-project-info-team-role-name">{field.label}</div>
                    <div className="pms-project-info-team-members">
                      {members.length ? members.map(name => (
                        <span key={name} className="pms-project-info-team-member">
                          <Avatar size={28} className="pms-project-info-role-avatar">{name.slice(0, 1)}</Avatar>
                          <span>{name}</span>
                        </span>
                      )) : <span className="pms-project-info-empty">未配置</span>}
                    </div>
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="pms-project-info-display-rows">
              <div className="pms-project-info-display-grid">
                {visibleFields.map(field => (
                  <div key={field.key} className="pms-project-info-display-item">
                    <div className="pms-project-info-display-label">{field.label}</div>
                    <div className="pms-project-info-display-value">{renderNormalValue(getProjectInfoValue(project, field.key), field.inputType)}</div>
                  </div>
                ))}
              </div>
            </div>
          ),
        }]}
      />
    </>
  )
}

export default function ProjectInfoSections({
  project,
  currentUser,
  canConfigure,
  visibleGroupKeys,
}: ProjectInfoSectionsProps) {
  const groups = getProjectInfoGroups(project.type)
    .filter(group => !visibleGroupKeys || visibleGroupKeys.includes(group.key))
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
