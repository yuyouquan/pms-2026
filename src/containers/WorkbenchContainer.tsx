'use client'

import { useMemo } from 'react'
import { message, Tabs } from 'antd'
import { CheckSquareOutlined, ClockCircleOutlined } from '@ant-design/icons'
import { useUiStore, type WorkbenchTab } from '@/stores/ui'
import { useProjectStore } from '@/stores/project'
import { usePlanStore } from '@/stores/plan'
import TodoCenter from '@/components/workspace/TodoCenter'
import WorkTracker from '@/components/work-tracker/WorkTracker'
import { useActivateProject } from '@/hooks/useActivateProject'
import { useLocalToday } from '@/hooks/useLocalToday'
import { useTransferStore } from '@/stores/transfer'
import { hasPermission, usePermissionStore } from '@/stores/permission'
import {
  aggregateWorkbenchTodos,
  buildPlanTodoCandidates,
  buildTransferTodoCandidates,
  filterTodoCandidatesByAccess,
  type PlanTodoSource,
  type WorkbenchTodo,
} from '@/lib/todoAggregation'
import {
  getMarketCurrentVersion,
  getMarketPlanVersionKey,
  getMarketVersions,
} from '@/lib/marketRules'
import {
  getTosTypeCurrentVersion,
  getTosTypeVersionKey,
  getTosTypeVersions,
} from '@/lib/tosTypeRules'
import { isMachineProjectType, PROJECT_TYPE_TOS_VERSION } from '@/constants/projectTypes'

type WorkbenchProject = ReturnType<typeof useProjectStore.getState>['projects'][number]

