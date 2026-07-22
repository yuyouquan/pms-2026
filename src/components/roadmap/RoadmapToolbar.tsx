'use client'

import { useMemo, type CSSProperties } from 'react'
import {
  AuditOutlined,
  FilterOutlined,
  PlusOutlined,
  SettingOutlined,
  SlidersOutlined,
} from '@ant-design/icons'
import { Badge, Button, Flex, Segmented, Select, Tooltip, Typography } from 'antd'
import { compareSemanticTos } from '@/lib/roadmapSorting'
import type {
  RoadmapBrand,
  RoadmapProductType,
  RoadmapViewMode,
  TosVersionConfig,
} from '@/types/roadmap'

const touchControlStyle: CSSProperties = { minHeight: 44 }

interface RoadmapToolbarProps {
  canView: boolean
  canEdit: boolean
  viewMode: RoadmapViewMode
  onViewModeChange: (mode: RoadmapViewMode) => void
  tosVersions: readonly TosVersionConfig[]
  selectedTosVersionId: string | null
  onTosVersionChange: (id: string) => void
  brandFilter: 'all' | RoadmapBrand
  onBrandFilterChange: (brand: 'all' | RoadmapBrand) => void
  productTypeFilter: 'all' | RoadmapProductType
  onProductTypeFilterChange: (productType: 'all' | RoadmapProductType) => void
  filterCount: number
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
  tosVersions,
  selectedTosVersionId,
  onTosVersionChange,
  brandFilter,
  onBrandFilterChange,
  productTypeFilter,
  onProductTypeFilterChange,
  filterCount,
  onOpenChangeLog,
  onOpenTosMaintenance,
  onCreatePlannedProject,
  onOpenFilters,
  onOpenColumnSettings,
}: RoadmapToolbarProps) {
  const descendingVersions = useMemo(
    () => [...tosVersions].sort((left, right) => compareSemanticTos(right, left)),
    [tosVersions],
  )

  return (
    <div
      className="roadmap-toolbar-glass"
      style={{
        position: 'sticky',
        top: 'var(--pms-main-header-height, 56px)',
        zIndex: 30,
        padding: '12px clamp(8px, 2vw, 16px)',
        margin: '0 0 16px',
        border: '1px solid var(--border-purple)',
        borderRadius: 'var(--radius-lg)',
        background: 'rgba(255, 255, 255, 0.94)',
        backdropFilter: 'blur(18px) saturate(145%)',
        WebkitBackdropFilter: 'blur(18px) saturate(145%)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <Flex justify="space-between" align="flex-start" gap={12} wrap>
        <Flex align="center" gap={12} wrap style={{ minWidth: 0, flex: '1 1 640px' }}>
          <Segmented<RoadmapViewMode>
            aria-label="路标视图"
            size="large"
            value={viewMode}
            options={[
              { label: '表单视图', value: 'table' },
              { label: '版本演进视图', value: 'evolution' },
            ]}
            onChange={onViewModeChange}
            style={touchControlStyle}
          />

          {viewMode === 'table' ? (
            <Flex align="center" gap={6} style={{ minWidth: 0 }}>
              <Typography.Text type="secondary" style={{ whiteSpace: 'nowrap' }}>tOS 版本</Typography.Text>
              <Select
                aria-label="表单视图 tOS 版本"
                size="large"
                value={selectedTosVersionId ?? undefined}
                placeholder="选择 tOS 版本"
                options={descendingVersions.map(version => ({ label: version.name, value: version.id }))}
                onChange={onTosVersionChange}
                style={{ width: 150, maxWidth: '44vw', minHeight: 44 }}
              />
            </Flex>
          ) : null}

          <Flex data-roadmap-quick-filter align="center" gap={6} wrap style={{ minWidth: 0, maxWidth: '100%' }}>
            <Typography.Text type="secondary" style={{ whiteSpace: 'nowrap' }}>品牌</Typography.Text>
            <Segmented<'all' | RoadmapBrand>
              aria-label="品牌快捷筛选"
              size="large"
              value={brandFilter}
              options={[
                { label: '全部', value: 'all' },
                { label: 'TECNO', value: 'TECNO' },
                { label: 'Infinix', value: 'Infinix' },
                { label: 'itel', value: 'itel' },
              ]}
              onChange={onBrandFilterChange}
              style={touchControlStyle}
            />
          </Flex>

          <Flex data-roadmap-quick-filter align="center" gap={6} wrap style={{ minWidth: 0, maxWidth: '100%' }}>
            <Typography.Text type="secondary" style={{ whiteSpace: 'nowrap' }}>产品类型</Typography.Text>
            <Segmented<'all' | RoadmapProductType>
              aria-label="产品类型快捷筛选"
              size="large"
              value={productTypeFilter}
              options={[
                { label: '全部', value: 'all' },
                { label: '新品', value: '新品' },
                { label: '老品', value: '老品' },
              ]}
              onChange={onProductTypeFilterChange}
              style={touchControlStyle}
            />
          </Flex>
        </Flex>

        <Flex align="center" justify="flex-end" gap={8} wrap style={{ minWidth: 0, flex: '1 1 420px' }}>
          <Button
            size="large"
            icon={<AuditOutlined />}
            disabled={!canView}
            onClick={onOpenChangeLog}
            style={touchControlStyle}
          >
            修改记录
          </Button>
          {canEdit ? (
            <>
              <Button
                size="large"
                icon={<SlidersOutlined />}
                onClick={onOpenTosMaintenance}
                style={touchControlStyle}
              >
                tOS 版本维护
              </Button>
              <Button
                type="primary"
                size="large"
                icon={<PlusOutlined />}
                onClick={onCreatePlannedProject}
                style={touchControlStyle}
              >
                创建待规划项目
              </Button>
            </>
          ) : null}
          <Tooltip title={filterCount ? `已启用 ${filterCount} 个筛选条件` : '筛选'}>
            <Badge count={filterCount} size="small" offset={[-2, 2]}>
              <Button
                aria-label={filterCount ? `筛选，已启用 ${filterCount} 个条件` : '筛选'}
                type={filterCount ? 'primary' : 'default'}
                size="large"
                icon={<FilterOutlined />}
                disabled={!canView}
                onClick={onOpenFilters}
                style={touchControlStyle}
              >
                筛选
              </Button>
            </Badge>
          </Tooltip>
          <Button
            size="large"
            icon={<SettingOutlined />}
            disabled={!canView}
            onClick={onOpenColumnSettings}
            style={touchControlStyle}
          >
            列设置
          </Button>
        </Flex>
      </Flex>
    </div>
  )
}
