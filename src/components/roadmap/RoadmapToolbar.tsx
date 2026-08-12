'use client'

import type { CSSProperties, ReactElement } from 'react'
import {
  DownOutlined,
  FilterOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
  PlusOutlined,
  SettingOutlined,
  SlidersOutlined,
  UpOutlined,
} from '@ant-design/icons'
import { Badge, Button, Flex, Segmented, Tooltip, Typography } from 'antd'
import type {
  RoadmapBrand,
  RoadmapProductType,
  RoadmapViewMode,
} from '@/types/roadmap'

const compactControlStyle: CSSProperties = { minHeight: 32, height: 32, borderRadius: 8 }

interface RoadmapToolbarProps {
  canView: boolean
  canEdit: boolean
  viewMode: RoadmapViewMode
  onViewModeChange: (mode: RoadmapViewMode) => void
  brandFilter: 'all' | 'custom' | RoadmapBrand
  onBrandFilterChange: (brand: 'all' | RoadmapBrand) => void
  productTypeFilter: 'all' | 'custom' | RoadmapProductType
  onProductTypeFilterChange: (productType: 'all' | RoadmapProductType) => void
  filterCount: number
  hasTargetVersions: boolean
  allTargetsCollapsed: boolean
  onToggleAllTargets: () => void
  isFullscreen: boolean
  onToggleFullscreen: () => void
  onOpenTosMaintenance: () => void
  onCreatePlannedProject: () => void
  onOpenFilters: () => void
  onOpenColumnSettings: () => void
  renderFilters: (trigger: ReactElement) => ReactElement
  renderColumnSettings: (trigger: ReactElement) => ReactElement
}

