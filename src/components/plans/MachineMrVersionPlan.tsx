'use client'

import { useEffect, useMemo, useState, type HTMLAttributes, type ReactNode } from 'react'
import { Alert, Card, DatePicker, Empty, Radio, Spin, Table, Tooltip, message } from 'antd'
import { AppstoreOutlined, ExclamationCircleOutlined, TableOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { ColumnsType } from 'antd/es/table'
import type { ProjectItem } from '@/types/app'
import type { MarketConfigRow } from '@/lib/marketRules'
import { getMainMarket } from '@/lib/marketRules'
import { projectMachineMrMetadata } from '@/lib/mrPlanSourceAdapters'
import {
  getMachineMarketDate,
  projectMachineMarketMrVersions,
} from '@/lib/mrMachineMarketRules'
import { validateMachineMarketDate } from '@/lib/mrDateRules'
import { numberMrTemplateActivities } from '@/lib/mrTemplateRules'
import { projectTosMrHorizontalColumns, resolveMrPermissions } from '@/lib/mrVersionPlanRules'
import { rehydrateMrVersionPlanStore, useMrVersionPlanStore } from '@/stores/mrVersionPlan'
import type {
  MrMachineMarketProjection,
  MrPlanViewMode,
  MrTemplateActivity,
} from '@/types/mrVersionPlan'

const MAIN_EMPTY_MESSAGE = '主市场对应时间未填写，当前市场不可填写'
const MARKET_LATER_MESSAGE = '非主市场时间不得晚于主市场对应时间'

let machineMrHydrationPromise: Promise<void> | null = null
let machineMrHydrated = false

function hydrateMachineMrStoreOnce(): Promise<void> {
  if (machineMrHydrated) return Promise.resolve()
  if (!machineMrHydrationPromise) {
    machineMrHydrationPromise = rehydrateMrVersionPlanStore().then(() => {
      machineMrHydrated = true
    })
  }
  return machineMrHydrationPromise
}

interface VerticalRow {
  key: string
  version: MrMachineMarketProjection
  activity: MrTemplateActivity
  number: string
}

interface HorizontalRow {
  key: string
  version: MrMachineMarketProjection
  market: string
}

export interface MachineMrVersionPlanProps {
  project: ProjectItem
  currentUser: string
  globalAdminUsers: string[]
  marketRows: MarketConfigRow[]
}

export default function MachineMrVersionPlan({
  project,
  currentUser,
  globalAdminUsers,
  marketRows,
}: MachineMrVersionPlanProps) {
  const [messageApi, messageContextHolder] = message.useMessage()
  const [hydrated, setHydrated] = useState(false)
  const machinePlansByKey = useMrVersionPlanStore(state => state.machinePlansByKey)
  const tosInstancesByProjectId = useMrVersionPlanStore(state => state.tosInstancesByProjectId)
  const marketOverridesByKey = useMrVersionPlanStore(state => state.marketOverridesByKey)
  const viewModeByScope = useMrVersionPlanStore(state => state.viewModeByScope)
  const updateMarketDate = useMrVersionPlanStore(state => state.updateMarketDate)
  const setViewMode = useMrVersionPlanStore(state => state.setViewMode)

  useEffect(() => {
    let active = true
    void hydrateMachineMrStoreOnce().then(() => {
      if (active) setHydrated(true)
    })
    return () => { active = false }
  }, [])

  const projection = useMemo(() => projectMachineMarketMrVersions({
    projectId: project.id,
    plansByKey: machinePlansByKey,
    instancesByProjectId: tosInstancesByProjectId,
    marketRows,
  }), [machinePlansByKey, marketRows, project.id, tosInstancesByProjectId])
  const configuredMainMarket = getMainMarket(marketRows)
  const mainMarket = projection.mainMarket || configuredMainMarket
  const metadata = useMemo(() => projectMachineMrMetadata(project, marketRows), [marketRows, project])
  const permission = useMemo(() => resolveMrPermissions({
    context: 'machine-market',
    currentUser,
    globalAdminUsers,
    tosManagerUsers: [],
    machineSpm: metadata.spm,
    machineSpmUsers: metadata.spmUsers,
    machineProjectId: project.id,
  }), [currentUser, globalAdminUsers, metadata.spm, metadata.spmUsers, project.id])
  const scopeKey = `machine::${project.id}`
  const mode: MrPlanViewMode = viewModeByScope[scopeKey] ?? 'vertical'

  const valueFor = (version: MrMachineMarketProjection, market: string, activityId: string) => (
    getMachineMarketDate({ plan: version.plan, overridesByKey: marketOverridesByKey, market, mainMarket, activityId })
  )
  const errorsFor = (version: MrMachineMarketProjection, market: string, activity: MrTemplateActivity) => {
    if (activity.parentId === null || market === mainMarket) return []
    return validateMachineMarketDate({
      value: valueFor(version, market, activity.id),
      mainValue: valueFor(version, mainMarket, activity.id),
      activityId: activity.id,
      activityName: activity.activityName,
    })
  }
  const handleDateChange = (version: MrMachineMarketProjection, market: string, activity: MrTemplateActivity, value: string) => {
    const updated = updateMarketDate({
      projectId: project.id,
      tosVersion: version.tosVersion,
      market,
      mainMarket,
      activityId: activity.id,
      value,
      // The store intentionally validates against its authoritative joint row.
      mainValue: valueFor(version, mainMarket, activity.id),
    }, currentUser, permission)
    if (!updated) {
      void messageApi.error('日期更新失败，请检查权限、主市场日期或日期格式')
    }
  }

  const renderCell = (version: MrMachineMarketProjection, market: string, activity: MrTemplateActivity): ReactNode => {
    if (activity.parentId === null) return <span>/</span>
    const value = valueFor(version, market, activity.id)
    const mainValue = valueFor(version, mainMarket, activity.id)
    const errors = errorsFor(version, market, activity)
    if (market === mainMarket || !permission.canEditMarket) {
      const content = <span>{value || '-'}</span>
      return errors.length ? <Tooltip color="red" title={errors.join('；')}>{content}</Tooltip> : content
    }
    const mainMissing = !mainValue
    const picker = (
      <DatePicker
        aria-label={`${version.tosVersion}-${market}-${activity.activityName}`}
        value={value ? dayjs(value, 'YYYY-MM-DD', true) : null}
        format="YYYY-MM-DD"
        allowClear
        disabled={mainMissing}
        status={errors.length ? 'error' : undefined}
        onChange={(_, dateText) => handleDateChange(
          version,
          market,
          activity,
          Array.isArray(dateText) ? dateText[0] ?? '' : dateText,
        )}
        style={{ width: '100%' }}
      />
    )
    const content = mainMissing ? <Tooltip title={MAIN_EMPTY_MESSAGE}><span className="pms-mr-disabled-date">{picker}</span></Tooltip> : picker
    if (!errors.length) return content
    return (
      <span className="pms-mr-date-with-error">
        {content}
        <Tooltip color="red" title={errors.join('；')}>
          <ExclamationCircleOutlined
            className="pms-mr-error-icon"
            tabIndex={0}
            aria-label={`${version.tosVersion}-${market}-${activity.activityName}-错误：${errors.join('；')}`}
          />
        </Tooltip>
      </span>
    )
  }

  const verticalRows = useMemo<VerticalRow[]>(() => projection.versions.flatMap(version => (
    numberMrTemplateActivities(version.activities).map(activity => ({
      key: `${version.key}::${activity.id}`,
      version,
      activity,
      number: activity.number,
    }))
  )), [projection.versions])
  const verticalColumns: ColumnsType<VerticalRow> = [
    { title: 'tOS版本号', key: 'tosVersion', width: 150, fixed: 'left', render: (_, row) => row.version.tosVersion },
    { title: '活动序号', dataIndex: 'number', key: 'number', width: 110, fixed: 'left' },
    { title: '活动名称', key: 'activityName', width: 240, fixed: 'left', render: (_, row) => row.activity.activityName },
    ...projection.markets.map(market => ({
      title: market,
      key: market,
      width: 190,
      onCell: (row: VerticalRow) => ({
        className: errorsFor(row.version, market, row.activity).length ? 'pms-mr-invalid-cell' : undefined,
      }),
      render: (_: unknown, row: VerticalRow) => renderCell(row.version, market, row.activity),
    })),
  ]

  const horizontalRows = useMemo<HorizontalRow[]>(() => projection.versions.flatMap(version => (
    projection.markets.map(market => ({ key: `${version.key}::${market}`, version, market }))
  )), [projection.markets, projection.versions])
  const horizontalGroups = useMemo(() => {
    const groups: ReturnType<typeof projectTosMrHorizontalColumns> = []
    const pairs = new Set<string>()
    projection.versions.forEach(version => {
      projectTosMrHorizontalColumns(version.activities).forEach(group => {
        let target = groups.find(candidate => candidate.title === group.title)
        if (!target) {
          target = { ...group, children: [] }
          groups.push(target)
        }
        group.children.forEach(child => {
          const pair = `${child.parentName}\u0000${child.activityName}`
          if (!pairs.has(pair)) {
            pairs.add(pair)
            target!.children.push({ ...child })
          }
        })
      })
    })
    return groups
  }, [projection.versions])
  const findActivity = (row: HorizontalRow, parentName: string, activityName: string) => {
    const parent = row.version.activities.find(activity => activity.parentId === null && activity.activityName === parentName)
    return parent ? row.version.activities.find(activity => activity.parentId === parent.id && activity.activityName === activityName) : undefined
  }
  const horizontalColumns: ColumnsType<HorizontalRow> = [
    { title: 'tOS版本号', key: 'tosVersion', width: 150, fixed: 'left', render: (_, row) => row.version.tosVersion },
    { title: '市场项目', dataIndex: 'market', key: 'market', width: 120, fixed: 'left' },
    ...horizontalGroups.map(group => ({
      title: group.title,
      key: group.key,
      children: group.children.map(child => ({
        title: child.title,
        key: child.key,
        width: 190,
        onCell: (row: HorizontalRow) => {
          const activity = findActivity(row, child.parentName, child.activityName)
          return { className: activity && errorsFor(row.version, row.market, activity).length ? 'pms-mr-invalid-cell' : undefined }
        },
        render: (_: unknown, row: HorizontalRow) => {
          const activity = findActivity(row, child.parentName, child.activityName)
          return activity ? renderCell(row.version, row.market, activity) : '-'
        },
      })),
    })),
  ]

  if (!hydrated) {
    return <Card className="pms-machine-mr-card"><div className="pms-mr-project-loading"><Spin size="small" /><span>MR版本计划加载中</span></div></Card>
  }

  return (
    <Card className="pms-machine-mr-card" styles={{ body: { padding: 16 } }}>
      {messageContextHolder}
      <div className="pms-machine-mr-toolbar">
        <span className="pms-machine-mr-hint">主市场实时同步；{MARKET_LATER_MESSAGE}</span>
        <Radio.Group
          value={mode}
          onChange={event => setViewMode(scopeKey, event.target.value as MrPlanViewMode)}
          optionType="button"
          buttonStyle="solid"
          size="small"
        >
          <Radio.Button value="vertical" aria-label="竖版视图"><TableOutlined /> 竖版视图</Radio.Button>
          <Radio.Button value="horizontal" aria-label="横版视图"><AppstoreOutlined /> 横版视图</Radio.Button>
        </Radio.Group>
      </div>
      {projection.missingInstanceVersions.length > 0 && (
        <Alert
          type="warning"
          showIcon
          title="部分MR版本缺少对应的tOS计划快照"
          description={`${projection.missingInstanceVersions.join('、')} 暂无法展示，请先确认对应tOS项目的三级计划-MR版本计划数据。`}
          style={{ marginBottom: 12 }}
        />
      )}
      {!projection.markets.length ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="尚未配置市场" />
      ) : !projection.versions.length ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无MR版本计划" />
      ) : mode === 'vertical' ? (
        <Table<VerticalRow>
          aria-label="整机MR版本计划竖版表格"
          className="pms-table pms-machine-mr-table pms-machine-mr-table--vertical"
          rowKey="key"
          columns={verticalColumns}
          dataSource={verticalRows}
          pagination={false}
          scroll={{ x: 'max-content' }}
          rowClassName={row => row.activity.parentId === null ? 'pms-mr-parent-row' : 'pms-mr-child-row'}
          onRow={row => ({
            'data-mr-tos-version': row.version.tosVersion,
            'data-mr-version': row.version.tosVersion,
            tabIndex: -1,
          } as HTMLAttributes<HTMLTableRowElement>)}
        />
      ) : (
        <Table<HorizontalRow>
          aria-label="整机MR版本计划横版表格"
          className="pms-table pms-machine-mr-table pms-machine-mr-table--horizontal"
          rowKey="key"
          columns={horizontalColumns}
          dataSource={horizontalRows}
          pagination={false}
          scroll={{ x: 'max-content' }}
          onRow={row => ({
            'data-mr-tos-version': row.version.tosVersion,
            'data-mr-version': row.version.tosVersion,
            tabIndex: -1,
          } as HTMLAttributes<HTMLTableRowElement>)}
        />
      )}
    </Card>
  )
}
