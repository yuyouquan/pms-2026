'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, Empty, Input, Radio, Space, Spin, Tag, message } from 'antd'
import { AppstoreOutlined, TableOutlined } from '@ant-design/icons'
import type { ProjectItem } from '@/types/app'
import type { TosTypeConfigRow, TosTypeVersionsState } from '@/lib/tosTypeRules'
import type { MrLevel1TaskLike, MrPlanVersionLike, MrPlanViewMode, MrTemplateVersion } from '@/types/mrVersionPlan'
import {
  getTosManagerUsers,
  selectCanonicalTosMrInstances,
} from '@/lib/mrPlanSourceAdapters'
import {
  compareTosVersionNumbers,
  resolveMrPermissions,
  resolveTosMrInstanceDateAccess,
  selectTosMrVersionCandidatesFromTasks,
  validateTosMrInstanceDates,
} from '@/lib/mrVersionPlanRules'
import { rehydrateMrVersionPlanStore, useMrVersionPlanStore } from '@/stores/mrVersionPlan'
import { usePlanStore } from '@/stores/plan'
import { selectActiveTosMrTasks } from '@/lib/tosMrLevel1Sync'
import MrPlanGrid, { getMrPlanCellKey, type MrPlanGridRow } from '@/components/plans/MrPlanGrid'

const NO_TEMPLATE_MESSAGE = '请先在配置中心发布三级计划-MR版本计划模板'

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
  const [versionQuery, setVersionQuery] = useState('')
  const templateVersions = useMrVersionPlanStore(state => state.templateVersions)
  const instances = useMrVersionPlanStore(state => (
    selectCanonicalTosMrInstances(state.tosInstancesByProjectId, project.id)
  ))
  const viewModeByScope = useMrVersionPlanStore(state => state.viewModeByScope)
  const sharedBusinessTasks = usePlanStore(state => state.level1BusinessTasksByScope)
  const tosTypePlanData = usePlanStore(state => state.tosTypePlanDataByProjectId)
  const updateTosDate = useMrVersionPlanStore(state => state.updateTosDate)
  const setViewMode = useMrVersionPlanStore(state => state.setViewMode)

  useEffect(() => {
    let active = true
    void hydrateProjectMrStoreOnce().then(() => {
      if (active) setHydrated(true)
    })
    return () => { active = false }
  }, [])

  const source = useMemo(() => selectActiveTosMrTasks({
    project,
    tosTypeRows,
    tosTypeVersionsByKey,
    publishedSnapshots,
    fallbackVersions,
    sharedBusinessTasks,
    tosTypePlanData,
  }), [fallbackVersions, project, publishedSnapshots, tosTypeRows, tosTypeVersionsByKey, sharedBusinessTasks, tosTypePlanData])
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
  const candidates = useMemo(() => source ? selectTosMrVersionCandidatesFromTasks(source) : [], [source])
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
  const mode: MrPlanViewMode = viewModeByScope[scopeKey] ?? 'horizontal'
  const instanceAccessByVersion = useMemo(() => new Map(sortedInstances.map(instance => [
    instance.tosVersion,
    resolveTosMrInstanceDateAccess(instance.tosVersion, candidates),
  ])), [candidates, sortedInstances])
  const cellErrors = useMemo(() => {
    const result: Record<string, string[]> = {}
    visibleInstances.forEach(instance => {
      const access = instanceAccessByVersion.get(instance.tosVersion)
      // Missing source dates apply to the entire version; explain them once in
      // the version column rather than marking every activity as a date error.
      const bounds = access?.canEdit ? access.bounds : candidates.find(candidate => compareTosVersionNumbers(candidate.value, instance.tosVersion) === 0)
      if (!bounds) return
      validateTosMrInstanceDates(instance, bounds).forEach(error => {
        const key = getMrPlanCellKey(error.rowKey, error.activityId)
        result[key] = [...(result[key] ?? []), error.message]
      })
    })
    return result
  }, [candidates, instanceAccessByVersion, visibleInstances])
  const rows: MrPlanGridRow[] = visibleInstances.map(instance => ({
    key: `${instance.projectId}::${instance.tosVersion}`,
    version: instance.tosVersion,
    versionWarning: (() => {
      const access = instanceAccessByVersion.get(instance.tosVersion)
      return access && !access.canEdit ? access.reason : undefined
    })(),
    activities: instance.activities,
    dates: instance.dates,
  }))

  const handleDateChange = (row: MrPlanGridRow, activityId: string, value: string) => {
    const access = instanceAccessByVersion.get(row.version)
    if (!access?.canEdit) {
      void messageApi.error(access?.reason ?? '当前tOS版本在一级计划中不存在，无法修改日期')
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
    <Card className="pms-mr-project-card" styles={{ body: { padding: 12 } }}>
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
          description={versionQuery.trim() ? '未找到匹配的tOS版本号' : noTemplate ? NO_TEMPLATE_MESSAGE : '请在一级计划的上市迭代阶段或维护阶段添加tOS版本节点'}
        />
      )}


    </Card>
  )
}
