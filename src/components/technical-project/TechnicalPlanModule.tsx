'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Alert, Button, Card, DatePicker, Empty, Input, Modal, Popconfirm,
  Radio, Row, Select, Space, Switch, Table, Tabs, Tag, Tooltip, Typography, Upload, message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  BarChartOutlined, DeleteOutlined, DownloadOutlined, HistoryOutlined, PlusOutlined, SaveOutlined,
  SettingOutlined, StopOutlined, UnorderedListOutlined, UploadOutlined,
} from '@ant-design/icons'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'
import SubprojectConfigModal from '@/components/technical-project/SubprojectConfigModal'
import { DHTMLXGantt, DragHandle, SortableRow } from '@/components/shared/PlanHelpers'
import { SortableColumnSettings } from '@/components/shared/SortableColumnSettings'
import { compareVersionsForTable } from '@/lib/versionCompare'
import { getTemplateSnapshotForProjectType } from '@/lib/projectTemplateCompatibility'
import {
  getInvalidTechnicalTaskFields,
  getTemplateConfigScopeKey,
  insertTechnicalPlanTask,
  deleteTechnicalPlanTaskCascade,
  TECHNICAL_TEMPLATE_STORAGE_KEYS,
  validateTechnicalTemplateDepth,
} from '@/lib/technicalPlanRules'
import { exportSheet, exportTimestamp } from '@/utils/exportExcel'
import { usePlanStore } from '@/stores/plan'
import { useTechnicalProjectStore } from '@/stores/technicalProject'
import {
  buildTechnicalPlanTabs, getTechnicalPlanKey, useTechnicalPlanStore,
} from '@/stores/technicalPlan'
import type { TechnicalTemplateKind, TechnicalTemplateTask } from '@/types/technicalPlan'
import type { TechnicalSubproject } from '@/types/technicalProject'
import type { SortableColumnDefinition } from '@/lib/columnSettings'

const { Text } = Typography
const FIXED_TDT_LABEL = 'TDT项目计划'

const COLUMN_LABELS: Record<string, string> = {
  taskName: '任务名称', responsible: '责任人', predecessor: '前置任务',
  planStartDate: '计划开始', planEndDate: '计划完成', estimatedDays: '预估工期', status: '状态', progress: '进度',
}
const TECHNICAL_COLUMN_DEFINITIONS: readonly SortableColumnDefinition<string>[] = Object.entries(COLUMN_LABELS).map(([key, title]) => ({
  key, title, defaultVisible: true, hideable: key !== 'taskName', fixed: key === 'taskName' ? 'left' : undefined,
}))
const DEFAULT_MAX_DEPTH: Readonly<Record<TechnicalTemplateKind, number>> = { tdt: 2, subproject: 1 }

export interface TechnicalPlanModuleProps {
  projectId: string
  currentLoginUser?: string
  canEdit: boolean
  canPublish: boolean
  canImport: boolean
  canExport: boolean
  maxDepthByKind: Readonly<Record<TechnicalTemplateKind, number>>
}

const latestPublishedTemplate = (
  kind: TechnicalTemplateKind,
  scopes: ReturnType<typeof usePlanStore.getState>['configTemplateVersionScopes'],
  snapshots: ReturnType<typeof usePlanStore.getState>['publishedSnapshots'],
  fallback: readonly TechnicalTemplateTask[],
) => {
  const scope = scopes[getTemplateConfigScopeKey('技术项目', kind)]
  const published = (scope?.versions || [])
    .filter(version => version.status === '已发布')
    .sort((left, right) => (Number.parseInt(right.versionNo.replace(/\D/g, ''), 10) || 0) - (Number.parseInt(left.versionNo.replace(/\D/g, ''), 10) || 0))[0]
  return (published && getTemplateSnapshotForProjectType<TechnicalTemplateTask[]>(snapshots, '技术项目', published.id, kind)) || fallback
}

