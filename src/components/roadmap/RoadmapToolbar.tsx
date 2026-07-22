'use client'

import type { CSSProperties } from 'react'
import {
  AuditOutlined,
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

const compactControlStyle: CSSProperties = { minHeight: 36, height: 36 }

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
  onOpenChangeLog: () => void
  onOpenTosMaintenance: () => void
  onCreatePlannedProject: () => void
  onOpenFilters: () => void
  onOpenColumnSettings: () => void
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
  onOpenChangeLog,
  onOpenTosMaintenance,
  onCreatePlannedProject,
  onOpenFilters,
  onOpenColumnSettings,
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
      className="roadmap-toolbar-glass"
      style={{
        position: 'sticky',
        top: isFullscreen ? 0 : 'var(--pms-main-header-height, 56px)',
        zIndex: 30,
        padding: '8px 10px',
        margin: '0 0 10px',
        border: '1px solid var(--border-purple)',
        borderRadius: 'var(--radius-lg)',
        background: 'rgba(255, 255, 255, 0.94)',
        backdropFilter: 'blur(18px) saturate(145%)',
        WebkitBackdropFilter: 'blur(18px) saturate(145%)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <Flex justify="space-between" align="center" gap={8} wrap>
        <Flex align="center" gap={8} wrap style={{ minWidth: 0, flex: '1 1 600px' }}>
          <Segmented<RoadmapViewMode>
            aria-label="路标视图"
            value={viewMode}
            options={[
              { label: '表单视图', value: 'table' },
              { label: '版本演进视图', value: 'evolution' },
            ]}
            onChange={onViewModeChange}
            style={compactControlStyle}
          />

          <Flex data-roadmap-quick-filter align="center" gap={6} wrap style={{ minWidth: 0, maxWidth: '100%' }}>
            <Typography.Text type="secondary" style={{ whiteSpace: 'nowrap' }}>品牌</Typography.Text>
            <Segmented<'all' | 'custom' | RoadmapBrand>
              aria-label="品牌快捷筛选"
              value={brandFilter}
              options={brandOptions}
              onChange={value => value !== 'custom' && onBrandFilterChange(value)}
              style={compactControlStyle}
            />
          </Flex>

          <Flex data-roadmap-quick-filter align="center" gap={6} wrap style={{ minWidth: 0, maxWidth: '100%' }}>
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
          style={{ minWidth: 'max-content', flex: '0 0 auto', whiteSpace: 'nowrap' }}
        >
          {viewMode === 'evolution' && hasTargetVersions ? (
            <Button
              icon={allTargetsCollapsed ? <DownOutlined /> : <UpOutlined />}
              onClick={onToggleAllTargets}
              style={compactControlStyle}
            >
              {allTargetsCollapsed ? '展开全部目标' : '收起全部目标'}
            </Button>
          ) : null}
          <Button
            icon={<AuditOutlined />}
            disabled={!canView}
            onClick={onOpenChangeLog}
            style={compactControlStyle}
          >
            修改记录
          </Button>
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
                创建待规划项目
              </Button>
            </>
          ) : null}
          <Tooltip title={filterCount ? `已配置 ${filterCount} 个筛选条件` : '筛选'}>
            <Badge count={filterCount} size="small" offset={[-2, 2]}>
              <Button
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
          </Tooltip>
          <Button
            icon={<SettingOutlined />}
            disabled={!canView}
            onClick={onOpenColumnSettings}
            style={compactControlStyle}
          >
            列设置
          </Button>
          <Button
            icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
            aria-pressed={isFullscreen}
            onClick={onToggleFullscreen}
            style={compactControlStyle}
          >
            {isFullscreen ? '退出全屏' : '全屏'}
          </Button>
        </Flex>
      </Flex>
    </div>
  )
}
