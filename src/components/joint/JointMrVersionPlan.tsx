'use client'

import { useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import {
  Button,
  DatePicker,
  Empty,
  Input,
  Modal,
  Select,
  Space,
  Spin,
  Table,
  Tooltip,
  message,
} from 'antd'
import { ExclamationCircleOutlined, HistoryOutlined, StopOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useProjectStore } from '@/stores/project'
import { usePlanStore } from '@/stores/plan'
import { usePermissionStore } from '@/stores/permission'
import { rehydrateMrVersionPlanStore, useMrVersionPlanStore } from '@/stores/mrVersionPlan'
import { buildMrAggregationSources } from '@/lib/mrPlanSourceAdapters'
import { reconcileJointMachinePlans } from '@/lib/mrAggregationRules'
import { groupMrErrorsByRow, validateJointMachineRows } from '@/lib/mrDateRules'
import {
  MISSING_COLLECTION_START_REASON,
  buildStopReleaseCandidates,
  sortStopReleaseHistory,
} from '@/lib/mrStopReleaseUiRules'
import { createShanghaiBusinessDateTicker, getShanghaiBusinessDate } from '@/lib/shanghaiBusinessDate'
import {
  buildJointMrColumnSchema,
  compareTosVersionNumbers,
  resolveMrPermissions,
} from '@/lib/mrVersionPlanRules'
import type {
  MrCellError,
  MrGroupedColumn,
  MrJointMachineRow,
  MrJointReferenceRow,
  MrMachineMetadata,
  MrPermissionResult,
  MrStopReleaseRecord,
  MrTemplateActivity,
  MrTransferType,
  TosMrVersionInstance,
} from '@/types/mrVersionPlan'

export const MR_TRANSFER_OPTIONS: MrTransferType[] = ['N/A', '1', '2', '3', '4', '5', '6', '7', '8']

let jointMrHydrationPromise: Promise<void> | null = null
let jointMrHydrated = false

function hydrateJointMrStoreOnce(): Promise<void> {
  if (jointMrHydrated) return Promise.resolve()
  if (!jointMrHydrationPromise) {
    jointMrHydrationPromise = rehydrateMrVersionPlanStore().then(() => {
      jointMrHydrated = true
    })
  }
  return jointMrHydrationPromise
}

export function useShanghaiBusinessDate(): string {
  const [businessDate, setBusinessDate] = useState(() => getShanghaiBusinessDate(new Date()))
  useEffect(() => createShanghaiBusinessDateTicker(setBusinessDate), [])
  return businessDate
}

type JointRow = MrJointReferenceRow | MrJointMachineRow

interface JointMrVersionPlanProps {
  onOpenProject?: (projectId: string, tosVersion: string) => void
}

function latestPublishedActivities(versions: ReadonlyArray<{ versionNo: string; status: string; activities: MrTemplateActivity[] }>): MrTemplateActivity[] {
  return versions.reduce<{ number: number; activities: MrTemplateActivity[] } | null>((latest, version) => {
    const match = version.status === '已发布' ? /^V([1-9]\d*)$/.exec(version.versionNo) : null
    const number = match ? Number(match[1]) : Number.NaN
    return Number.isSafeInteger(number) && (!latest || number > latest.number)
      ? { number, activities: version.activities }
      : latest
  }, null)?.activities ?? []
}

function findInstance(
  instances: readonly TosMrVersionInstance[],
  row: JointRow,
): TosMrVersionInstance | undefined {
  return row.kind === 'tos-reference'
    ? row.instance
    : instances.find(instance => instance.projectId === row.tosProjectId
      && compareTosVersionNumbers(instance.tosVersion, row.tosVersion) === 0)
}

function findActivity(
  instance: TosMrVersionInstance | undefined,
  parentName: string,
  childName: string,
) {
  if (!instance) return undefined
  const parent = instance.activities.find(activity => activity.parentId === null && activity.activityName.trim() === parentName)
  return parent
    ? instance.activities.find(activity => activity.parentId === parent.id && activity.activityName.trim() === childName)
    : undefined
}

function fallbackMetadata(projectName = '/'): MrMachineMetadata {
  return { projectName, marketName: '/', productLine: '/', spm: '/', spmUsers: [], isMada: '否', socPlatform: '/', packageMode: '/' }
}

function display(value: string | undefined): string {
  return value?.trim() || '/'
}

function dedupeMessages(errors: readonly MrCellError[]): string[] {
  return [...new Set(errors.map(error => error.message))]
}

export default function JointMrVersionPlan({ onOpenProject }: JointMrVersionPlanProps) {
  const [messageApi, messageContextHolder] = message.useMessage()
  const [hydrated, setHydrated] = useState(jointMrHydrated)
  const [versionFilter, setVersionFilter] = useState<string[]>([])
  const [projectFilter, setProjectFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState<MrTransferType | undefined>()
  const [stopModalOpen, setStopModalOpen] = useState(false)
  const [historyModalOpen, setHistoryModalOpen] = useState(false)
  const [stopProjectId, setStopProjectId] = useState<string>()
  const [stopDate, setStopDate] = useState<string>()

  const { projects, marketConfigsByProjectId, tosTypeConfigsByProjectId, currentLoginUser } = useProjectStore()
  const {
    versions: fallbackVersions,
    marketVersionsByKey,
    tosTypeVersionsByKey,
    publishedSnapshots,
  } = usePlanStore()
  const globalRoles = usePermissionStore(state => state.globalRoles)
  const templateVersions = useMrVersionPlanStore(state => state.templateVersions)
  const tosInstancesByProjectId = useMrVersionPlanStore(state => state.tosInstancesByProjectId)
  const machinePlansByKey = useMrVersionPlanStore(state => state.machinePlansByKey)
  const stopReleaseRecords = useMrVersionPlanStore(state => state.stopReleaseRecords)
  const reconcileMachinePlans = useMrVersionPlanStore(state => state.reconcileMachinePlans)
  const updateMachineTransferType = useMrVersionPlanStore(state => state.updateMachineTransferType)
  const updateMachineDate = useMrVersionPlanStore(state => state.updateMachineDate)
  const stopRelease = useMrVersionPlanStore(state => state.stopRelease)

  useEffect(() => {
    let active = true
    void hydrateJointMrStoreOnce().then(() => { if (active) setHydrated(true) })
    return () => { active = false }
  }, [])

  const today = useShanghaiBusinessDate()
  const sourceInput = useMemo(() => ({
    projects,
    marketConfigsByProjectId,
    tosTypeConfigsByProjectId,
    marketVersionsByKey,
    tosTypeVersionsByKey,
    publishedSnapshots,
    fallbackVersions,
  }), [
    fallbackVersions,
    marketConfigsByProjectId,
    marketVersionsByKey,
    projects,
    publishedSnapshots,
    tosTypeConfigsByProjectId,
    tosTypeVersionsByKey,
  ])
  const sources = useMemo(() => buildMrAggregationSources(sourceInput), [sourceInput])
  const tosInstances = useMemo(
    () => Object.values(tosInstancesByProjectId).flat(),
    [tosInstancesByProjectId],
  )

  useEffect(() => {
    if (!hydrated) return
    reconcileMachinePlans({
      today,
      tosProjects: sources.tosProjects,
      machineProjects: sources.machineProjects,
      latestPublishedLevel1ByProjectId: sources.latestPublishedLevel1ByProjectId,
    })
  }, [hydrated, reconcileMachinePlans, sources, stopReleaseRecords, today, tosInstancesByProjectId])

  const projection = useMemo(() => reconcileJointMachinePlans({
    today,
    tosProjects: sources.tosProjects,
    tosInstances,
    machineProjects: sources.machineProjects,
    latestPublishedLevel1ByProjectId: sources.latestPublishedLevel1ByProjectId,
    persistedPlans: machinePlansByKey,
    stopRecords: stopReleaseRecords,
  }), [machinePlansByKey, sources, stopReleaseRecords, today, tosInstances])

  const tosProjectNames = useMemo(
    () => new Map(sources.tosProjects.map(project => [project.projectId, project.projectName])),
    [sources.tosProjects],
  )
  const sortedRows = useMemo(() => [...projection.rows].sort((left, right) => {
    const versionOrder = compareTosVersionNumbers(left.tosVersion, right.tosVersion)
    if (versionOrder) return versionOrder
    const tosProjectOrder = (tosProjectNames.get(left.tosProjectId) ?? left.tosProjectId)
      .localeCompare(tosProjectNames.get(right.tosProjectId) ?? right.tosProjectId, 'zh-CN')
    if (tosProjectOrder) return tosProjectOrder
    if (left.kind !== right.kind) return left.kind === 'tos-reference' ? -1 : 1
    if (left.kind === 'tos-reference' || right.kind === 'tos-reference') return left.key.localeCompare(right.key)
    const leftName = sources.machineMetadataByProjectId[left.projectId]?.projectName ?? ''
    const rightName = sources.machineMetadataByProjectId[right.projectId]?.projectName ?? ''
    return leftName.localeCompare(rightName, 'zh-CN') || left.projectId.localeCompare(right.projectId)
  }), [projection.rows, sources.machineMetadataByProjectId, tosProjectNames])

  const versionOptions = useMemo(() => [...new Set(sortedRows.map(row => row.tosVersion))]
    .sort(compareTosVersionNumbers)
    .map(value => ({ value, label: value })), [sortedRows])
  const filteredRows = useMemo(() => {
    const query = projectFilter.trim().toLocaleLowerCase()
    return sortedRows.filter(row => {
      const projectName = row.kind === 'tos-reference'
        ? tosProjectNames.get(row.projectId) ?? ''
        : sources.machineMetadataByProjectId[row.projectId]?.projectName ?? ''
      return (!versionFilter.length || versionFilter.includes(row.tosVersion))
        && (!query || projectName.toLocaleLowerCase().includes(query))
        && (!typeFilter || (row.kind === 'tos-reference' ? typeFilter === '1' : row.plan.transferType === typeFilter))
    })
  }, [projectFilter, sortedRows, sources.machineMetadataByProjectId, tosProjectNames, typeFilter, versionFilter])

  const machineRows = useMemo(
    () => projection.rows.filter((row): row is MrJointMachineRow => row.kind === 'machine').map(row => row.plan),
    [projection.rows],
  )
  const errorsByRow = useMemo(
    () => groupMrErrorsByRow(validateJointMachineRows({ tosInstances, machinePlans: machineRows })),
    [machineRows, tosInstances],
  )
  const schema = useMemo(
    () => buildJointMrColumnSchema(tosInstances, latestPublishedActivities(templateVersions)),
    [templateVersions, tosInstances],
  )
  const globalAdminUsers = useMemo(
    () => globalRoles.find(role => role.name === '管理组')?.members ?? [],
    [globalRoles],
  )
  const permissionByProjectId = useMemo(() => new Map(sources.machineProjects.map(project => [
    project.id,
    resolveMrPermissions({
      context: 'joint-machine',
      currentUser: currentLoginUser,
      globalAdminUsers,
      tosManagerUsers: [],
      machineSpm: project.spm ?? '',
      machineSpmUsers: project.spmUsers,
      machineProjectId: project.id,
    }),
  ])), [currentLoginUser, globalAdminUsers, sources.machineProjects])
  const stopCandidates = useMemo(() => buildStopReleaseCandidates({
    rows: filteredRows,
    instances: tosInstances,
    stopRecords: stopReleaseRecords,
    permissionsByProjectId: permissionByProjectId,
    metadataByProjectId: sources.machineMetadataByProjectId,
  }), [filteredRows, permissionByProjectId, sources.machineMetadataByProjectId, stopReleaseRecords, tosInstances])
  const enabledStopCandidates = useMemo(
    () => stopCandidates.filter(candidate => !candidate.disabled),
    [stopCandidates],
  )
  const stopSelectionValid = !!stopProjectId
    && stopCandidates.some(candidate => candidate.projectId === stopProjectId && !candidate.disabled)
  const stopButtonReason = enabledStopCandidates.length
    ? undefined
    : stopCandidates.length
      ? MISSING_COLLECTION_START_REASON
      : projection.rows.some(row => row.kind === 'machine')
        ? '当前用户没有可停止发版的项目'
        : '当前没有可停止发版的项目'
  const historyRows = useMemo(() => sortStopReleaseHistory(stopReleaseRecords), [stopReleaseRecords])

  useEffect(() => {
    if (!stopProjectId) return
    if (stopCandidates.some(candidate => candidate.projectId === stopProjectId && !candidate.disabled)) return
    setStopProjectId(undefined)
  }, [stopCandidates, stopProjectId])

  const handleTransferType = (row: MrJointMachineRow, value: MrTransferType, permission: MrPermissionResult) => {
    const updated = updateMachineTransferType(row.key, value, currentLoginUser, permission)
    if (!updated) void messageApi.error('1+N转测类型更新失败，请检查项目权限')
  }
  const handleDate = (row: MrJointMachineRow, activityId: string, value: string, permission: MrPermissionResult) => {
    const updated = updateMachineDate(row.key, activityId, value, currentLoginUser, permission)
    if (!updated) void messageApi.error('日期更新失败，请检查项目权限或日期格式')
  }
  const handleOpenProject = (row: MrJointMachineRow, metadata: MrMachineMetadata) => {
    if (onOpenProject) onOpenProject(row.projectId, row.tosVersion)
    else void messageApi.info(`项目跳转将在下一步接入：${metadata.projectName}`)
  }
  const handleStopRelease = () => {
    const candidate = stopCandidates.find(item => item.projectId === stopProjectId && !item.disabled)
    if (!candidate || !stopDate) return
    const permission = permissionByProjectId.get(candidate.projectId)
    if (!permission) return
    const stopped = stopRelease({
      id: `mr-stop-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      projectId: candidate.projectId,
      projectName: candidate.projectName,
      stopDate,
      operator: currentLoginUser,
      operatedAt: new Date().toISOString(),
    }, permission)
    if (!stopped) {
      void messageApi.error('停止发版失败，请检查项目权限或MR版本计划数据')
      return
    }
    setStopModalOpen(false)
    setStopProjectId(undefined)
    setStopDate(undefined)
    void messageApi.success('停止发版成功')
  }

  const fixedColumns: ColumnsType<JointRow> = [
    { title: 'tOS版本号', dataIndex: 'tosVersion', key: 'tosVersion', width: 132, fixed: 'left', render: display },
    {
      title: '项目名称', key: 'projectName', width: 150, fixed: 'left', render: (_, row) => {
        if (row.kind === 'tos-reference') return display(tosProjectNames.get(row.projectId))
        const metadata = sources.machineMetadataByProjectId[row.projectId] ?? fallbackMetadata(row.projectId)
        return (
          <Button
            type="link"
            className="pms-joint-mr-project-link"
            aria-label={`打开项目-${metadata.projectName}`}
            onClick={() => handleOpenProject(row, metadata)}
          >
            {metadata.projectName}
          </Button>
        )
      },
    },
    ...(['市场名', '产品线', 'SPM', '是否MADA', 'SOC平台', '组包方式'] as const).map((title, index) => ({
      title,
      key: title,
      width: index === 2 ? 120 : 100,
      render: (_: unknown, row: JointRow) => {
        if (row.kind === 'tos-reference') return '/'
        const metadata = sources.machineMetadataByProjectId[row.projectId] ?? fallbackMetadata()
        const values = [metadata.marketName, metadata.productLine, metadata.spm, metadata.isMada, metadata.socPlatform, metadata.packageMode]
        return display(values[index])
      },
    })),
    {
      title: '1+N转测类型', key: 'transferType', width: 130, render: (_, row) => {
        if (row.kind === 'tos-reference') return '1'
        const permission = permissionByProjectId.get(row.projectId)
        return (
          <Select
            aria-label={`${row.projectId}-${row.tosVersion}-1+N版本类型`}
            value={row.plan.transferType}
            options={MR_TRANSFER_OPTIONS.map(value => ({ value, label: value }))}
            disabled={!permission?.canEditMachine}
            onChange={value => handleTransferType(row, value, permission!)}
            style={{ width: 88 }}
          />
        )
      },
    },
  ]

  const dateColumns: ColumnsType<JointRow> = schema.map((group: MrGroupedColumn) => ({
    title: group.title,
    key: group.key,
    children: group.children.map(child => ({
      title: child.title,
      key: child.key,
      width: 150,
      onCell: row => {
        const instance = findInstance(tosInstances, row)
        const activity = findActivity(instance, child.parentName, child.activityName)
        const errors = row.kind === 'machine' && activity
          ? (errorsByRow[row.key] ?? []).filter(error => error.activityId === activity.id)
          : []
        return { className: errors.length ? 'pms-mr-invalid-cell' : '' }
      },
      render: (_: unknown, row: JointRow) => {
        const instance = findInstance(tosInstances, row)
        const activity = findActivity(instance, child.parentName, child.activityName)
        if (!activity) return '/'
        if (row.kind === 'tos-reference') return display(instance?.dates[activity.id])
        if (row.plan.transferType === 'N/A') return '/'
        const permission = permissionByProjectId.get(row.projectId)
        const value = row.plan.dates[activity.id] || ''
        if (!permission?.canEditMachine) return display(value)
        return (
          <DatePicker
            value={value ? dayjs(value) : null}
            format="YYYY-MM-DD"
            allowClear
            aria-label={`${row.projectId}-${row.tosVersion}-${child.activityName}`}
            onChange={date => handleDate(row, activity.id, date?.format('YYYY-MM-DD') ?? '', permission)}
          />
        )
      },
    })),
  }))

  const columns: ColumnsType<JointRow> = [
    ...fixedColumns,
    ...dateColumns,
    {
      title: '错误提示', key: 'errors', width: 92, fixed: 'right', align: 'center', render: (_, row) => {
        if (row.kind === 'tos-reference') return '-'
        const messages = dedupeMessages(errorsByRow[row.key] ?? [])
        if (!messages.length) return '-'
        return (
          <Tooltip title={<div>{messages.map(item => <div key={item}>{item}</div>)}</div>}>
            <ExclamationCircleOutlined
              className="pms-joint-mr-error-icon"
              tabIndex={0}
              role="img"
              aria-label={`查看${messages.length}条日期错误`}
            />
          </Tooltip>
        )
      },
    },
  ]

  if (!hydrated) {
    return <div className="pms-joint-mr-loading" aria-busy="true"><Spin size="small" /> MR版本计划加载中</div>
  }

  return (
    <div className="pms-joint-mr-plan">
      {messageContextHolder}
      <div className="pms-joint-mr-toolbar">
        <Space wrap>
          <Select
            mode="multiple"
            allowClear
            maxTagCount="responsive"
            placeholder="tOS版本号"
            aria-label="tOS版本号"
            value={versionFilter}
            options={versionOptions}
            onChange={setVersionFilter}
            style={{ minWidth: 190 }}
          />
          <Input.Search
            allowClear
            placeholder="项目名称"
            aria-label="项目名称"
            value={projectFilter}
            onChange={event => setProjectFilter(event.target.value)}
            style={{ width: 190 }}
          />
          <Select
            allowClear
            placeholder="1+N版本类型"
            aria-label="1+N版本类型"
            value={typeFilter}
            options={MR_TRANSFER_OPTIONS.map(value => ({ value, label: value }))}
            onChange={setTypeFilter}
            style={{ width: 150 }}
          />
        </Space>
        <Space>
          <Tooltip title={stopButtonReason}>
            <span>
              <Button
                icon={<StopOutlined />}
                disabled={!enabledStopCandidates.length}
                onClick={() => setStopModalOpen(true)}
              >停止发版</Button>
            </span>
          </Tooltip>
          <Button icon={<HistoryOutlined />} onClick={() => setHistoryModalOpen(true)}>停止发版记录</Button>
        </Space>
      </div>
      <Table<JointRow>
        className="pms-joint-mr-table"
        rowKey="key"
        columns={columns}
        dataSource={filteredRows}
        pagination={false}
        scroll={{ x: 'max-content', y: 620 }}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无MR版本计划" /> }}
        rowClassName={row => row.kind === 'tos-reference' ? 'pms-joint-mr-reference-row' : ''}
      />
      <Modal
        title="停止发版"
        open={stopModalOpen}
        okText="确认停止"
        cancelText="取消"
        okButtonProps={{ disabled: !stopSelectionValid || !stopDate }}
        onOk={handleStopRelease}
        onCancel={() => {
          setStopModalOpen(false)
          setStopProjectId(undefined)
          setStopDate(undefined)
        }}
        destroyOnHidden
      >
        <Space direction="vertical" size={14} style={{ width: '100%' }}>
          <label>
            <span className="pms-joint-mr-field-label">停止发版项目名称</span>
            <Select
              aria-label="停止发版项目名称"
              value={stopProjectId}
              placeholder="请选择项目"
              onChange={setStopProjectId}
              options={stopCandidates.map(candidate => ({
                value: candidate.projectId,
                disabled: candidate.disabled,
                title: candidate.reason,
                label: `${candidate.projectName}（${candidate.projectId}）`,
              }))}
              style={{ width: '100%' }}
            />
          </label>
          <label>
            <span className="pms-joint-mr-field-label">停止发版日期</span>
            <DatePicker
              aria-label="停止发版日期"
              value={stopDate ? dayjs(stopDate) : null}
              format="YYYY-MM-DD"
              onChange={date => setStopDate(date?.format('YYYY-MM-DD'))}
              style={{ width: '100%' }}
            />
          </label>
        </Space>
      </Modal>
      <Modal
        title="停止发版记录"
        open={historyModalOpen}
        footer={null}
        width={760}
        onCancel={() => setHistoryModalOpen(false)}
        destroyOnHidden
      >
        <Table<MrStopReleaseRecord>
          rowKey="id"
          dataSource={historyRows}
          pagination={false}
          columns={[
            { title: '操作人', dataIndex: 'operator', key: 'operator' },
            { title: '操作时间', dataIndex: 'operatedAt', key: 'operatedAt' },
            { title: '操作项目', dataIndex: 'projectName', key: 'projectName' },
            { title: '停止发版日期', dataIndex: 'stopDate', key: 'stopDate' },
          ]}
          locale={{ emptyText: '暂无停止发版记录' }}
        />
      </Modal>
    </div>
  )
}
