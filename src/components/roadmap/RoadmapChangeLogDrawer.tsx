'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { HistoryOutlined, SearchOutlined } from '@ant-design/icons'
import {
  Button,
  DatePicker,
  Drawer,
  Empty,
  Flex,
  Input,
  Pagination,
  Select,
  Tag,
  Tooltip,
  Typography,
  type InputRef,
} from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { ROADMAP_AUDIT_FIELDS, ROADMAP_AUDIT_FIELD_LABELS } from '@/lib/roadmapAudit'
import { formatTosVersionDisplay, formatTosVersionFull } from '@/lib/roadmapValidation'
import type {
  RoadmapAuditField,
  RoadmapChangeAction,
  RoadmapChangeLog,
  RoadmapSource,
  TosVersionConfig,
} from '@/types/roadmap'

const DEFAULT_PAGE_SIZE = 8
const DRAWER_Z_INDEX = 1300
const CHANGE_LOG_FILTER_CONTROL_HEIGHT = 32

const ACTION_LABELS: Record<RoadmapChangeAction, string> = {
  create: '创建',
  update: '修改',
  delete: '删除',
}

const ACTION_COLORS: Record<RoadmapChangeAction, string> = {
  create: 'green',
  update: 'blue',
  delete: 'red',
}

const SOURCE_LABELS: Record<RoadmapSource, string> = {
  normal: '正常项目',
  planned: '待规划项目',
}

const SOURCE_COLORS: Record<RoadmapSource, string> = {
  normal: 'geekblue',
  planned: 'purple',
}

const filterPanelStyle: CSSProperties = {
  padding: 10,
  borderRadius: 'var(--radius-md)',
}

const logCardStyle: CSSProperties = {
  padding: 'var(--space-md)',
  borderInlineStart: '3px solid var(--accent)',
}

const fieldRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(104px, 0.32fr) minmax(0, 1fr)',
  gap: 'var(--space-sm)',
  alignItems: 'start',
  paddingBlock: 'var(--space-sm)',
  borderBottom: '1px solid var(--border-light)',
}

export type RoadmapChangeLogSourceFilter = 'all' | RoadmapSource
export type RoadmapChangeLogActionFilter = 'all' | RoadmapChangeAction
export type RoadmapChangeLogDateRange = readonly [startDate: string, endDate: string] | null

export interface RoadmapChangeLogFilters {
  projectQuery: string
  source: RoadmapChangeLogSourceFilter
  action: RoadmapChangeLogActionFilter
  dateRange: RoadmapChangeLogDateRange
}

export interface RoadmapAuditDisplayEntry {
  field: RoadmapAuditField
  label: string
  before?: string
  after?: string
  value?: string
}

export interface RoadmapChangeLogDrawerProps {
  open: boolean
  onClose: () => void
  changeLogs: readonly RoadmapChangeLog[]
  tosVersions: readonly TosVersionConfig[]
  pageSize?: number
}

function formatProjectCodeChange(
  projectCode: string,
  afterProjectCode: string,
  projectDisplayName: string,
): string {
  const normalizedCode = projectCode.trim()
  const normalizedAfterCode = afterProjectCode.trim()
  const canonicalAfterName = projectDisplayName.trim()
  if (/\(Android \d+\)$/.test(normalizedCode)) return normalizedCode
  // Legacy logs stored raw project codes. New logs already carry canonical before/after values.
  const suffix = canonicalAfterName.startsWith(normalizedAfterCode)
    ? canonicalAfterName.slice(normalizedAfterCode.length)
    : ''
  return `${normalizedCode}${suffix}`
}

function comparableText(value: string): string {
  return value.trim().toLocaleLowerCase('zh-CN')
}

function sortableTimestamp(value: string): number {
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY
}

function occurredDate(value: string): string | null {
  const parsed = dayjs(value)
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : null
}