function adaptPlanTasks(
  projects: WorkbenchProject[],
  marketConfigsByProjectId: ReturnType<typeof useProjectStore.getState>['marketConfigsByProjectId'],
  tosTypeConfigsByProjectId: ReturnType<typeof useProjectStore.getState>['tosTypeConfigsByProjectId'],
  tasks: ReturnType<typeof usePlanStore.getState>['tasks'],
  marketPlanData: ReturnType<typeof usePlanStore.getState>['marketPlanData'],
  level2PlanTasks: ReturnType<typeof usePlanStore.getState>['level2PlanTasks'],
  level2PlanMeta: ReturnType<typeof usePlanStore.getState>['level2PlanMeta'],
  tosTypePlanDataByProjectId: ReturnType<typeof usePlanStore.getState>['tosTypePlanDataByProjectId'],
  versions: ReturnType<typeof usePlanStore.getState>['versions'],
  currentVersion: string,
  marketVersionsByKey: ReturnType<typeof usePlanStore.getState>['marketVersionsByKey'],
  marketCurrentVersionByKey: ReturnType<typeof usePlanStore.getState>['marketCurrentVersionByKey'],
  tosTypeVersionsByKey: ReturnType<typeof usePlanStore.getState>['tosTypeVersionsByKey'],
  tosTypeCurrentVersionByKey: ReturnType<typeof usePlanStore.getState>['tosTypeCurrentVersionByKey'],
) {
  const sources: PlanTodoSource[] = []
  const indexedProjects = projects.map(project => ({
    ...project,
    markets: marketConfigsByProjectId[project.id]?.map(row => row.market) || project.markets,
    versionTypes: tosTypeConfigsByProjectId[project.id]?.map(row => row.type) || project.versionTypes,
  }))
  const projectById = new Map(indexedProjects.map(project => [project.id, project]))
  const resolveProjectId = (reference: Record<string, any> | undefined): string | undefined => {
    if (!reference) return undefined
    if (reference.projectId && projectById.has(reference.projectId)) return reference.projectId
    if (!reference.projectName) return undefined
    const matches = indexedProjects.filter(project => project.name === reference.projectName)
    return matches.length === 1 ? matches[0].id : undefined
  }

  const metadataProjectIds = new Set(
    Object.values(level2PlanMeta).map(meta => resolveProjectId(meta)).filter(Boolean) as string[],
  )
  const legacyOwnerId = metadataProjectIds.size === 1 ? [...metadataProjectIds][0] : undefined
  const legacyOwner = legacyOwnerId ? projectById.get(legacyOwnerId) : undefined

  const explicitGenericTasks = new Map<string, any[]>()
  const legacyGenericTasks: any[] = []
  tasks.forEach(task => {
    const projectId = resolveProjectId(task)
    if (projectId) explicitGenericTasks.set(projectId, [...(explicitGenericTasks.get(projectId) || []), task])
    else legacyGenericTasks.push(task)
  })
  explicitGenericTasks.forEach((projectTasks, projectId) => {
    const project = projectById.get(projectId)
    if (!project || isMachineProjectType(project.type) || project.type === PROJECT_TYPE_TOS_VERSION) return
    sources.push({ projectId, planLevel: 'level1', planKey: 'level1', planName: '一级计划', tasks: projectTasks, versions, currentVersionId: currentVersion })
  })
  if (legacyOwner && !isMachineProjectType(legacyOwner.type) && legacyOwner.type !== PROJECT_TYPE_TOS_VERSION && legacyGenericTasks.length) {
    sources.push({ projectId: legacyOwner.id, planLevel: 'level1', planKey: 'level1', planName: '一级计划', tasks: legacyGenericTasks, versions, currentVersionId: currentVersion })
  }

  if (legacyOwner && isMachineProjectType(legacyOwner.type)) {
    const configuredMarkets = (legacyOwner.markets || []) as readonly string[]
    Object.entries(marketPlanData).forEach(([market, data]) => {
      if (!configuredMarkets.includes(market)) return
      const scopedVersions = getMarketVersions(marketVersionsByKey, legacyOwner.id, market, versions)
      sources.push({
        projectId: legacyOwner.id,
        planLevel: 'level1',
        planKey: 'level1',
        planName: '一级计划',
        dimension: { kind: 'market', value: market, versionKey: getMarketPlanVersionKey(legacyOwner.id, market) },
        tasks: data.tasks,
        versions: scopedVersions,
        currentVersionId: getMarketCurrentVersion(marketCurrentVersionByKey, legacyOwner.id, market, scopedVersions, currentVersion),
      })
    })
  }

  const level2Groups = new Map<string, { projectId: string; planKey: string; planName: string; tasks: any[] }>()
  level2PlanTasks.forEach(task => {
    const planKey = task.planId || 'plan0'
    const meta = level2PlanMeta[planKey]
    const projectId = resolveProjectId(task) || resolveProjectId(meta)
    if (!projectId) return
    const key = `${projectId}::${planKey}`
    const group = level2Groups.get(key) || { projectId, planKey, planName: meta?.planName || planKey, tasks: [] as any[] }
    group.tasks.push(task)
    level2Groups.set(key, group)
  })
  level2Groups.forEach(group => sources.push({ ...group, planLevel: 'level2', versions, currentVersionId: currentVersion }))

  Object.entries(tosTypePlanDataByProjectId).forEach(([projectId, dataByType]) => {
    const project = projectById.get(projectId)
    if (!project || project.type !== PROJECT_TYPE_TOS_VERSION) return
    Object.entries(dataByType).forEach(([tosType, data]) => {
      const level1Versions = getTosTypeVersions(tosTypeVersionsByKey, projectId, tosType, 'level1', versions)
      sources.push({
        projectId,
        planLevel: 'level1',
        planKey: 'level1',
        planName: '一级计划',
        dimension: { kind: 'tos', value: tosType, versionKey: getTosTypeVersionKey(projectId, tosType, 'level1') },
        tasks: data.level1Tasks,
        versions: level1Versions,
        currentVersionId: getTosTypeCurrentVersion(tosTypeCurrentVersionByKey, projectId, tosType, 'level1', level1Versions, currentVersion),
      })
      const tasksByPlan = new Map<string, any[]>()
      data.level2PlanTasks.forEach(task => {
        const planKey = task.planId || data.activeLevel2Plan || 'plan0'
        tasksByPlan.set(planKey, [...(tasksByPlan.get(planKey) || []), task])
      })
      tasksByPlan.forEach((planTasks, planKey) => {
        const scopedVersions = getTosTypeVersions(tosTypeVersionsByKey, projectId, tosType, 'level2', versions)
        sources.push({
          projectId,
          planLevel: 'level2',
          planKey,
          planName: data.level2PlanMeta[planKey]?.planName || data.createdLevel2Plans.find(plan => plan.id === planKey)?.name || planKey,
          dimension: { kind: 'tos', value: tosType, versionKey: getTosTypeVersionKey(projectId, tosType, 'level2') },
          tasks: planTasks,
          versions: scopedVersions,
          currentVersionId: getTosTypeCurrentVersion(tosTypeCurrentVersionByKey, projectId, tosType, 'level2', scopedVersions, currentVersion),
        })
      })
    })
  })

  return buildPlanTodoCandidates({ projects: indexedProjects, sources })
}

