'use client'

import { useEffect, useMemo, useRef, type CSSProperties, type ReactNode } from 'react'
import { BulbOutlined, DownOutlined, EditOutlined, UpOutlined } from '@ant-design/icons'
import { Button, Empty, Flex, Typography } from 'antd'
import { compareSemanticTos } from '@/lib/roadmapSorting'
import type {
  RoadmapBrand,
  RoadmapColumnKey,
  RoadmapPlanningConflictGroup,
  RoadmapProductType,
  RoadmapProjectRow,
  TosVersionConfig,
} from '@/types/roadmap'
import RoadmapProjectCard from './RoadmapProjectCard'

export const EVOLUTION_BRAND_ORDER = ['TECNO', 'Infinix', 'itel'] as const

export interface EvolutionBrandGroup {
  brand: (typeof EVOLUTION_BRAND_ORDER)[number]
  rows: RoadmapProjectRow[]
}

type EvolutionBrand = (typeof EVOLUTION_BRAND_ORDER)[number]

const EVOLUTION_BRAND_CLASS_NAMES: Record<EvolutionBrand, string> = {
  TECNO: 'brand-tecno',
  Infinix: 'brand-infinix',
  itel: 'brand-itel',
}

function isEvolutionBrand(brand: RoadmapBrand): brand is EvolutionBrand {
  return EVOLUTION_BRAND_ORDER.some(candidate => candidate === brand)
}

export interface RoadmapEvolutionViewProps {
  rows: readonly RoadmapProjectRow[]
  conflicts: readonly RoadmapPlanningConflictGroup[]
  versions: readonly TosVersionConfig[]
  columnOrder: readonly RoadmapColumnKey[]
  visibleColumns: readonly RoadmapColumnKey[]
  canEdit: boolean
  collapsedTargetVersionIds: ReadonlySet<string>
  onToggleTarget: (versionId: string) => void
  onEditTosTargets: (versionId: string) => void
  onOpenConflict: (conflictKey: string) => void
  onEditPlannedProject: (projectId: string) => void
  onDeletePlannedProject: (projectId: string) => void
}

export function sortEvolutionVersions(
  versions: readonly TosVersionConfig[],
): TosVersionConfig[] {
  return [...versions].sort(compareSemanticTos)
}

export function groupEvolutionRows(
  rows: readonly RoadmapProjectRow[],
  versionId: string,
  productType: RoadmapProductType,
): EvolutionBrandGroup[] {
  return EVOLUTION_BRAND_ORDER.map(brand => ({
    brand,
    rows: rows.filter(row => (
      row.firstSaleTosVersionId === versionId
      && row.productType === productType
      && row.brand === brand
    )),
  })).filter(group => group.rows.length > 0)
}

export function countEvolutionRows(
  rows: readonly RoadmapProjectRow[],
  versionId: string,
  productType?: RoadmapProductType,
): number {
  return rows.filter(row => (
    row.firstSaleTosVersionId === versionId
    && (!productType || row.productType === productType)
    && isEvolutionBrand(row.brand)
  )).length
}

export function buildEvolutionConflictMap(
  conflicts: readonly RoadmapPlanningConflictGroup[],
): Map<string, string> {
  const conflictKeyByIdentity = new Map<string, string>()
  for (const conflict of conflicts) {
    for (const project of conflict.plannedProjects) {
      conflictKeyByIdentity.set(`planned:${project.id}`, conflict.key)
    }
  }
  return conflictKeyByIdentity
}

interface EvolutionProductCellProps {
  productType: RoadmapProductType
  version: TosVersionConfig
  rows: readonly RoadmapProjectRow[]
  renderProjectCard: (row: RoadmapProjectRow) => ReactNode
}

