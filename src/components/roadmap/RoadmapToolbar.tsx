'use client'

import type { CSSProperties, ReactElement } from 'react'
import {
  DownOutlined,
  DownloadOutlined,
  FilterOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
  PlusOutlined,
  SettingOutlined,
  SlidersOutlined,
  UpOutlined,
} from '@ant-design/icons'
import { Button, Flex, Segmented, Select, Tooltip, Typography } from 'antd'
import { compareSemanticTos } from '@/lib/roadmapSorting'
import { formatTosVersionDisplay, formatTosVersionFull } from '@/lib/roadmapValidation'
import type { RoadmapBrand, RoadmapProductType, RoadmapViewMode, TosVersionConfig } from '@/types/roadmap'

const compactControlStyle: CSSProperties = { minHeight: 30, height: 30, borderRadius: 6 }

interface RoadmapToolbarProps {
  canView: boolean
  canEdit: boolean
  viewMode: RoadmapViewMode
  versions: readonly TosVersionConfig[]
  selectedTosVersionId: string | null
  onSelectedTosVersionChange: (id: string | null) => void
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
  onExport: () => void
  onOpenFilters: () => void
  onOpenColumnSettings: () => void
  renderFilters: (trigger: ReactElement) => ReactElement
  renderColumnSettings: (trigger: ReactElement) => ReactElement
}

export function RoadmapViewModeSwitch({
  value,
  onChange,
}: {
  value: RoadmapViewMode
  onChange: (mode: RoadmapViewMode) => void
}) {
  return (
    <div className="pms-roadmap-view-mode-row">
      <Segmented<RoadmapViewMode>
        aria-label="路标视图"
        value={value}
        options={[
          { label: '表单视图', value: 'table' },
          { label: '版本演进视图', value: 'evolution' },
        ]}
        onChange={onChange}
      />
    </div>
  )
}