export function filterAndSortRoadmapChangeLogs(
  changeLogs: readonly RoadmapChangeLog[],
  filters: RoadmapChangeLogFilters,
): RoadmapChangeLog[] {
  const query = comparableText(filters.projectQuery)
  const [rawStartDate, rawEndDate] = filters.dateRange ?? ['', '']
  const startDate = rawStartDate && rawEndDate && rawStartDate > rawEndDate ? rawEndDate : rawStartDate
  const endDate = rawStartDate && rawEndDate && rawStartDate > rawEndDate ? rawStartDate : rawEndDate

  return changeLogs
    .map((log, originalIndex) => ({ log, originalIndex }))
    .filter(({ log }) => {
      if (query) {
        const matchesProject = comparableText(log.projectDisplayName).includes(query)
          || comparableText(log.projectId).includes(query)
        if (!matchesProject) return false
      }
      if (filters.source !== 'all' && log.source !== filters.source) return false
      if (filters.action !== 'all' && log.action !== filters.action) return false
      if (startDate && endDate) {
        const date = occurredDate(log.occurredAt)
        if (!date || date < startDate || date > endDate) return false
      }
      return true
    })
    .sort((left, right) => (
      sortableTimestamp(right.log.occurredAt) - sortableTimestamp(left.log.occurredAt)
      || left.originalIndex - right.originalIndex
    ))
    .map(({ log }) => log)
}

export function paginateRoadmapChangeLogs(
  changeLogs: readonly RoadmapChangeLog[],
  page: number,
  pageSize: number,
): RoadmapChangeLog[] {
  const safePageSize = Math.max(1, Math.trunc(pageSize) || DEFAULT_PAGE_SIZE)
  const safePage = Math.max(1, Math.trunc(page) || 1)
  const start = (safePage - 1) * safePageSize
  return changeLogs.slice(start, start + safePageSize)
}

export function getRoadmapAuditDisplayEntries(log: RoadmapChangeLog): RoadmapAuditDisplayEntry[] {
  if (log.action === 'update') {
    const changesByField = new Map(log.changes.map(change => [change.field, change]))
    return ROADMAP_AUDIT_FIELDS.flatMap(field => {
      const change = changesByField.get(field)
      return change ? [{
        field,
        label: ROADMAP_AUDIT_FIELD_LABELS[field],
        before: field === 'projectCode'
          ? formatProjectCodeChange(change.before, change.after, log.projectDisplayName)
          : change.before,
        after: field === 'projectCode'
          ? formatProjectCodeChange(change.after, change.after, log.projectDisplayName)
          : change.after,
      }] : []
    })
  }

  const snapshot = log.snapshot ?? {}
  return ROADMAP_AUDIT_FIELDS.flatMap(field => (
    field !== 'projectCode' && Object.prototype.hasOwnProperty.call(snapshot, field)
      ? [{ field, label: ROADMAP_AUDIT_FIELD_LABELS[field], value: snapshot[field] ?? '' }]
      : []
  ))
}

function findMaintainedTosVersion(value: string, tosVersions: readonly TosVersionConfig[]): TosVersionConfig | null {
  const candidate = value.trim()
  if (!candidate) return null
  const directMatch = tosVersions.find(version => version.id === candidate || version.name === candidate)
  if (directMatch) return directMatch

  const semanticMatch = candidate.match(/^tos\s*(\d+)\.(\d+)$/i)
  if (!semanticMatch) return null
  const major = Number(semanticMatch[1])
  const minor = Number(semanticMatch[2])
  return tosVersions.find(version => version.major === major && version.minor === minor) ?? null
}