export default function RoadmapToolbar({
  canView,
  canEdit,
  viewMode,
  onViewModeChange,
  brandFilter,
  onBrandFilterChange,
  productTypeFilter,
  onProductTypeFilterChange,
  filterCount,
  hasTargetVersions,
  allTargetsCollapsed,
  onToggleAllTargets,
  isFullscreen,
  onToggleFullscreen,
  onOpenTosMaintenance,
  onCreatePlannedProject,
  onOpenFilters,
  onOpenColumnSettings,
  renderFilters,
  renderColumnSettings,
}: RoadmapToolbarProps) {
  const brandOptions: Array<{
    label: string
    value: 'all' | 'custom' | RoadmapBrand
    disabled?: boolean
  }> = [
    { label: '全部', value: 'all' },
    { label: 'TECNO', value: 'TECNO' },
    { label: 'Infinix', value: 'Infinix' },
    { label: 'itel', value: 'itel' },
  ]
  if (brandFilter === 'custom') brandOptions.push({ label: '自定义', value: 'custom', disabled: true })
  const productTypeOptions: Array<{
    label: string
    value: 'all' | 'custom' | RoadmapProductType
    disabled?: boolean
  }> = [
    { label: '全部', value: 'all' },
    { label: '新品', value: '新品' },
    { label: '老品', value: '老品' },
  ]
  if (productTypeFilter === 'custom') productTypeOptions.push({ label: '自定义', value: 'custom', disabled: true })

  return (
    <div
      className="roadmap-toolbar-glass pms-toolbar"
      style={{
        position: 'sticky',
        top: isFullscreen ? 0 : 'var(--pms-main-header-height, 56px)',
        zIndex: 30,
        padding: '8px 10px',
        margin: '0 0 10px',
        borderRadius: 'var(--radius-lg)',
        overflowX: 'auto',
        overflowY: 'hidden',
        scrollbarWidth: 'thin',
      }}
    >
      <Flex
        className="roadmap-toolbar-scroll-row"
        justify="space-between"
        align="center"
        gap={8}
        wrap={false}
        style={{ minWidth: 'max-content' }}
      >
        <Flex align="center" gap={6} wrap={false} style={{ minWidth: 'max-content', flex: '0 0 auto' }}>
          <div
            className="roadmap-toolbar-view-switch"
            style={{
              display: 'flex',
              alignItems: 'center',
              minHeight: 44,
              paddingInline: 4,
              border: '1px solid var(--border-purple)',
              borderRadius: 10,
              background: 'var(--bg-purple-tint)',
            }}
          >
            <Segmented<RoadmapViewMode>
              aria-label="路标视图"
              value={viewMode}
              options={[
                { label: '表单视图', value: 'table' },
                { label: '版本演进视图', value: 'evolution' },
              ]}
              onChange={onViewModeChange}
              style={{ ...compactControlStyle, background: 'transparent' }}
            />
          </div>

          <Flex
            className="roadmap-toolbar-filter-group"
            data-roadmap-quick-filter
            align="center"
            gap={6}
            wrap={false}
            style={{ minHeight: 44 }}
          >
            <Typography.Text type="secondary" style={{ whiteSpace: 'nowrap' }}>品牌</Typography.Text>
            <Segmented<'all' | 'custom' | RoadmapBrand>
              aria-label="品牌快捷筛选"
              value={brandFilter}
              options={brandOptions}
              onChange={value => value !== 'custom' && onBrandFilterChange(value)}
              style={compactControlStyle}
            />
          </Flex>

          <Flex
            className="roadmap-toolbar-filter-group roadmap-toolbar-group-divider"
            data-roadmap-quick-filter
            align="center"
            gap={6}
            wrap={false}
            style={{
              minHeight: 44,
              paddingInlineStart: 10,
              borderInlineStart: '1px solid var(--border-purple)',
            }}
          >
            <Typography.Text type="secondary" style={{ whiteSpace: 'nowrap' }}>产品类型</Typography.Text>
            <Segmented<'all' | 'custom' | RoadmapProductType>
              aria-label="产品类型快捷筛选"
              value={productTypeFilter}
              options={productTypeOptions}
              onChange={value => value !== 'custom' && onProductTypeFilterChange(value)}
              style={compactControlStyle}
            />
          </Flex>
        </Flex>

        <Flex
          data-roadmap-actions
          align="center"
          justify="flex-end"
          gap={6}
          wrap={false}
          style={{ minWidth: 'max-content', minHeight: 44, flex: '0 0 auto', whiteSpace: 'nowrap' }}
        >
          {viewMode === 'evolution' && hasTargetVersions ? (
            <Button
              icon={allTargetsCollapsed ? <DownOutlined /> : <UpOutlined />}
              onClick={onToggleAllTargets}
              style={compactControlStyle}
            >
              {allTargetsCollapsed ? '展开目标' : '收起目标'}
            </Button>
          ) : null}
          {canEdit ? (
            <>
              <Button
                icon={<SlidersOutlined />}
                onClick={onOpenTosMaintenance}
                style={compactControlStyle}
              >
                tOS 版本维护
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={onCreatePlannedProject}
                style={compactControlStyle}
              >
                创建项目
              </Button>
            </>
          ) : null}
          {renderFilters(
            <Tooltip title={filterCount ? `已配置 ${filterCount} 个筛选条件` : '筛选'}>
              <Badge count={filterCount} size="small" offset={[-2, 2]}>
                <Button
                  className="roadmap-toolbar-icon-action"
                  aria-label={filterCount ? `筛选，已配置 ${filterCount} 个条件` : '筛选'}
                  type={filterCount ? 'primary' : 'default'}
                  icon={<FilterOutlined />}
                  disabled={!canView}
                  onClick={onOpenFilters}
                  style={compactControlStyle}
                >
                  筛选
                </Button>
              </Badge>
            </Tooltip>,
          )}
          {renderColumnSettings(
            <Tooltip title="字段配置">
              <Button
                className="roadmap-toolbar-icon-action"
                aria-label="字段配置"
                icon={<SettingOutlined />}
                disabled={!canView}
                onClick={onOpenColumnSettings}
                style={compactControlStyle}
              >
                字段配置
              </Button>
            </Tooltip>,
          )}
          <Tooltip title={isFullscreen ? '退出全屏' : '全屏'}>
            <Button
              className="roadmap-toolbar-icon-action"
              icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
              aria-label={isFullscreen ? '退出全屏' : '全屏'}
              aria-pressed={isFullscreen}
              onClick={onToggleFullscreen}
              style={compactControlStyle}
            >
              {isFullscreen ? '退出全屏' : '全屏'}
            </Button>
          </Tooltip>
        </Flex>
      </Flex>
      <style jsx global>{`
        .roadmap-toolbar-glass .ant-btn {
          position: relative;
          height: 32px;
          min-height: 32px;
          padding-inline: 8px;
          border-radius: 8px;
        }
        .roadmap-toolbar-glass .ant-btn::before {
          content: '';
          position: absolute;
          inset: -6px 0;
        }
        .roadmap-toolbar-glass .ant-segmented {
          padding: 2px;
        }
        .roadmap-toolbar-glass .ant-segmented-item {
          min-height: 28px;
          line-height: 28px;
          border-radius: 7px;
        }
        .roadmap-toolbar-glass .ant-segmented-item-label {
          min-height: 28px;
          line-height: 28px;
          padding-inline: 6px;
          white-space: nowrap;
        }
        @media (max-width: 1360px) {
          .roadmap-toolbar-glass .roadmap-toolbar-icon-action {
            width: 32px;
            padding-inline: 0;
            overflow: hidden;
            font-size: 0;
          }
          .roadmap-toolbar-glass .roadmap-toolbar-icon-action .anticon {
            margin-inline-end: 0;
            font-size: 14px;
          }
        }
      `}</style>
    </div>
  )
}