export default function WorkbenchContainer() {
  const {
    workbenchTab,
    setWorkbenchTab,
    enterProjectSpace,
    setProjectSpaceModule,
    navigateWithEditGuard,
    setIsEditMode,
    setPlanNavigationIntent,
  } = useUiStore()
  const {
    projects,
    currentLoginUser,
    marketConfigsByProjectId,
    tosTypeConfigsByProjectId,
  } = useProjectStore()
  const {
    setProjectPlanLevel,
    setProjectPlanViewMode,
    setActiveLevel2Plan,
    createdLevel2Plans,
    versions,
    currentVersion,
    tasks,
    level2PlanTasks,
    level2PlanMeta,
    marketPlanData,
    marketVersionsByKey,
    marketCurrentVersionByKey,
    tosTypePlanDataByProjectId,
    tosTypeVersionsByKey,
    tosTypeCurrentVersionByKey,
  } = usePlanStore()
  const {
    transferApplications,
    setSelectedTransferAppId,
    setTransferView,
  } = useTransferStore()
  const globalRoles = usePermissionStore(state => state.globalRoles)
  const globalRolePerms = usePermissionStore(state => state.globalRolePerms)
  const rolesByProject = usePermissionStore(state => state.rolesByProject)
  const rolePermissionsByProject = usePermissionStore(state => state.rolePermissionsByProject)
  const activateProject = useActivateProject()
  const isCurrentDraft = versions.find(version => version.id === currentVersion)?.status === '修订中'
  const today = useLocalToday()

  const planTodoCandidates = useMemo(
    () => adaptPlanTasks(
      projects,
      marketConfigsByProjectId,
      tosTypeConfigsByProjectId,
      tasks,
      marketPlanData,
      level2PlanTasks,
      level2PlanMeta,
      tosTypePlanDataByProjectId,
      versions,
      currentVersion,
      marketVersionsByKey,
      marketCurrentVersionByKey,
      tosTypeVersionsByKey,
      tosTypeCurrentVersionByKey,
    ),
    [
      currentVersion,
      level2PlanMeta,
      level2PlanTasks,
      marketCurrentVersionByKey,
      marketConfigsByProjectId,
      marketPlanData,
      marketVersionsByKey,
      projects,
      tasks,
      tosTypeCurrentVersionByKey,
      tosTypeConfigsByProjectId,
      tosTypePlanDataByProjectId,
      tosTypeVersionsByKey,
      versions,
    ],
  )
  const transferTodoCandidates = useMemo(
    () => buildTransferTodoCandidates({ applications: transferApplications, projects }),
    [projects, transferApplications],
  )
  const accessibleCandidates = useMemo(() => filterTodoCandidatesByAccess({
    currentUser: currentLoginUser,
    planTodos: planTodoCandidates,
    transferApplications: transferTodoCandidates,
    canViewPlan: (projectId, planLevel) => hasPermission(
      currentLoginUser,
      projectId,
      planLevel === 'level2' ? 'plan:二级计划-查看' : 'plan:一级计划-查看',
    ),
    canViewTransfer: projectId => hasPermission(currentLoginUser, projectId, 'basicInfo:transferView'),
  }), [
    currentLoginUser,
    globalRolePerms,
    globalRoles,
    planTodoCandidates,
    rolePermissionsByProject,
    rolesByProject,
    transferTodoCandidates,
  ])
  const todos = useMemo(() => aggregateWorkbenchTodos({
    currentUser: currentLoginUser,
    today,
    planTodos: accessibleCandidates.planTodos,
    transferApplications: accessibleCandidates.transferApplications,
  }), [accessibleCandidates, currentLoginUser, today])

  const openTodo = (todo: WorkbenchTodo) => {
    const route = todo.route
    const project = projects.find(item => item.id === todo.projectId || item.name === todo.projectName)
    if (!project) {
      void message.warning('该待办暂无可打开的项目，请先补齐项目关联')
      return
    }

    const projectMarkets = (project.markets || []) as readonly string[]
    const invalidMarketRoute = route.kind === 'plan' && route.marketKey && (
      !todo.market
      || !projectMarkets.includes(todo.market)
      || route.marketKey !== getMarketPlanVersionKey(project.id, todo.market)
    )
    const invalidTosRoute = route.kind === 'plan' && route.tosTypeKey && (
      !route.tosType
      || ![...(project.versionTypes || []), project.versionType || ''].includes(route.tosType)
      || route.tosTypeKey !== getTosTypeVersionKey(project.id, route.tosType, route.planLevel)
    )
    if (invalidMarketRoute || invalidTosRoute) {
      void message.warning('该待办的市场路由与当前项目不匹配，已停止跳转')
      return
    }

    const permissionKey = route.kind === 'transfer'
      ? 'basicInfo:transferView'
      : route.planLevel === 'level2' ? 'plan:二级计划-查看' : 'plan:一级计划-查看'
    if (!hasPermission(currentLoginUser, project.id, permissionKey)) {
      void message.warning('当前用户无权访问该待办所在的项目内容')
      return
    }

    navigateWithEditGuard(() => {
      activateProject(project, {
        market: todo.market,
        tosType: route.kind === 'plan' ? route.tosType : undefined,
      })
      setIsEditMode(false)

      if (route.kind === 'plan') {
        setPlanNavigationIntent({
          source: 'todo',
          projectId: project.id,
          currentUser: currentLoginUser,
          planLevel: route.planLevel,
          planKey: route.planKey,
          versionId: route.versionId,
          market: todo.market,
          marketKey: route.marketKey,
          tosType: route.tosType,
          tosTypeKey: route.tosTypeKey,
        })
        setProjectSpaceModule('plan')
        setProjectPlanLevel(route.planLevel)
        setProjectPlanViewMode('table')
      } else if (route.kind === 'transfer') {
        setProjectSpaceModule('basic')
        setSelectedTransferAppId(route.applicationId)
        setTransferView(route.view)
      }
      enterProjectSpace({ module: 'workbench', workbenchTab: 'todo' })
    }, isCurrentDraft)
  }

  const todoContent = (
    <TodoCenter todos={todos} today={today} onOpenTodo={openTodo} />
  )

  const workTrackerContent = (
    <WorkTracker
      currentLoginUser={currentLoginUser}
      projects={projects}
      onNavigateToProject={(projectId, module, planLevel, planType) => {
        const project = projects.find(item => item.id === projectId)
        if (!project) return
        activateProject(project)
        setProjectSpaceModule(module)
        if (module === 'plan' && planLevel) {
          if (planLevel === 'level2') setProjectPlanViewMode('table')
          setProjectPlanLevel(planLevel)
          if (planLevel === 'level2' && planType) {
            const plan = createdLevel2Plans.find(item => item.name === planType)
            if (plan) setActiveLevel2Plan(plan.id)
          }
        }
        enterProjectSpace({ module: 'workbench', workbenchTab: 'workTracker' })
      }}
    />
  )

  return (
    <Tabs
      activeKey={workbenchTab}
      onChange={(key) => navigateWithEditGuard(
        () => setWorkbenchTab(key as WorkbenchTab),
        isCurrentDraft,
      )}
      items={[
        { key: 'todo', label: <span><CheckSquareOutlined /> 待办中心</span>, children: todoContent },
        { key: 'workTracker', label: <span><ClockCircleOutlined /> 工作跟踪</span>, children: workTrackerContent },
      ]}
    />
  )
}