export function resolveRoadmapChangeLogTosName(
  log: RoadmapChangeLog,
  tosVersions: readonly TosVersionConfig[],
): string {
  const maintainedVersion = resolveRoadmapChangeLogTosVersion(log, tosVersions)
  if (maintainedVersion) return formatTosVersionDisplay(maintainedVersion)
  const firstSaleChange = log.changes.find(change => change.field === 'firstSaleTosVersionId')
  return [
    log.tosVersionName,
    firstSaleChange?.after,
    log.snapshot?.firstSaleTosVersionId,
  ].find((value): value is string => typeof value === 'string' && Boolean(value.trim()))?.trim()
    || '未关联 tOS 版本'
}

function resolveRoadmapChangeLogTosVersion(
  log: RoadmapChangeLog,
  tosVersions: readonly TosVersionConfig[],
): TosVersionConfig | null {
  const firstSaleChange = log.changes.find(change => change.field === 'firstSaleTosVersionId')
  const candidates = [
    log.tosVersionName,
    firstSaleChange?.after,
    log.snapshot?.firstSaleTosVersionId,
  ].filter((value): value is string => typeof value === 'string' && Boolean(value.trim()))

  for (const candidate of candidates) {
    const maintainedVersion = findMaintainedTosVersion(candidate, tosVersions)
    if (maintainedVersion) return maintainedVersion
  }
  return null
}

function formatAuditValue(
  field: RoadmapAuditField,
  value: string | undefined,
  tosVersions: readonly TosVersionConfig[],
): string {
  const normalized = value?.trim() ?? ''
  if (!normalized) return '—'
  if (field !== 'firstSaleTosVersionId') return normalized
  const maintainedVersion = findMaintainedTosVersion(normalized, tosVersions)
  return maintainedVersion ? formatTosVersionDisplay(maintainedVersion) : normalized
}

function renderAuditValue(
  field: RoadmapAuditField,
  value: string | undefined,
  tosVersions: readonly TosVersionConfig[],
) {
  const displayValue = formatAuditValue(field, value, tosVersions)
  if (field !== 'firstSaleTosVersionId' || !value) return displayValue
  const maintainedVersion = findMaintainedTosVersion(value, tosVersions)
  return maintainedVersion
    ? <Tooltip title={formatTosVersionFull(maintainedVersion)}>{displayValue}</Tooltip>
    : displayValue
}

function formatOccurredAt(value: string): string {
  const parsed = dayjs(value)
  return parsed.isValid() ? parsed.format('YYYY-MM-DD HH:mm') : '时间未知'
}

