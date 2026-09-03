'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button, Card, Empty, Input, Modal, Radio, Select, Space, Spin, Tag, Tooltip, message } from 'antd'
import { AppstoreOutlined, PlusOutlined, TableOutlined } from '@ant-design/icons'
import type { ProjectItem } from '@/types/app'
import type { TosTypeConfigRow, TosTypeVersionsState } from '@/lib/tosTypeRules'
import type { MrLevel1TaskLike, MrPlanVersionLike, MrPlanViewMode, MrTemplateVersion } from '@/types/mrVersionPlan'
import {
  getTosManagerUsers,
  selectCanonicalTosMrInstances,
  selectLatestPublishedTosLevel1,
} from '@/lib/mrPlanSourceAdapters'
import {
  compareTosVersionNumbers,
  resolveMrPermissions,
  resolveTosMrInstanceDateAccess,
  selectTosMrVersionCandidates,
  validateTosMrInstanceDates,
} from '@/lib/mrVersionPlanRules'
import { rehydrateMrVersionPlanStore, useMrVersionPlanStore } from '@/stores/mrVersionPlan'
import MrPlanGrid, { getMrPlanCellKey, type MrPlanGridRow } from '@/components/plans/MrPlanGrid'

const NO_TEMPLATE_MESSAGE = '请先在配置中心发布三级计划-MR版本计划模板'
const INCOMPLETE_LEVEL1_MESSAGE = '请先完善一级计划中的计划开始时间和计划完成时间'

let projectMrHydrationPromise: Promise<void> | null = null
let projectMrHydrated = false

function hydrateProjectMrStoreOnce(): Promise<void> {
  if (projectMrHydrated) return Promise.resolve()
  if (!projectMrHydrationPromise) {
    projectMrHydrationPromise = rehydrateMrVersionPlanStore().then(() => {
      projectMrHydrated = true
    })
  }
  return projectMrHydrationPromise
}

function selectLatestPublishedTemplate(versions: readonly MrTemplateVersion[]): MrTemplateVersion | null {
  return versions.reduce<{ version: MrTemplateVersion; number: number } | null>((latest, version) => {
    const match = version.status === '已发布' ? /^V([1-9]\d*)$/.exec(version.versionNo) : null
    const number = match ? Number(match[1]) : Number.NaN
    if (!Number.isSafeInteger(number)) return latest
    return !latest || number > latest.number ? { version, number } : latest
  }, null)?.version ?? null
}

export interface TosMrVersionPlanProps {
  project: ProjectItem
  currentUser: string
  globalAdminUsers: string[]
  tosTypeRows: TosTypeConfigRow[]
  tosTypeVersionsByKey: TosTypeVersionsState
  publishedSnapshots: Readonly<Record<string, readonly MrLevel1TaskLike[] | undefined>>
  fallbackVersions: MrPlanVersionLike[]
}