export default function TechnicalPlanModule({
  projectId, currentLoginUser, canEdit, canPublish, canImport, canExport,
  maxDepthByKind = DEFAULT_MAX_DEPTH,
}: TechnicalPlanModuleProps) {
  const [showInactive, setShowInactive] = useState(false)
  const [activeKey, setActiveKey] = useState(`${projectId}:tdt`)
  const [viewMode, setViewMode] = useState<'table' | 'gantt'>('table')
  const [compareOpen, setCompareOpen] = useState(false)
  const [compareIds, setCompareIds] = useState<string[]>([])
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [configuringChild, setConfiguringChild] = useState<TechnicalSubproject | null>(null)
  const [configTrigger, setConfigTrigger] = useState<HTMLElement | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const subprojects = useTechnicalProjectStore(state => state.subprojects)
  const plansByKey = useTechnicalPlanStore(state => state.plansByKey)
  const createRevision = useTechnicalPlanStore(state => state.createRevision)
  const publishRevision = useTechnicalPlanStore(state => state.publishRevision)
  const cancelRevision = useTechnicalPlanStore(state => state.cancelRevision)
  const updateCurrentTasks = useTechnicalPlanStore(state => state.updateCurrentTasks)
  const setCurrentVersion = useTechnicalPlanStore(state => state.setCurrentVersion)
  const setColumns = useTechnicalPlanStore(state => state.setColumns)
  const setCollapsed = useTechnicalPlanStore(state => state.setCollapsed)
  const configTemplateTasksByType = usePlanStore(state => state.configTemplateTasksByType)
  const configTemplateVersionScopes = usePlanStore(state => state.configTemplateVersionScopes)
  const publishedSnapshots = usePlanStore(state => state.publishedSnapshots)

  const tabs = useMemo(
    () => buildTechnicalPlanTabs(projectId, subprojects, showInactive),
    [projectId, showInactive, subprojects],
  )
  useEffect(() => {
    const firstKey = `${projectId}:tdt`
    setActiveKey(current => tabs.some(tab => tab.key === current) ? current : firstKey)
  }, [projectId, tabs])
  const tab = tabs.find(item => item.key === activeKey) || tabs[0]
  const scope = tab?.scope || { kind: 'tdt' as const, parentProjectId: projectId }
  const instance = plansByKey[getTechnicalPlanKey(scope)]
  const currentVersion = instance?.versions.find(version => version.id === instance.currentVersionId) || instance?.versions[0]
  const tasks = currentVersion?.tasks || []
  const isDraft = currentVersion?.status === '修订中'
  const readOnlyReason = tab?.subproject && !tab.subproject.active
    ? '已停用子项目仅可查看历史计划'
    : tab?.subproject && (!tab.subproject.configuration.coreValue || !tab.subproject.configuration.developmentMode)
      ? '请先完成子项目信息配置'
      : ''
  const canMaintain = canEdit && isDraft && !readOnlyReason
  const templateTasks = latestPublishedTemplate(
    tab?.templateKind || 'tdt', configTemplateVersionScopes, publishedSnapshots,
    configTemplateTasksByType[TECHNICAL_TEMPLATE_STORAGE_KEYS[tab?.templateKind || 'tdt']] || [],
  )
  const maxDepth = Math.min(maxDepthByKind[tab?.templateKind || 'tdt'], tab?.templateKind === 'subproject' ? 1 : 2)
  const invalid = getInvalidTechnicalTaskFields(tasks)

  const handleCreateRevision = () => {
    if (!tab || !canEdit) return
    const result = createRevision({ scope: tab.scope, templateKind: tab.templateKind, maxDepth, templateTasks, subproject: tab.subproject })
    if (!result.ok) {
      message.warning(result.reason === 'draft-exists' ? '当前计划已有修订版' : readOnlyReason || '当前子项目不可创建修订')
      return
    }
    message.success(`已创建 ${result.versionId.replace('-draft', '')} 修订`)
  }

  const handlePublish = () => {
    if (!canPublish || !canMaintain) return
    if (invalid.size) { message.error('请先修复计划日期冲突'); return }
    if (publishRevision(scope).ok) message.success('计划已发布')
  }

  const updateTask = (id: string, patch: Partial<TechnicalTemplateTask>) => {
    if (!canMaintain) return
    updateCurrentTasks(scope, tasks.map(task => task.id === id ? { ...task, ...patch } : task), maxDepth)
  }

  const createTask = (parentId?: string): TechnicalTemplateTask => ({
    id: `technical-task-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    order: tasks.length + 1,
    taskName: parentId ? '新建二级任务' : '新建一级任务',
    ...(parentId ? { parentId } : {}),
    responsible: '', predecessor: '', planStartDate: '', planEndDate: '', estimatedDays: 0,
    actualStartDate: '', actualEndDate: '', actualDays: 0, status: '未开始', progress: 0, defaultRoadmap: Boolean(parentId),
  })

  const handleAddTopLevelTask = () => {
    if (!canMaintain) return
    const result = updateCurrentTasks(scope, insertTechnicalPlanTask(tasks, createTask(), tab?.templateKind || 'tdt', maxDepth), maxDepth)
    if (!result.ok) message.error('新增任务超出允许层级')
  }

  const handleAddChildTask = (parentId: string) => {
    if (!canMaintain || maxDepth < 2 || tasks.find(task => task.id === parentId)?.parentId) return
    const next = insertTechnicalPlanTask(tasks, createTask(parentId), tab?.templateKind || 'tdt', maxDepth)
    const result = updateCurrentTasks(scope, next, maxDepth)
    if (!result.ok) message.error('新增任务超出允许层级')
  }

  const handleDeleteTask = (taskId: string) => {
    if (!canMaintain) return
    const next = deleteTechnicalPlanTaskCascade(tasks, taskId)
    updateCurrentTasks(scope, next, maxDepth)
    const removedCount = tasks.length - next.length
    message.success(removedCount > 1 ? `已级联删除 ${removedCount} 项任务` : '已删除任务')
  }

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id || !canMaintain) return
    const oldIndex = tasks.findIndex(task => task.id === active.id)
    const newIndex = tasks.findIndex(task => task.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const moved = arrayMove(tasks, oldIndex, newIndex).map((task, order) => ({ ...task, order: order + 1 }))
    updateCurrentTasks(scope, moved, maxDepth)
  }

  const baseColumns: ColumnsType<TechnicalTemplateTask> = [
    { key: 'drag', width: 42, render: () => canMaintain ? <DragHandle /> : null },
    { key: 'taskName', title: '任务名称', dataIndex: 'taskName', width: 230, render: (value, row) => canMaintain ? <Input value={value} onChange={event => updateTask(row.id, { taskName: event.target.value })} /> : <Space size={8}><span style={{ paddingLeft: row.parentId ? 20 : 0 }}>{value}</span>{!row.parentId && <Tag color="geekblue">阶段</Tag>}</Space> },
    { key: 'responsible', title: '责任人', dataIndex: 'responsible', width: 130, render: (value, row) => canMaintain ? <Input value={value} onChange={event => updateTask(row.id, { responsible: event.target.value })} /> : value || '-' },
    { key: 'predecessor', title: '前置任务', dataIndex: 'predecessor', width: 120, render: (value, row) => canMaintain ? <Input value={value} onChange={event => updateTask(row.id, { predecessor: event.target.value })} /> : value || '-' },
    { key: 'planStartDate', title: '计划开始', dataIndex: 'planStartDate', width: 145, onCell: row => ({ className: invalid.get(row.id)?.start ? 'pms-cell-invalid' : '' }), render: (value, row) => canMaintain ? <Tooltip title={invalid.get(row.id)?.start?.join('；')}><DatePicker value={value ? dayjs(value) : null} onChange={date => updateTask(row.id, { planStartDate: date?.format('YYYY-MM-DD') || '' })} /></Tooltip> : value || '-' },
    { key: 'planEndDate', title: '计划完成', dataIndex: 'planEndDate', width: 145, onCell: row => ({ className: invalid.get(row.id)?.end ? 'pms-cell-invalid' : '' }), render: (value, row) => canMaintain ? <Tooltip title={invalid.get(row.id)?.end?.join('；')}><DatePicker value={value ? dayjs(value) : null} onChange={date => updateTask(row.id, { planEndDate: date?.format('YYYY-MM-DD') || '' })} /></Tooltip> : value || '-' },
    { key: 'estimatedDays', title: '预估工期', dataIndex: 'estimatedDays', width: 100 },
    { key: 'status', title: '状态', dataIndex: 'status', width: 95, render: value => <Tag color={value === '已完成' ? 'success' : value === '进行中' ? 'processing' : 'default'}>{value}</Tag> },
    { key: 'progress', title: '进度', dataIndex: 'progress', width: 80, render: value => `${value || 0}%` },
    {
      key: 'actions', title: '操作', fixed: 'right', width: 105,
      render: (_, row) => (
        <Space size={2}>
          {tab?.templateKind === 'tdt' && !row.parentId && (
            <Tooltip title="新增二级任务">
              <Button type="text" size="small" aria-label={`新增二级任务 ${row.taskName}`} icon={<PlusOutlined />} disabled={!canMaintain || maxDepth < 2} onClick={() => handleAddChildTask(row.id)} />
            </Tooltip>
          )}
          <Popconfirm title={tasks.some(task => task.parentId === row.id) ? '删除一级任务将同时删除其下所有二级任务，是否继续？' : '确认删除该任务？'} onConfirm={() => handleDeleteTask(row.id)}>
            <Tooltip title="删除任务">
              <Button type="text" danger size="small" aria-label={`删除任务 ${row.taskName}`} icon={<DeleteOutlined />} disabled={!canMaintain} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ]
  const visibleKeys = new Set(instance?.columnSettings.visible || Object.keys(COLUMN_LABELS))
  const columnOrder = ['drag', ...(instance?.columnSettings.order || Object.keys(COLUMN_LABELS))]
  const columns = baseColumns
    .filter(column => column.key === 'drag' || column.key === 'actions' || visibleKeys.has(String(column.key)))
    .sort((left, right) => {
      const index = (key: unknown) => key === 'actions' ? Number.MAX_SAFE_INTEGER : columnOrder.indexOf(String(key))
      return index(left.key) - index(right.key)
    })

  const exportCurrent = () => {
    if (!canExport) { message.error('无计划导出权限'); return }
    exportSheet(tasks, Object.entries(COLUMN_LABELS).filter(([key]) => visibleKeys.has(key)).map(([key, title]) => ({ key, title })), `${tab?.label || '技术计划'}_${currentVersion?.versionNo || ''}_${exportTimestamp()}.xlsx`, '计划')
  }
  const importWorkbook = async (file: File) => {
    if (!canImport || !canMaintain) { message.error(!canImport ? '无计划导入权限' : '仅修订中版本可导入'); return false }
    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data)
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[workbook.SheetNames[0]])
      const imported = rows.map((row, index) => ({
        ...(tasks[index] || templateTasks[index] || {}), id: String(row.ID || row.id || tasks[index]?.id || `import-${index + 1}`), order: index + 1,
        taskName: String(row['任务名称'] || row.taskName || ''), responsible: String(row['责任人'] || row.responsible || ''),
        predecessor: String(row['前置任务'] || row.predecessor || ''), planStartDate: String(row['计划开始'] || row.planStartDate || ''), planEndDate: String(row['计划完成'] || row.planEndDate || ''),
      })) as TechnicalTemplateTask[]
      validateTechnicalTemplateDepth(tab?.templateKind || 'tdt', imported)
      const result = updateCurrentTasks(scope, imported, maxDepth)
      if (!result.ok) throw new Error('maxDepth')
      message.success('计划已导入')
    } catch { message.error('导入失败，请检查文件层级与字段') }
    return false
  }

  const compareRows = useMemo(() => {
    if (!instance || compareIds.length !== 2) return []
    const left = instance.versions.find(version => version.id === compareIds[0])
    const right = instance.versions.find(version => version.id === compareIds[1])
    return left && right ? compareVersionsForTable(left.tasks as any, right.tasks as any) : []
  }, [compareIds, instance])

  return (
    <div className="technical-project-space" aria-label="技术项目计划">
      <Card className="technical-space-card" aria-label={FIXED_TDT_LABEL} styles={{ body: { padding: '4px 16px 12px' } }}>
        <Row justify="space-between" align="middle" wrap={false}>
          <Tabs activeKey={tab?.key} onChange={setActiveKey} items={tabs.map(item => ({
            key: item.key,
            label: <Space size={5}><span>{item.label}</span>{item.subproject && !item.subproject.active && <Tag>已停用</Tag>}{item.subproject?.active && <Tooltip title="子项目信息配置"><Button type="text" size="small" aria-label={`配置子项目 ${item.subproject.name}`} icon={<SettingOutlined />} onClick={event => { event.preventDefault(); event.stopPropagation(); setConfigTrigger(event.currentTarget); setConfiguringChild(item.subproject!) }} /></Tooltip>}</Space>,
          }))} />
          <Space size={8}><Text type="secondary">显示已停用</Text><Switch checked={showInactive} onChange={setShowInactive} aria-label="显示已停用子项目计划" /></Space>
        </Row>
      </Card>

      {readOnlyReason && <Alert showIcon type={tab?.subproject?.active ? 'warning' : 'info'} message={readOnlyReason} style={{ marginTop: 12 }} />}
      {!readOnlyReason && !canEdit && <Alert showIcon type="info" message="当前账号无计划编辑权限，仅可查看计划" style={{ marginTop: 12 }} />}

      <Card className="technical-space-card technical-plan-toolbar pms-wide-table-toolbar" style={{ marginTop: 12 }} styles={{ body: { padding: 16 } }}>
        <Row justify="space-between" align="middle" gutter={[12, 12]}>
          <Space wrap>
            <Text type="secondary">版本</Text>
            <Select style={{ width: 140 }} value={currentVersion?.id} placeholder="暂无版本" onChange={value => setCurrentVersion(scope, value)} options={(instance?.versions || []).map(version => ({ value: version.id, label: `${version.versionNo}${version.status === '修订中' ? '（修订中）' : ''}` }))} />
            {isDraft && <Tag color="green">自动保存</Tag>}
            {!instance?.versions.some(version => version.status === '修订中') && <Tooltip title={!canEdit ? '无计划编辑权限' : readOnlyReason}><Button type="primary" icon={<PlusOutlined />} disabled={!canEdit || Boolean(readOnlyReason)} onClick={handleCreateRevision}>创建修订</Button></Tooltip>}
            {isDraft && <Tooltip title={!canPublish ? '无计划发布权限' : ''}><Button type="primary" icon={<SaveOutlined />} disabled={!canPublish || !canMaintain} onClick={handlePublish} aria-label="发布技术计划">发布</Button></Tooltip>}
            {isDraft && <Popconfirm title="确认取消当前修订？" onConfirm={() => { if (cancelRevision(scope).ok) message.success('已取消修订') }}><Button danger icon={<StopOutlined />} disabled={!canMaintain}>取消修订</Button></Popconfirm>}
            <Button icon={<PlusOutlined />} disabled={!canMaintain} onClick={handleAddTopLevelTask}>新增一级任务</Button>
          </Space>
          <Space wrap>
            <Radio.Group aria-label="计划视图" value={viewMode} onChange={event => setViewMode(event.target.value)} optionType="button" buttonStyle="solid" options={[
              { value: 'table', label: <Tooltip title="表格视图"><span aria-label="表格视图"><UnorderedListOutlined /></span></Tooltip> },
              { value: 'gantt', label: <Tooltip title="甘特视图"><span aria-label="甘特视图"><BarChartOutlined /></span></Tooltip> },
            ]} />
            <Tooltip title="版本对比"><Button aria-label="版本对比" icon={<HistoryOutlined />} disabled={(instance?.versions.length || 0) < 2} onClick={() => { setCompareIds((instance?.versions || []).slice(-2).map(version => version.id)); setCompareOpen(true) }} /></Tooltip>
            <SortableColumnSettings
              open={columnsOpen}
              trigger={<Tooltip title="列设置"><Button icon={<SettingOutlined />} disabled={!instance} onClick={() => setColumnsOpen(true)} aria-label="列设置" /></Tooltip>}
              definitions={TECHNICAL_COLUMN_DEFINITIONS}
              value={instance?.columnSettings || { order: Object.keys(COLUMN_LABELS), visible: Object.keys(COLUMN_LABELS) }}
              onApply={value => { setColumns(scope, value); setColumnsOpen(false); message.success('列设置已保存') }}
              onCancel={() => setColumnsOpen(false)}
            />
            <Upload accept=".xlsx,.xls" showUploadList={false} beforeUpload={importWorkbook} disabled={!canImport || !canMaintain}><Button icon={<UploadOutlined />} disabled={!canImport || !canMaintain}>导入</Button></Upload>
            <Button icon={<DownloadOutlined />} disabled={!canExport || !tasks.length} onClick={exportCurrent}>导出</Button>
          </Space>
        </Row>
      </Card>

      <Card className="technical-space-card" style={{ marginTop: 12 }} styles={{ body: { padding: 0 } }}>
        {!currentVersion ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无计划版本，请创建修订" /> : viewMode === 'gantt'
          ? <DHTMLXGantt tasks={tasks} readOnly={!canMaintain} collapsedIds={new Set(instance?.collapsedRows || [])} onCollapsedChange={updater => setCollapsed(scope, [...updater(new Set(instance?.collapsedRows || []))])} />
          : <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}><SortableContext items={tasks.map(task => task.id)} strategy={verticalListSortingStrategy}><Table<TechnicalTemplateTask> rowKey="id" size="middle" pagination={false} scroll={{ x: 1050 }} dataSource={tasks} columns={columns} components={canMaintain ? { body: { row: SortableRow } } : undefined} rowClassName={row => row.parentId ? 'technical-plan-child-row' : 'technical-plan-phase-row'} /></SortableContext></DndContext>}
      </Card>

      <Modal className="pms-scroll-modal" title="版本对比" open={compareOpen} onCancel={() => { setCompareOpen(false); setCompareIds([]) }} footer={null} width={920}>
        <Select mode="multiple" maxCount={2} value={compareIds} onChange={setCompareIds} style={{ width: '100%', marginBottom: 16 }} options={(instance?.versions || []).map(version => ({ value: version.id, label: version.versionNo }))} />
        <Table rowKey="id" size="small" pagination={false} dataSource={compareRows} columns={[{ title: '任务', dataIndex: 'taskName' }, { title: '变更', dataIndex: 'changeType', render: value => <Tag color={value === '新增' ? 'success' : value === '删除' ? 'error' : value === '修改' ? 'processing' : 'default'}>{value}</Tag> }]} />
      </Modal>
      <SubprojectConfigModal open={Boolean(configuringChild)} subproject={configuringChild} currentLoginUser={currentLoginUser} returnFocusTo={configTrigger} onCancel={() => setConfiguringChild(null)} />
    </div>
  )
}