export default function RoadmapChangeLogDrawer({
  open,
  onClose,
  changeLogs,
  tosVersions,
  pageSize = DEFAULT_PAGE_SIZE,
}: RoadmapChangeLogDrawerProps) {
  const searchInputRef = useRef<InputRef>(null)
  const [projectQuery, setProjectQuery] = useState('')
  const [source, setSource] = useState<RoadmapChangeLogSourceFilter>('all')
  const [action, setAction] = useState<RoadmapChangeLogActionFilter>('all')
  const [datePickerRange, setDatePickerRange] = useState<[Dayjs | null, Dayjs | null] | null>(null)
  const [page, setPage] = useState(1)

  const dateRange = useMemo<RoadmapChangeLogDateRange>(() => {
    const [start, end] = datePickerRange ?? []
    return start && end ? [start.format('YYYY-MM-DD'), end.format('YYYY-MM-DD')] : null
  }, [datePickerRange])

  const filteredLogs = useMemo(() => filterAndSortRoadmapChangeLogs(changeLogs, {
    projectQuery,
    source,
    action,
    dateRange,
  }), [action, changeLogs, dateRange, projectQuery, source])

  const safePageSize = Math.max(1, Math.trunc(pageSize) || DEFAULT_PAGE_SIZE)
  const lastPage = Math.max(1, Math.ceil(filteredLogs.length / safePageSize))
  const currentPage = Math.min(page, lastPage)
  const visibleLogs = useMemo(
    () => paginateRoadmapChangeLogs(filteredLogs, currentPage, safePageSize),
    [currentPage, filteredLogs, safePageSize],
  )
  const hasActiveFilters = Boolean(projectQuery.trim() || source !== 'all' || action !== 'all' || dateRange)

  useEffect(() => {
    if (page !== currentPage) setPage(currentPage)
  }, [currentPage, page])

  const resetPage = () => setPage(1)
  const resetFilters = () => {
    setProjectQuery('')
    setSource('all')
    setAction('all')
    setDatePickerRange(null)
    resetPage()
  }

  const renderAuditEntries = (log: RoadmapChangeLog) => {
    const entries = getRoadmapAuditDisplayEntries(log)
    if (!entries.length) {
      return <Typography.Text type="secondary">无可展示的字段变更</Typography.Text>
    }

    return entries.map(entry => (
      <div key={entry.field} style={fieldRowStyle}>
        <Typography.Text strong>{entry.label}：</Typography.Text>
        {log.action === 'update' ? (
          <Typography.Text style={{ overflowWrap: 'anywhere' }}>
            {renderAuditValue(entry.field, entry.before, tosVersions)} → {renderAuditValue(entry.field, entry.after, tosVersions)}
          </Typography.Text>
        ) : (
          <Typography.Text style={{ overflowWrap: 'anywhere' }}>
            {renderAuditValue(entry.field, entry.value, tosVersions)}
          </Typography.Text>
        )}
      </div>
    ))
  }

  return (
    <Drawer
      rootClassName="pms-modal pms-roadmap-change-log-drawer"
      classNames={{ header: 'pms-glass-surface', body: 'pms-solid-surface' }}
      title={(
        <Flex align="center" gap={8}>
          <HistoryOutlined aria-hidden />
          <span>修改记录</span>
        </Flex>
      )}
      open={open}
      onClose={onClose}
      afterOpenChange={visible => {
        if (visible) requestAnimationFrame(() => searchInputRef.current?.focus())
      }}
      placement="right"
      size="min(960px, 100vw)"
      zIndex={DRAWER_Z_INDEX}
      styles={{
        body: { padding: 12 },
      }}
    >
      <Flex vertical gap={12}>
        <section aria-label="修改记录筛选" className="pms-roadmap-change-log-filters-compact pms-toolbar" style={filterPanelStyle}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: 8,
            }}
          >
            <Flex vertical gap={2}>
              <Typography.Text strong style={{ fontSize: 12 }}>项目标识</Typography.Text>
              <Input
                ref={searchInputRef}
                aria-label="项目标识"
                size="small"
                allowClear
                prefix={<SearchOutlined aria-hidden />}
                placeholder="项目名 / 项目 ID"
                value={projectQuery}
                onChange={event => {
                  setProjectQuery(event.target.value)
                  resetPage()
                }}
                style={{ height: CHANGE_LOG_FILTER_CONTROL_HEIGHT }}
              />
            </Flex>
            <Flex vertical gap={2}>
              <Typography.Text strong style={{ fontSize: 12 }}>来源</Typography.Text>
              <Select<RoadmapChangeLogSourceFilter>
                aria-label="来源"
                size="small"
                value={source}
                options={[
                  { label: '全部来源', value: 'all' },
                  { label: '正常项目', value: 'normal' },
                  { label: '待规划项目', value: 'planned' },
                ]}
                onChange={value => {
                  setSource(value)
                  resetPage()
                }}
                style={{ height: CHANGE_LOG_FILTER_CONTROL_HEIGHT }}
              />
            </Flex>
            <Flex vertical gap={2}>
              <Typography.Text strong style={{ fontSize: 12 }}>动作</Typography.Text>
              <Select<RoadmapChangeLogActionFilter>
                aria-label="动作"
                size="small"
                value={action}
                options={[
                  { label: '全部动作', value: 'all' },
                  { label: '创建', value: 'create' },
                  { label: '修改', value: 'update' },
                  { label: '删除', value: 'delete' },
                ]}
                onChange={value => {
                  setAction(value)
                  resetPage()
                }}
                style={{ height: CHANGE_LOG_FILTER_CONTROL_HEIGHT }}
              />
            </Flex>
            <Flex vertical gap={2}>
              <Typography.Text strong style={{ fontSize: 12 }}>日期范围</Typography.Text>
              <DatePicker.RangePicker
                aria-label="日期范围"
                size="small"
                allowClear
                format="YYYY-MM-DD"
                placeholder={['开始日期', '结束日期']}
                value={datePickerRange}
                onChange={dates => {
                  setDatePickerRange(dates ? [dates[0], dates[1]] : null)
                  resetPage()
                }}
                style={{ width: '100%', height: CHANGE_LOG_FILTER_CONTROL_HEIGHT }}
              />
            </Flex>
          </div>
          <Flex justify="space-between" align="center" gap={8} wrap style={{ marginTop: 6 }}>
            <Typography.Text type="secondary" aria-live="polite" style={{ fontSize: 12 }}>
              多个条件按 AND 关系生效，共 {filteredLogs.length} 条记录
            </Typography.Text>
            <Button size="small" disabled={!hasActiveFilters} onClick={resetFilters}>清空筛选</Button>
          </Flex>
        </section>

        {visibleLogs.length ? (
          <div role="list" aria-label="修改记录列表">
            <Flex vertical gap={12}>
              {visibleLogs.map(log => (
                <article
                  key={log.id}
                  role="listitem"
                  aria-label={`${log.actor}${ACTION_LABELS[log.action]}${log.projectDisplayName}`}
                  className="pms-roadmap-change-log-card pms-glass-surface pms-interactive-surface"
                  style={logCardStyle}
                >
                  <Flex justify="space-between" align="flex-start" gap={12} wrap>
                    <Flex vertical gap={4} style={{ minWidth: 0 }}>
                      <Typography.Text type="secondary" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {formatOccurredAt(log.occurredAt)}
                      </Typography.Text>
                      <Typography.Text strong style={{ fontSize: 'var(--text-lg)', overflowWrap: 'anywhere' }}>
                        {log.actor} {ACTION_LABELS[log.action]}{' '}
                        <Tooltip title={(() => {
                          const version = resolveRoadmapChangeLogTosVersion(log, tosVersions)
                          return version
                            ? formatTosVersionFull(version)
                            : resolveRoadmapChangeLogTosName(log, tosVersions)
                        })()}>
                          {resolveRoadmapChangeLogTosName(log, tosVersions)}
                        </Tooltip>
                        {' '}· {log.projectDisplayName}
                      </Typography.Text>
                      <Typography.Text type="secondary" copyable={{ text: log.projectId }}>
                        项目 ID：{log.projectId}
                      </Typography.Text>
                    </Flex>
                    <Flex gap={8} wrap>
                      <Tag color={ACTION_COLORS[log.action]}>{ACTION_LABELS[log.action]}</Tag>
                      <Tag color={SOURCE_COLORS[log.source]}>{SOURCE_LABELS[log.source]}</Tag>
                    </Flex>
                  </Flex>
                  <div style={{ marginTop: 'var(--space-sm)' }}>
                    {renderAuditEntries(log)}
                  </div>
                </article>
              ))}
            </Flex>
          </div>
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={changeLogs.length ? '没有符合当前筛选条件的修改记录' : '暂无修改记录'}
          >
            {hasActiveFilters ? <Button size="large" onClick={resetFilters}>清空筛选</Button> : null}
          </Empty>
        )}

        {filteredLogs.length > safePageSize ? (
          <Flex justify="flex-end">
            <Pagination
              aria-label="修改记录分页"
              current={currentPage}
              pageSize={safePageSize}
              total={filteredLogs.length}
              showSizeChanger={false}
              showTotal={total => `共 ${total} 条`}
              onChange={setPage}
            />
          </Flex>
        ) : null}
      </Flex>
    </Drawer>
  )
}