export default function TosMrVersionPlan({
  project,
  currentUser,
  globalAdminUsers,
  tosTypeRows,
  tosTypeVersionsByKey,
  publishedSnapshots,
  fallbackVersions,
}: TosMrVersionPlanProps) {
  const [messageApi, messageContextHolder] = message.useMessage()
  const [hydrated, setHydrated] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [selectedVersion, setSelectedVersion] = useState<string>()
  const [versionQuery, setVersionQuery] = useState('')
  const templateVersions = useMrVersionPlanStore(state => state.templateVersions)
  const instances = useMrVersionPlanStore(state => (
    selectCanonicalTosMrInstances(state.tosInstancesByProjectId, project.id)
  ))
  const viewModeByScope = useMrVersionPlanStore(state => state.viewModeByScope)
  const addTosVersionInstance = useMrVersionPlanStore(state => state.addTosVersionInstance)
  const updateTosDate = useMrVersionPlanStore(state => state.updateTosDate)
  const setViewMode = useMrVersionPlanStore(state => state.setViewMode)

  useEffect(() => {
    let active = true
    void hydrateProjectMrStoreOnce().then(() => {
      if (active) setHydrated(true)
    })
    return () => { active = false }
  }, [])

  const source = useMemo(() => selectLatestPublishedTosLevel1({
    project,
    tosTypeRows,
    tosTypeVersionsByKey,
    publishedSnapshots,
    fallbackVersions,
  }), [fallbackVersions, project, publishedSnapshots, tosTypeRows, tosTypeVersionsByKey])
  const sortedInstances = useMemo(
    () => [...instances].sort((left, right) => compareTosVersionNumbers(left.tosVersion, right.tosVersion)),
    [instances],
  )
  const visibleInstances = useMemo(() => {
    const query = versionQuery.trim().toLocaleLowerCase()
    return query
      ? sortedInstances.filter(instance => instance.tosVersion.toLocaleLowerCase().includes(query))
      : sortedInstances
  }, [sortedInstances, versionQuery])
  const candidates = useMemo(() => source ? selectTosMrVersionCandidates({
    versions: source.versions,
    getSnapshot: source.getSnapshot,
    usedVersions: sortedInstances.map(instance => instance.tosVersion),
  }) : [], [sortedInstances, source])
  const latestTemplate = useMemo(() => selectLatestPublishedTemplate(templateVersions), [templateVersions])
  const permission = useMemo(() => resolveMrPermissions({
    context: 'tos',
    currentUser,
    globalAdminUsers,
    tosManagerUsers: getTosManagerUsers(project),
    machineSpm: '',
    tosProjectId: project.id,
  }), [currentUser, globalAdminUsers, project])
  const scopeKey = `tos::${project.id}`
  const mode: MrPlanViewMode = viewModeByScope[scopeKey] ?? 'vertical'
  const instanceAccessByVersion = useMemo(() => new Map(sortedInstances.map(instance => [
    instance.tosVersion,
    resolveTosMrInstanceDateAccess(instance.tosVersion, candidates),
  ])), [candidates, sortedInstances])
  const cellErrors = useMemo(() => {
    const result: Record<string, string[]> = {}
    visibleInstances.forEach(instance => {
      const access = instanceAccessByVersion.get(instance.tosVersion)
      if (!access?.canEdit) {
        instance.activities
          .filter(activity => activity.parentId !== null)
          .forEach(activity => {
            result[getMrPlanCellKey(`${instance.projectId}::${instance.tosVersion}`, activity.id)] = [
              access?.reason ?? '当前tOS版本在最新发布的一级计划中不存在，无法修改日期',
            ]
          })
        return
      }
      validateTosMrInstanceDates(instance, access.bounds).forEach(error => {
        const key = getMrPlanCellKey(error.rowKey, error.activityId)
        result[key] = [...(result[key] ?? []), error.message]
      })
    })
    return result
  }, [instanceAccessByVersion, visibleInstances])
  const rows: MrPlanGridRow[] = visibleInstances.map(instance => ({
    key: `${instance.projectId}::${instance.tosVersion}`,
    version: instance.tosVersion,
    activities: instance.activities,
    dates: instance.dates,
  }))

  const handleAdd = () => {
    if (!selectedVersion || !latestTemplate) return
    const added = addTosVersionInstance({
      projectId: project.id,
      tosVersion: selectedVersion,
      actor: currentUser,
      now: new Date().toISOString(),
    }, permission)
    if (!added) {
      void messageApi.error('tOS版本号添加失败，请检查权限或版本是否已存在')
      return
    }
    setAddOpen(false)
    setSelectedVersion(undefined)
    void messageApi.success('tOS版本号添加成功')
  }

  const handleDateChange = (row: MrPlanGridRow, activityId: string, value: string) => {
    const access = instanceAccessByVersion.get(row.version)
    if (!access?.canEdit) {
      void messageApi.error(access?.reason ?? '当前tOS版本在最新发布的一级计划中不存在，无法修改日期')
      return
    }
    const updated = updateTosDate(project.id, row.version, activityId, value, currentUser, permission)
    if (!updated) {
      void messageApi.error('日期更新失败，请检查权限或日期格式')
      return
    }
    void messageApi.success('日期已更新')
  }

  if (!hydrated) {
    return (
      <Card className="pms-mr-project-card" aria-busy="true">
        <div className="pms-mr-project-loading"><Spin size="small" /><span>MR版本计划加载中</span></div>
      </Card>
    )
  }

  const noTemplate = !latestTemplate
  return (
    <Card className="pms-mr-project-card" styles={{ body: { padding: 16 } }}>
      {messageContextHolder}
      <div className="pms-mr-project-toolbar">
        <Space size={8}>
          <Input.Search
            allowClear
            aria-label="搜索tOS版本号"
            placeholder="搜索tOS版本号"
            value={versionQuery}
            onChange={event => setVersionQuery(event.target.value)}
            style={{ width: 240 }}
          />
          {permission.canEditTos && (
            <Tooltip title={noTemplate ? NO_TEMPLATE_MESSAGE : undefined}>
              <span>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  disabled={noTemplate}
                  onClick={() => setAddOpen(true)}
                  aria-label="新增tOS版本号"
                >
                  新增tOS版本号
                </Button>
              </span>
            </Tooltip>
          )}
          {!permission.canEditTos && <Tag>只读</Tag>}
        </Space>
        <Radio.Group
          value={mode}
          onChange={event => setViewMode(scopeKey, event.target.value as MrPlanViewMode)}
          optionType="button"
          buttonStyle="solid"
          size="small"
        >
          <Radio.Button value="vertical" aria-label="竖版视图"><TableOutlined /> 竖版</Radio.Button>
          <Radio.Button value="horizontal" aria-label="横版视图"><AppstoreOutlined /> 横版</Radio.Button>
        </Radio.Group>
      </div>

      {rows.length ? (
        <MrPlanGrid
          mode={mode}
          logicalRows={rows}
          editableCell={(row, activity) => permission.canEditTos
            && activity.parentId !== null
            && instanceAccessByVersion.get(row.version)?.canEdit === true}
          cellErrors={cellErrors}
          onDateChange={(row, activity, value) => handleDateChange(row, activity.id, value)}
        />
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={versionQuery.trim() ? '未找到匹配的tOS版本号' : '暂无MR版本计划'}
        />
      )}

      <Modal
        title="新增tOS版本号"
        open={addOpen}
        okText="确认新增"
        cancelText="取消"
        okButtonProps={{ disabled: !selectedVersion }}
        onOk={handleAdd}
        onCancel={() => { setAddOpen(false); setSelectedVersion(undefined) }}
        destroyOnHidden
      >
        <Select
          aria-label="选择tOS版本号"
          placeholder="请选择一级计划中的tOS版本号"
          value={selectedVersion}
          onChange={setSelectedVersion}
          style={{ width: '100%' }}
          options={candidates.map(candidate => ({
            value: candidate.value,
            disabled: candidate.disabled,
            title: candidate.reason,
            label: (
              <Space size={8}>
                <span>{candidate.label}</span>
                {candidate.reason && <span className="pms-mr-candidate-reason">{candidate.reason}</span>}
              </Space>
            ),
          }))}
          notFoundContent={source ? '暂无可选tOS版本号' : INCOMPLETE_LEVEL1_MESSAGE}
        />
      </Modal>
    </Card>
  )
}
