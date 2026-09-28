'use client'

import { useEffect, useMemo } from 'react'
import { Card, Empty, Tooltip } from 'antd'
import type { CSSProperties, ReactNode } from 'react'
import {
  DashboardOutlined,
  TeamOutlined,
  FundOutlined,
  SettingOutlined,
  RightOutlined,
  DownOutlined,
  AppstoreOutlined,
} from '@ant-design/icons'
import { useUiStore } from '@/stores/ui'
import { useHrPipelineStore } from '@/stores/hrPipeline'
import { CollapsibleSidebarShell } from '@/components/shared/CollapsibleWorkspace'
import {
  HR_SIDEBAR_NAV,
  resolveGroupOfLeaf,
  resolveLeafLabel,
  type HrSidebarGroupKey,
} from '@/constants/hrPipeline'
import { resolveConfigModule } from '@/constants/hrConfig'
import MachineProjectContent from '@/components/hr-machine/MachineProjectContent'
import TosProjectContent from '@/components/hr-tos/TosProjectContent'
import TechnicalProjectContent from '@/components/hr-technical/TechnicalProjectContent'
import CapabilityProjectContent from '@/components/hr-capability/CapabilityProjectContent'
import { useProjectStore } from '@/stores/project'
import { usePermissionStore } from '@/stores/permission'
import { canRunGlobalMenuAction, getAccessibleHrGroups } from '@/lib/globalMenuPermissions'
import type { HrSidebarGroup } from '@/constants/hrPipeline'
import ConfigContent from '@/components/hr-config/ConfigContent'

/* ── Icon resolver ─────────────────────────────────────────────────── */

const ICON_MAP: Record<string, ReactNode> = {
  DashboardOutlined: <DashboardOutlined />,
  TeamOutlined: <TeamOutlined />,
  FundOutlined: <FundOutlined />,
  SettingOutlined: <SettingOutlined />,
}

/* ── Sidebar tree item ────────────────────────────────────────────── */

interface SidebarTreeProps {
  collapsed: boolean
  groups: HrSidebarGroup[]
  actor: string
}