function EvolutionProductCell({
  productType,
  version,
  rows,
  renderProjectCard,
}: EvolutionProductCellProps) {
  const groups = groupEvolutionRows(rows, version.id, productType)
  const count = groups.reduce((total, group) => total + group.rows.length, 0)

  return (
    <section
      className={`pms-roadmap-evolution-product-cell is-${productType === '新品' ? 'new' : 'old'}`}
      aria-label={`${version.name} ${productType}项目，共 ${count} 个`}
    >
      {productType === '新品' ? (
        <div className="pms-roadmap-evolution-product-heading">
          <Typography.Text strong>新品</Typography.Text>
          <Typography.Text type="secondary">{count}</Typography.Text>
        </div>
      ) : null}

      {groups.length ? groups.map(group => {
        const brandClassName = EVOLUTION_BRAND_CLASS_NAMES[group.brand]
        return (
          <section key={`${version.id}:${productType}:${group.brand}`} className="pms-roadmap-evolution-brand-section">
            <div className="pms-roadmap-evolution-brand-heading">
              <span className={`pms-roadmap-evolution-brand-dot ${brandClassName}`} aria-hidden />
              <Typography.Text className={`pms-roadmap-evolution-brand-label ${brandClassName}`} strong>
                {group.brand}
              </Typography.Text>
              <Typography.Text type="secondary">{group.rows.length}</Typography.Text>
            </div>
            <div className="pms-roadmap-evolution-card-list">
              {group.rows.map(renderProjectCard)}
            </div>
          </section>
        )
      }) : (
        <div className="pms-roadmap-evolution-empty">暂无{productType}项目</div>
      )}
    </section>
  )
}

