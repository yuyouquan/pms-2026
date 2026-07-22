'use client'

import { useEffect, useMemo, useRef, type CSSProperties } from 'react'
import { DeleteOutlined, EyeOutlined, WarningOutlined } from '@ant-design/icons'
import { Button, Drawer, Empty, Flex, Space, Tag, Typography } from 'antd'
import type {
  RoadmapPlanningConflictGroup,
  RoadmapProjectRow,
  TosVersionConfig,
} from '@/types/roadmap'

const DRAWER_Z_INDEX = 1300

const groupStyle: CSSProperties = {
  padding: 'var(--space-md)',
  border: '1px solid var(--border-purple)',
  borderLeft: '4px solid var(--warning)',
  borderRadius: 'var(--radius-lg)',
  background: 'var(--bg-glass)',
  backdropFilter: 'var(--glass-blur)',
  WebkitBackdropFilter: 'var(--glass-blur)',
  boxShadow: 'var(--shadow-sm)',
  scrollMarginTop: 'var(--space-md)',
}

const projectCardStyle: CSSProperties = {
  minWidth: 0,
  padding: '12px var(--space-md)',
  border: '1px solid var(--border-light)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--bg-secondary)',
}

export interface RoadmapConflictDrawerProps {
  open: boolean
  groups: readonly RoadmapPlanningConflictGroup[]
  tosVersions: readonly TosVersionConfig[]
  selectedConflictKey: string | null
  canEdit: boolean
  onClose: () => void
  onSelectedConflictKeyChange: (key: string | null) => void
  onViewProject: (projectId: string) => void
  onDeletePlannedProject: (project: RoadmapProjectRow) => void
}

interface ConflictProjectCardProps {
  project: RoadmapProjectRow
  tosVersionName: string
  kind: 'normal' | 'planned'
  canEdit: boolean
  onViewProject: (projectId: string) => void
  onDeletePlannedProject: (project: RoadmapProjectRow) => void
}

function ConflictProjectCard({
  project,
  tosVersionName,
  kind,
  canEdit,
  onViewProject,
  onDeletePlannedProject,
}: ConflictProjectCardProps) {
  const isNormal = kind === 'normal'

  return (
    <div
      style={{
        ...projectCardStyle,
        background: isNormal ? 'var(--bg-secondary)' : 'var(--bg-purple-tint)',
      }}
    >
      <Flex align="center" justify="space-between" gap={12} wrap>
        <div style={{ minWidth: 0, flex: '1 1 220px' }}>
          <Space size={8} wrap>
            <Typography.Text strong>{project.displayName}</Typography.Text>
            <Tag color={isNormal ? 'blue' : 'purple'} style={{ marginInlineEnd: 0 }}>
              {isNormal ? '正常项目' : '待规划项目'}
            </Tag>
          </Space>
          <Typography.Text
            type="secondary"
            style={{ display: 'block', marginTop: 4, overflowWrap: 'anywhere' }}
          >
            首销 tOS：{tosVersionName}
          </Typography.Text>
        </div>

        {isNormal ? (
          <Button
            type="link"
            icon={<EyeOutlined aria-hidden="true" />}
            onClick={() => onViewProject(project.id)}
            style={{ minHeight: 44, paddingInline: 8 }}
          >
            查看正常项目
          </Button>
        ) : canEdit ? (
          <Button
            danger
            type="link"
            icon={<DeleteOutlined aria-hidden="true" />}
            onClick={() => onDeletePlannedProject(project)}
            style={{ minHeight: 44, paddingInline: 8 }}
          >
            删除待规划项目
          </Button>
        ) : null}
      </Flex>
    </div>
  )
}