export default function RoadmapToolbar({
  canView,
  canEdit,
  viewMode,
  versions,
  selectedTosVersionId,
  onSelectedTosVersionChange,
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
  onExport,
  onOpenFilters,
  onOpenColumnSettings,
  renderFilters,
  renderColumnSettings,
}: RoadmapToolbarProps) {
  const brandOptions: Array<{ label: string; value: 'all' | 'custom' | RoadmapBrand; disabled?: boolean }> = [
    { label: '全部', value: 'all' },
    { label: 'TECNO', value: 'TECNO' },
    { label: 'Infinix', value: 'Infinix' },
    { label: 'itel', value: 'itel' },
  ]
  if (brandFilter === 'custom') brandOptions.push({ label: '自定义', value: 'custom', disabled: true })

  const productTypeOptions: Array<{ label: string; value: 'all' | 'custom' | RoadmapProductType; disabled?: boolean }> = [
    { label: '全部', value: 'all' },
    { label: '新品', value: '新品' },
    { label: '老品', value: '老品' },
  ]
  if (productTypeFilter === 'custom') productTypeOptions.push({ label: '自定义', value: 'custom', disabled: true })

  const descendingVersions = [...versions].sort((left, right) => compareSemanticTos(right, left))

  return (
    <div
      className="roadmap-toolbar-glass pms-toolbar"
      style={{
        position: 'sticky',
        top: isFullscreen ? 0 : 'var(--pms-main-header-height, 56px)',
        zIndex: 30,
        padding: '8px 12px 7px',
        margin: 0,
        borderRadius: '12px 12px 0 0',
        overflowX: 'auto',
        overflowY: 'hidden',
        scrollbarWidth: 'thin',
      }}
    >
      <Flex justify="space-between" align="center" gap={8} wrap={false} style={{ minWidth: 'max-content' }}>
        <Flex align="center" gap={12} wrap={false} style={{ minWidth: 'max-content', flex: '0 0 auto' }}>
          {viewMode === 'table' ? (
            <Flex data-roadmap-quick-filter align="center" gap={6} wrap={false}>
              <Typography.Text type="secondary" style={{ whiteSpace: 'nowrap', fontSize: 12 }}>tOS版本</Typography.Text>
              <Select
                aria-label="表单视图 tOS 版本"
                value={selectedTosVersionId ?? 'all'}
                options={[
                  { label: '全部', value: 'all' },
                  ...descendingVersions.map(version => ({
                    label: formatTosVersionDisplay(version),
                    title: formatTosVersionFull(version),
                    value: version.id,
                  })),
                ]}
                onChange={selectedId => onSelectedTosVersionChange(selectedId === 'all' ? null : selectedId)}
                style={{ width: 150 }}
              />
            </Flex>
          ) : null}

          <Flex data-roadmap-quick-filter align="center" gap={6} wrap={false}>
            <Typography.Text type="secondary" style={{ whiteSpace: 'nowrap', fontSize: 12 }}>品牌</Typography.Text>
            <Segmented<'all' | 'custom' | RoadmapBrand>
              aria-label="品牌快捷筛选"
              value={brandFilter}
              options={brandOptions}
              onChange={value => value !== 'custom' && onBrandFilterChange(value)}
              style={compactControlStyle}
            />
          </Flex>

          <Flex data-roadmap-quick-filter align="center" gap={6} wrap={false}>
            <Typography.Text type="secondary" style={{ whiteSpace: 'nowrap', fontSize: 12 }}>产品类型</Typography.Text>
            <Segmented<'all' | 'custom' | RoadmapProductType>
              aria-label="产品类型快捷筛选"
              value={productTypeFilter}
              options={productTypeOptions}
              onChange={value => value !== 'custom' && onProductTypeFilterChange(value)}
              style={compactControlStyle}
            />
          </Flex>
        </Flex>

        <Flex data-roadmap-actions align="center" justify="flex-end" gap={6} wrap={false} style={{ flex: '0 0 auto' }}>
          {viewMode === 'evolution' && hasTargetVersions ? (
            <Button icon={allTargetsCollapsed ? <DownOutlined /> : <UpOutlined />} onClick={onToggleAllTargets} style={compactControlStyle}>
              {allTargetsCollapsed ? '展开目标' : '收起目标'}
            </Button>
          ) : null}

          {renderFilters(
            <Tooltip title={filterCount ? `已配置 ${filterCount} 个筛选条件` : '筛选'}>
              <Button
                aria-label={filterCount ? `筛选，已配置 ${filterCount} 个条件` : '筛选'}
                type={filterCount ? 'primary' : 'default'}
                icon={<FilterOutlined />}
                disabled={!canView}
                onClick={onOpenFilters}
                style={compactControlStyle}
              >
                筛选{filterCount ? ` ${filterCount}` : ''}
              </Button>
            </Tooltip>,
          )}

          {renderColumnSettings(
            <Tooltip title="字段配置">
              <Button aria-label="字段配置" icon={<SettingOutlined />} disabled={!canView} onClick={onOpenColumnSettings} style={compactControlStyle}>
                字段配置
              </Button>
            </Tooltip>,
          )}

          <Tooltip title="导出当前路标数据">
            <Button aria-label="导出" icon={<DownloadOutlined />} disabled={!canView} onClick={onExport} style={compactControlStyle}>
              导出
            </Button>
          </Tooltip>

          {canEdit ? (
            <>
              <Tooltip title="tOS 版本维护">
                <Button aria-label="tOS 版本维护" icon={<SlidersOutlined />} onClick={onOpenTosMaintenance} style={compactControlStyle} />
              </Tooltip>
              <Tooltip title="创建项目">
                <Button aria-label="创建项目" icon={<PlusOutlined />} onClick={onCreatePlannedProject} style={compactControlStyle} />
              </Tooltip>
            </>
          ) : null}

          <Tooltip title={isFullscreen ? '退出全屏' : '全屏'}>
            <Button
              icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
              aria-label={isFullscreen ? '退出全屏' : '全屏'}
              aria-pressed={isFullscreen}
              onClick={onToggleFullscreen}
              style={compactControlStyle}
            />
          </Tooltip>
        </Flex>
      </Flex>

      <style jsx global>{`
        .roadmap-toolbar-glass .ant-btn {
          position: relative;
          height: 30px;
          min-height: 30px;
          padding-inline: 9px;
          border-radius: 6px;
          font-size: 12px;
        }
        .roadmap-toolbar-glass .ant-segmented {
          padding: 2px;
          background: #f5f5f7;
        }
        .roadmap-toolbar-glass .ant-select-selector {
          min-height: 30px !important;
          border-radius: 6px !important;
        }
        .roadmap-toolbar-glass .ant-segmented-item,
        .roadmap-toolbar-glass .ant-segmented-item-label {
          min-height: 26px;
          line-height: 26px;
          border-radius: 6px;
        }
        .roadmap-toolbar-glass .ant-segmented-item-label {
          padding-inline: 9px;
          white-space: nowrap;
        }
      `}</style>
    </div>
  )
}