export default function RoadmapEvolutionView({
  rows,
  conflicts,
  versions,
  columnOrder,
  visibleColumns,
  canEdit,
  collapsedTargetVersionIds,
  onToggleTarget,
  onEditTosTargets,
  onOpenConflict,
  onEditPlannedProject,
  onDeletePlannedProject,
}: RoadmapEvolutionViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const orderedVersions = useMemo(() => sortEvolutionVersions(versions), [versions])
  const conflictKeyByIdentity = useMemo(() => buildEvolutionConflictMap(conflicts), [conflicts])
  const scrollSignature = `evolution:${orderedVersions.map(version => version.id).join('|')}`
  const renderProjectCard = (row: RoadmapProjectRow) => (
    <RoadmapProjectCard
      key={`${row.source}:${row.id}`}
      row={row}
      versions={orderedVersions}
      columnOrder={columnOrder}
      visibleColumns={visibleColumns}
      conflictKey={conflictKeyByIdentity.get(`${row.source}:${row.id}`)}
      canEdit={canEdit}
      onOpenConflict={onOpenConflict}
      onEditPlannedProject={onEditPlannedProject}
      onDeletePlannedProject={onDeletePlannedProject}
    />
  )

  useEffect(() => {
    if (scrollSignature === 'evolution:') return undefined
    const frame = requestAnimationFrame(() => {
      const element = scrollRef.current
      const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
      element?.scrollTo({
        left: element.scrollWidth,
        behavior: reducedMotion ? 'auto' : 'smooth',
      })
    })
    return () => cancelAnimationFrame(frame)
  // Deliberately keyed only by view mode and ordered version IDs so filters and columns never hijack scroll.
  }, [scrollSignature])

  if (!orderedVersions.length) {
    return (
      <div className="pms-roadmap-evolution-empty-state">
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无 tOS 版本，请先维护版本" />
      </div>
    )
  }

  const gridStyle = {
    '--roadmap-version-count': orderedVersions.length,
  } as CSSProperties

  return (
    <div
      ref={scrollRef}
      className="pms-roadmap-evolution-shell"
      aria-label="tOS 版本演进视图"
      tabIndex={0}
    >
      <div className="pms-roadmap-evolution-grid" style={gridStyle}>
        {orderedVersions.map((version, index) => {
          const targetCollapsed = collapsedTargetVersionIds.has(version.id)
          return (
            <header
              key={`header:${version.id}`}
              className="pms-roadmap-evolution-version-cell"
              style={{ gridColumn: index + 1, gridRow: 1 }}
            >
              <Flex justify="space-between" align="center" gap={8}>
                <Typography.Title level={5}>{version.name}</Typography.Title>
                <Typography.Text type="secondary">
                  {countEvolutionRows(rows, version.id)} 个项目
                </Typography.Text>
              </Flex>
              {version.targets.length ? (
                <section className="pms-roadmap-evolution-target" aria-label={`${version.name} 目标`}>
                  <Flex justify="space-between" align="center" gap={8}>
                    <Button
                      type="text"
                      size="small"
                      aria-expanded={!targetCollapsed}
                      icon={targetCollapsed ? <DownOutlined aria-hidden /> : <UpOutlined aria-hidden />}
                      onClick={() => onToggleTarget(version.id)}
                    >
                      <BulbOutlined aria-hidden /> 版本目标
                    </Button>
                    {canEdit ? (
                      <Button
                        type="link"
                        size="small"
                        icon={<EditOutlined aria-hidden />}
                        onClick={() => onEditTosTargets(version.id)}
                      >
                        修改目标
                      </Button>
                    ) : null}
                  </Flex>
                  {!targetCollapsed ? (
                    <Typography.Paragraph
                      className="pms-roadmap-evolution-target-text"
                      style={{ margin: '7px 0 0', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}
                    >
                      {version.targets.join('\n')}
                    </Typography.Paragraph>
                  ) : null}
                </section>
              ) : null}
            </header>
          )
        })}

        {orderedVersions.map((version, index) => (
          <div
            key={`new:${version.id}`}
            className="pms-roadmap-evolution-grid-cell"
            style={{ gridColumn: index + 1, gridRow: 2 }}
          >
            <EvolutionProductCell
              productType="新品"
              version={version}
              rows={rows}
              renderProjectCard={renderProjectCard}
            />
          </div>
        ))}

        {orderedVersions.map((version, index) => {
          const oldCount = countEvolutionRows(rows, version.id, '老品')
          return (
            <div
              key={`separator:${version.id}`}
              className="pms-roadmap-evolution-separator"
              style={{ gridColumn: index + 1, gridRow: 3 }}
            >
              <Typography.Text strong>老品</Typography.Text>
              <Typography.Text type="secondary">{oldCount}</Typography.Text>
            </div>
          )
        })}

        {orderedVersions.map((version, index) => (
          <div
            key={`old:${version.id}`}
            className="pms-roadmap-evolution-grid-cell"
            style={{ gridColumn: index + 1, gridRow: 4 }}
          >
            <EvolutionProductCell
              productType="老品"
              version={version}
              rows={rows}
              renderProjectCard={renderProjectCard}
            />
          </div>
        ))}
      </div>

      <style jsx global>{`
        .pms-roadmap-evolution-shell {
          width: 100%;
          min-width: 0;
          min-height: 480px;
          max-height: calc(100vh - 248px);
          overflow: auto;
          overscroll-behavior: contain;
          scrollbar-gutter: stable;
          border: 1px solid var(--border-purple);
          border-radius: var(--radius-xl);
          background: rgba(238, 242, 255, 0.5);
          box-shadow: var(--shadow-sm);
        }

        .pms-roadmap-evolution-shell:focus-visible {
          outline: 2px solid var(--primary);
          outline-offset: 2px;
        }

        .pms-roadmap-evolution-grid {
          display: grid;
          grid-template-columns: repeat(var(--roadmap-version-count), minmax(292px, 1fr));
          grid-template-rows: auto minmax(min-content, max-content) auto minmax(min-content, max-content);
          align-items: stretch;
          width: 100%;
          min-width: calc(var(--roadmap-version-count) * 300px + 16px);
          box-sizing: border-box;
          gap: 0 8px;
          padding: 0 8px 12px;
        }

        .pms-roadmap-evolution-version-cell {
          position: sticky;
          top: 0;
          z-index: 4;
          min-height: 112px;
          margin-inline: -1px;
          padding: 14px;
          border: 1px solid var(--border-purple);
          border-top: 0;
          border-radius: 0 0 var(--radius-lg) var(--radius-lg);
          background: rgba(255, 255, 255, 0.96);
          box-shadow: var(--shadow-md);
          backdrop-filter: blur(18px) saturate(150%);
        }

        .pms-roadmap-evolution-version-cell .ant-typography {
          margin: 0;
        }

        .pms-roadmap-evolution-target {
          margin-top: 10px;
          padding: 9px 10px;
          border: 1px solid rgba(245, 158, 11, 0.34);
          border-radius: var(--radius-md);
          background: linear-gradient(135deg, rgba(254, 249, 195, 0.92), rgba(255, 247, 237, 0.9));
          color: #713f12;
        }

        .pms-roadmap-evolution-target-text {
          margin: 7px 0 0;
          line-height: 1.45;
          white-space: pre-wrap;
        }

        .pms-roadmap-evolution-grid-cell {
          min-width: 0;
          border-inline: 1px solid var(--border-purple);
          background: rgba(238, 242, 255, 0.54);
        }

        .pms-roadmap-evolution-product-cell {
          min-height: 100%;
          padding: 12px 9px;
        }

        .pms-roadmap-evolution-product-heading,
        .pms-roadmap-evolution-separator,
        .pms-roadmap-evolution-brand-heading {
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .pms-roadmap-evolution-product-heading {
          min-height: 32px;
          padding: 0 2px 8px;
        }

        .pms-roadmap-evolution-separator {
          min-height: 48px;
          padding: 10px 12px;
          border: 1px solid var(--border-purple);
          background: rgba(255, 255, 255, 0.9);
          box-shadow: 0 6px 18px rgba(67, 56, 202, 0.08);
        }

        .pms-roadmap-evolution-brand-section + .pms-roadmap-evolution-brand-section {
          margin-top: 16px;
        }

        .pms-roadmap-evolution-brand-heading {
          min-height: 28px;
          padding: 0 3px 6px;
        }

        .pms-roadmap-evolution-brand-dot {
          width: 7px;
          height: 7px;
          flex: none;
          border-radius: var(--radius-full);
          background: var(--primary);
          box-shadow: 0 0 0 3px rgba(67, 56, 202, 0.1);
        }

        .pms-roadmap-evolution-brand-dot.brand-tecno {
          background: #1677ff;
          box-shadow: 0 0 0 3px rgba(22, 119, 255, 0.1);
        }

        .pms-roadmap-evolution-brand-dot.brand-infinix {
          background: #52c41a;
          box-shadow: 0 0 0 3px rgba(82, 196, 26, 0.1);
        }

        .pms-roadmap-evolution-brand-dot.brand-itel {
          background: #ff4d4f;
          box-shadow: 0 0 0 3px rgba(255, 77, 79, 0.1);
        }

        .pms-roadmap-evolution-brand-label.brand-tecno {
          color: #0958d9;
        }

        .pms-roadmap-evolution-brand-label.brand-infinix {
          color: #237804;
        }

        .pms-roadmap-evolution-brand-label.brand-itel {
          color: #cf1322;
        }

        .pms-roadmap-evolution-card-list {
          display: grid;
          gap: 8px;
        }

        .pms-roadmap-evolution-card {
          min-width: 0;
          padding: 11px;
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          background: #fff;
          box-shadow: var(--shadow-xs);
          transition: border-color var(--duration-fast) var(--ease-out),
            box-shadow var(--duration-fast) var(--ease-out),
            transform var(--duration-fast) var(--ease-out);
        }

        .pms-roadmap-evolution-card:hover {
          border-color: var(--border-purple);
          box-shadow: var(--shadow-card-hover);
          transform: translateY(-1px);
        }

        .pms-roadmap-evolution-card.is-conflict {
          border-color: rgba(245, 158, 11, 0.55);
          background: linear-gradient(90deg, rgba(254, 249, 195, 0.72), #fff 26%);
          box-shadow: inset 4px 0 0 var(--warning), var(--shadow-xs);
        }

        .pms-roadmap-evolution-card-header {
          min-width: 0;
          flex-wrap: nowrap;
        }

        .pms-roadmap-evolution-card-title {
          display: block;
          min-width: 0;
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .pms-roadmap-evolution-card-title {
          font-size: var(--text-md);
          color: var(--text-primary);
        }

        .pms-roadmap-evolution-source-tag {
          flex: none;
          margin-inline-end: 0;
          white-space: nowrap;
        }

        .pms-roadmap-evolution-card-details {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 7px 10px;
          margin: 10px 0 0;
          padding-top: 9px;
          border-top: 1px solid var(--border-light);
        }

        .pms-roadmap-evolution-card-detail {
          min-width: 0;
        }

        .pms-roadmap-evolution-card-detail dt {
          color: var(--text-secondary);
          font-size: var(--text-xs);
          line-height: 1.35;
        }

        .pms-roadmap-evolution-card-detail dd {
          overflow: hidden;
          margin: 2px 0 0;
          color: var(--text-primary);
          font-size: var(--text-sm);
          line-height: 1.4;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .pms-roadmap-evolution-conflict-action {
          height: auto;
          min-height: 34px;
          margin-top: 6px;
          padding: 2px 0;
          white-space: normal;
          text-align: start;
        }

        .pms-roadmap-evolution-card-actions {
          margin-top: 6px;
          padding-top: 6px;
          border-top: 1px solid var(--border-light);
        }

        .pms-roadmap-evolution-card-actions .ant-btn {
          min-height: 34px;
        }

        .pms-roadmap-evolution-card .ant-btn:focus-visible {
          outline: 2px solid var(--primary);
          outline-offset: 2px;
        }

        .pms-roadmap-evolution-empty {
          display: grid;
          min-height: 88px;
          place-items: center;
          color: var(--text-tertiary);
          font-size: var(--text-sm);
        }

        .pms-roadmap-evolution-empty-state {
          display: grid;
          min-height: 360px;
          place-items: center;
        }

        @media (prefers-reduced-motion: reduce) {
          .pms-roadmap-evolution-shell,
          .pms-roadmap-evolution-shell * {
            scroll-behavior: auto !important;
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </div>
  )
}