export default function RoadmapConflictDrawer({
  open,
  groups,
  tosVersions,
  selectedConflictKey,
  canEdit,
  onClose,
  onSelectedConflictKeyChange,
  onViewProject,
  onDeletePlannedProject,
}: RoadmapConflictDrawerProps) {
  const groupElementsRef = useRef(new Map<string, HTMLElement>())
  const previousGroupKeysRef = useRef<string[]>([])
  const groupKeys = useMemo(() => groups.map(group => group.key), [groups])
  const tosVersionNames = useMemo(
    () => new Map(tosVersions.map(version => [version.id, version.name])),
    [tosVersions],
  )
  const activeConflictKey = selectedConflictKey && groupKeys.includes(selectedConflictKey)
    ? selectedConflictKey
    : groupKeys[0] ?? null

  useEffect(() => {
    if (!open) {
      previousGroupKeysRef.current = groupKeys
      return
    }

    if (!groupKeys.length) {
      previousGroupKeysRef.current = []
      onSelectedConflictKeyChange(null)
      onClose()
      return
    }

    if (!selectedConflictKey || !groupKeys.includes(selectedConflictKey)) {
      const previousIndex = selectedConflictKey
        ? previousGroupKeysRef.current.indexOf(selectedConflictKey)
        : 0
      const nextIndex = previousIndex < 0
        ? 0
        : Math.min(previousIndex, groupKeys.length - 1)
      onSelectedConflictKeyChange(groupKeys[nextIndex])
    }

    previousGroupKeysRef.current = groupKeys
  }, [groupKeys, onClose, onSelectedConflictKeyChange, open, selectedConflictKey])

  useEffect(() => {
    if (!open || !activeConflictKey || typeof window === 'undefined') return

    const animationFrame = window.requestAnimationFrame(() => {
      const target = groupElementsRef.current.get(activeConflictKey)
      if (!target) return

      const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
      target.focus({ preventScroll: true })
      target.scrollIntoView({
        behavior: reduceMotion ? 'auto' : 'smooth',
        block: 'start',
      })
    })

    return () => window.cancelAnimationFrame(animationFrame)
  }, [activeConflictKey, groups, open])

  const versionNameFor = (project: RoadmapProjectRow) => {
    const versionName = tosVersionNames.get(project.firstSaleTosVersionId)
    return versionName ?? (project.firstSaleTosVersionId.trim() || '未维护')
  }

  return (
    <Drawer
      className="pms-roadmap-conflict-drawer"
      title={(
        <Space size={8}>
          <WarningOutlined aria-hidden="true" style={{ color: 'var(--warning)' }} />
          <span>项目冲突处理</span>
        </Space>
      )}
      extra={<Typography.Text type="secondary">{groups.length} 组</Typography.Text>}
      open={open}
      onClose={onClose}
      placement="right"
      width="min(720px, 100vw)"
      zIndex={DRAWER_Z_INDEX}
      styles={{
        body: {
          padding: 'var(--space-md)',
          background: 'var(--bg-purple-tint)',
        },
      }}
    >
      {groups.length ? (
        <Flex vertical gap={16}>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            正常项目为只读数据。请核对重复项，并删除对应的待规划项目。
          </Typography.Paragraph>

          {groups.map(group => {
            const representative = group.plannedProjects[0] ?? group.normalProjects[0]
            if (!representative) return null
            const headingId = `roadmap-conflict-${encodeURIComponent(group.key)}`

            return (
              <section
                key={group.key}
                ref={element => {
                  if (element) groupElementsRef.current.set(group.key, element)
                  else groupElementsRef.current.delete(group.key)
                }}
                tabIndex={-1}
                aria-labelledby={headingId}
                style={groupStyle}
              >
                <Flex id={headingId} gap={8} wrap style={{ marginBottom: 12 }}>
                  <Tag color="gold" style={{ marginInlineEnd: 0 }}>项目名：{representative.projectCode}</Tag>
                  <Tag style={{ marginInlineEnd: 0 }}>安卓版本：{representative.androidVersion}</Tag>
                  <Tag style={{ marginInlineEnd: 0 }}>产品类型：{representative.productType}</Tag>
                </Flex>

                <Flex vertical gap={12}>
                  <div>
                    <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
                      正常项目（{group.normalProjects.length}）
                    </Typography.Text>
                    <Flex vertical gap={8}>
                      {group.normalProjects.map(project => (
                        <ConflictProjectCard
                          key={`normal:${project.id}`}
                          project={project}
                          tosVersionName={versionNameFor(project)}
                          kind="normal"
                          canEdit={canEdit}
                          onViewProject={onViewProject}
                          onDeletePlannedProject={onDeletePlannedProject}
                        />
                      ))}
                    </Flex>
                  </div>

                  <div>
                    <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
                      待规划项目（{group.plannedProjects.length}）
                    </Typography.Text>
                    <Flex vertical gap={8}>
                      {group.plannedProjects.map(project => (
                        <ConflictProjectCard
                          key={`planned:${project.id}`}
                          project={project}
                          tosVersionName={versionNameFor(project)}
                          kind="planned"
                          canEdit={canEdit}
                          onViewProject={onViewProject}
                          onDeletePlannedProject={onDeletePlannedProject}
                        />
                      ))}
                    </Flex>
                  </div>
                </Flex>
              </section>
            )
          })}
        </Flex>
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无项目冲突" />
      )}
    </Drawer>
  )
}