function HrSidebarTree({ collapsed, groups, actor }: SidebarTreeProps) {
  const { activeLeaf, expandedGroups, setActiveLeaf, toggleGroup } = useHrPipelineStore()

  if (collapsed) {
    // Collapsed mode: show only parent group icons
    return (
      <nav className="pms-hr-sidebar-tree pms-hr-sidebar-tree--collapsed" role="navigation" aria-label="人力资源管道导航">
        {groups.map(group => {
          const isActive = resolveGroupOfLeaf(activeLeaf) === group.key
          return (
            <Tooltip key={group.key} title={group.label} placement="right">
              <button
                className={`pms-hr-sidebar-icon-btn${isActive ? ' is-active' : ''}`}
                onClick={() => {
                  // When collapsed, clicking a group icon activates its first child
                  const firstChild = group.children[0]
                  if (firstChild && canRunGlobalMenuAction(actor, `hr.${firstChild.key}`, 'view')) setActiveLeaf(firstChild.key)
                }}
                aria-label={group.label}
              >
                {ICON_MAP[group.icon] ?? <AppstoreOutlined />}
              </button>
            </Tooltip>
          )
        })}
      </nav>
    )
  }

  // Expanded mode: full tree with expandable groups
  return (
    <nav className="pms-hr-sidebar-tree" role="navigation" aria-label="人力资源管道导航">
      {groups.map(group => {
        const isExpanded = expandedGroups.has(group.key)
        const hasActiveChild = group.children.some(c => c.key === activeLeaf)
        return (
          <div key={group.key} className="pms-hr-sidebar-group">
            <button
              className={`pms-hr-sidebar-group-header${hasActiveChild ? ' has-active-child' : ''}`}
              onClick={() => toggleGroup(group.key)}
              aria-expanded={isExpanded}
              aria-label={`${group.label} ${isExpanded ? '收起' : '展开'}`}
            >
              <span className="pms-hr-sidebar-group-icon">
                {ICON_MAP[group.icon] ?? <AppstoreOutlined />}
              </span>
              <span className="pms-hr-sidebar-group-label">{group.label}</span>
              <span className="pms-hr-sidebar-group-arrow">
                {isExpanded ? <DownOutlined /> : <RightOutlined />}
              </span>
            </button>
            {isExpanded && (
              <div className="pms-hr-sidebar-children">
                {group.children.map(child => {
                  const isActive = activeLeaf === child.key
                  return (
                    <button
                      key={child.key}
                      className={`pms-hr-sidebar-leaf${isActive ? ' is-active' : ''}`}
                      onClick={() => { if (canRunGlobalMenuAction(actor, `hr.${child.key}`, 'view')) setActiveLeaf(child.key) }}
                      title={child.description ?? child.label}
                    >
                      <span className="pms-hr-sidebar-leaf-dot" />
                      <span className="pms-hr-sidebar-leaf-label">{child.label}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </nav>
  )
}

/* ── Placeholder content ──────────────────────────────────────────── */

function HrContentPlaceholder({ leafKey }: { leafKey: string }) {
  const label = resolveLeafLabel(leafKey)
  const groupKey = resolveGroupOfLeaf(leafKey)
  const groupLabel = groupKey ? HR_SIDEBAR_NAV.find(g => g.key === groupKey)?.label : ''

  return (
    <Card className="pms-hr-content-card" variant="borderless">
      <Empty
        description={
          <span style={{ color: '#817b90', fontSize: 13 }}>
            {groupLabel} / {label} — 内容开发中...
          </span>
        }
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    </Card>
  )
}

/* ── Content router ─────────────────────────────────────────────────── */

function HrContentRouter({ leafKey }: { leafKey: string }) {
  // Route to specific content based on active leaf
  if (leafKey === 'investment/machine') {
    return <MachineProjectContent />
  }

  if (leafKey === 'investment/tos') {
    return <TosProjectContent />
  }

  if (leafKey === 'investment/tech') {
    return <TechnicalProjectContent />
  }

  if (leafKey === 'investment/capability') {
    return <CapabilityProjectContent />
  }

  // 配置中心路由
  const configModule = resolveConfigModule(leafKey)
  if (configModule) {
    return <ConfigContent moduleKey={configModule} />
  }

  // Default: placeholder for unimplemented sections
  return <HrContentPlaceholder leafKey={leafKey} />
}

/* ── Main container ───────────────────────────────────────────────── */

export default function HrPipelineContainer() {
  const { hrSidebarCollapsed, setHrSidebarCollapsed } = useUiStore()
  const { activeLeaf, setActiveLeaf } = useHrPipelineStore()
  const actor = useProjectStore(state => state.currentLoginUser)
  const model = usePermissionStore(state => state.permissionCenter)
  const groups = useMemo(() => getAccessibleHrGroups(model, actor), [model, actor])
  const selectedAccessible = groups.some(group => group.children.some(leaf => leaf.key === activeLeaf))
  useEffect(() => {
    if (!selectedAccessible && groups[0]?.children[0]) setActiveLeaf(groups[0].children[0].key)
  }, [selectedAccessible, groups, setActiveLeaf])

  const sidebarWidth = hrSidebarCollapsed ? 64 : 240

  const containerStyle = {
    '--pms-hr-sidebar-width': `${sidebarWidth}px`,
  } as CSSProperties

  const sidebarTitle = useMemo(() => (
    <div className="pms-hr-sidebar-title">
      <TeamOutlined style={{ marginRight: 8, color: 'var(--pms-brand)' }} />
      <span>人力资源管道</span>
    </div>
  ), [])

  return (
    <div className="pms-hr-pipeline pms-page-shell" style={containerStyle}>
      <div className="pms-main-content pms-hr-main-content">
        <section className={`pms-hr-workspace${hrSidebarCollapsed ? ' is-collapsed' : ''}`}>
          <CollapsibleSidebarShell
            collapsed={hrSidebarCollapsed}
            onCollapsedChange={setHrSidebarCollapsed}
            title={sidebarTitle}
            ariaLabel="人力资源管道侧栏"
            expandedWidth={240}
            collapsedWidth={64}
            className="pms-hr-sidebar"
          >
            <HrSidebarTree collapsed={hrSidebarCollapsed} groups={groups} actor={actor} />
          </CollapsibleSidebarShell>
          <div className="pms-hr-workspace__content">
            {selectedAccessible ? <HrContentRouter key={`${actor}:${activeLeaf}`} leafKey={activeLeaf} /> : <Empty description="暂无可访问的人力资源菜单" />}
          </div>
        </section>
      </div>
    </div>
  )
}
