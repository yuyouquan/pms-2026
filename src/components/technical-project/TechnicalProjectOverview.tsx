'use client'

import { Avatar, Button, Card, Col, Descriptions, Empty, Row, Space, Tag, Typography } from 'antd'
import { EditOutlined, FileOutlined, LinkOutlined, ProjectOutlined, TeamOutlined } from '@ant-design/icons'
import { TECHNICAL_DELIVERABLE_FIELDS, TECHNICAL_TEAM_FIELDS } from '@/constants/technicalProject'
import { normalizeTechnicalCustomRoles, sanitizeTechnicalDeliverableUrl } from '@/lib/technicalProjectRules'
import type { ProjectItem } from '@/types/app'
import type { DeliverableValue } from '@/types/technicalProject'

const { Text, Paragraph } = Typography

type ProjectRole = { name: string; members: string[]; isFixed?: boolean }

export interface TechnicalProjectOverviewProps {
  project: ProjectItem
  stage: string
  customRoles?: readonly ProjectRole[]
  preProjectName?: string
  onEdit?: () => void
  canEdit?: boolean
}

const valueOf = (project: ProjectItem, key: string) => {
  const rootValue = (project as unknown as Record<string, unknown>)[key]
  return rootValue ?? project.fieldValues?.[key]
}

const displayText = (value: unknown) => {
  const text = String(value ?? '').trim()
  return text || '-'
}

const renderDeliverable = (value: unknown) => {
  const deliverable = value as DeliverableValue | undefined
  if (!deliverable) return <Text type="secondary">未上传</Text>
  if (deliverable.kind === 'url') {
    const safeUrl = sanitizeTechnicalDeliverableUrl(deliverable.url)
    if (!safeUrl) return <Text type="secondary">链接不可用</Text>
    return (
      <a href={safeUrl} target="_blank" rel="noopener noreferrer" className="technical-deliverable-link">
        <LinkOutlined aria-hidden />
        <span>打开链接</span>
      </a>
    )
  }
  return (
    <Space size={8} wrap>
      <FileOutlined style={{ color: '#6366f1' }} aria-hidden />
      <Text ellipsis={{ tooltip: deliverable.name }} style={{ maxWidth: 190 }}>{deliverable.name}</Text>
      <Tag color="geekblue">{Math.max(1, Math.ceil(deliverable.size / 1024))} KB</Tag>
    </Space>
  )
}

export default function TechnicalProjectOverview({
  project,
  stage,
  customRoles = [],
  preProjectName,
  onEdit,
  canEdit = false,
}: TechnicalProjectOverviewProps) {
  const projectValue = valueOf(project, 'projectValue')
  const normalizedCustomRoles = normalizeTechnicalCustomRoles(
    customRoles,
    TECHNICAL_TEAM_FIELDS.map(field => field.label),
  )
  const roles = [
    ...TECHNICAL_TEAM_FIELDS.map(field => ({
      name: field.label,
      members: displayText(valueOf(project, field.key)) === '-' ? [] : [displayText(valueOf(project, field.key))],
      fixed: true,
    })),
    ...normalizedCustomRoles.map(role => ({ ...role, fixed: false })),
  ]

  return (
    <div className="technical-project-space" aria-label="技术项目概况">
      <Card
        className="technical-space-card technical-core-card"
        title={<Space><ProjectOutlined /><span>核心信息</span></Space>}
        extra={(
          <Space size={8}>
            <Tag color="purple" style={{ margin: 0 }}>{stage}</Tag>
            {onEdit && (
              <Button
                size="small"
                icon={<EditOutlined />}
                disabled={!canEdit}
                title={canEdit ? '编辑技术项目信息' : '无基础信息编辑权限'}
                onClick={onEdit}
              >
                编辑
              </Button>
            )}
          </Space>
        )}
      >
        <Descriptions className="technical-core-grid" bordered size="small" column={{ xs: 1, sm: 2, xl: 4 }}>
          <Descriptions.Item label="项目名称">{displayText(project.name)}</Descriptions.Item>
          <Descriptions.Item label="项目分类">{displayText(project.secondaryCategory)}</Descriptions.Item>
          <Descriptions.Item label="技术赛道">{displayText(valueOf(project, 'technicalTrack'))}</Descriptions.Item>
          <Descriptions.Item label="TMG及技术领域">{displayText(valueOf(project, 'tmg'))}</Descriptions.Item>
          <Descriptions.Item label="子领域">{displayText(valueOf(project, 'subdomain'))}</Descriptions.Item>
          <Descriptions.Item label="项目阶段"><Tag color="geekblue" style={{ margin: 0 }}>{stage}</Tag></Descriptions.Item>
          <Descriptions.Item label="前置项目">{displayText(preProjectName || valueOf(project, 'preProjectId'))}</Descriptions.Item>
          <Descriptions.Item label="项目年份">{displayText(valueOf(project, 'projectYear'))}</Descriptions.Item>
          <Descriptions.Item label="项目价值" span={4}>
            <Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap', color: projectValue ? '#334155' : '#94a3b8' }}>
              {displayText(projectValue)}
            </Paragraph>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card className="technical-space-card" title={<Space><TeamOutlined /><span>团队信息</span></Space>}>
        <Row gutter={[12, 12]}>
          {roles.map(role => (
            <Col xs={24} sm={12} lg={8} xl={6} key={role.name}>
              <div className="technical-team-role">
                <div className="technical-team-role-title">
                  <span>{role.name}</span>
                  {!role.fixed && <Tag color="purple" bordered={false}>自定义</Tag>}
                </div>
                {role.members.length ? (
                  <div className="technical-team-members">
                    {role.members.map(member => (
                      <Space key={member} size={8}>
                        <Avatar size={28} className="technical-team-avatar">{member.slice(0, 1)}</Avatar>
                        <Text>{member}</Text>
                      </Space>
                    ))}
                  </div>
                ) : <Text type="secondary">待配置</Text>}
              </div>
            </Col>
          ))}
        </Row>
      </Card>

      <Card className="technical-space-card" title={<Space><FileOutlined /><span>交付物信息</span></Space>}>
        <Row gutter={[12, 12]}>
          {TECHNICAL_DELIVERABLE_FIELDS.map(field => (
            <Col xs={24} md={12} xl={8} key={field.key}>
              <div className="technical-deliverable-item">
                <Text type="secondary" className="technical-deliverable-label">{field.label}</Text>
                {renderDeliverable(valueOf(project, field.key))}
              </div>
            </Col>
          ))}
        </Row>
        {!TECHNICAL_DELIVERABLE_FIELDS.some(field => valueOf(project, field.key)) && (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无交付物" className="technical-deliverable-empty" />
        )}
      </Card>
    </div>
  )
}
