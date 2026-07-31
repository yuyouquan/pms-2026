'use client'

import { useMemo } from 'react'
import { message, Tabs } from 'antd'
import dayjs from 'dayjs'
import { CheckSquareOutlined, ClockCircleOutlined } from '@ant-design/icons'
import { useUiStore, type WorkbenchTab } from '@/stores/ui'
import { useProjectStore } from '@/stores/project'
import { usePlanStore } from '@/stores/plan'
import TodoCenter from '@/components/workspace/TodoCenter'
import WorkTracker from '@/components/work-tracker/WorkTracker'
import { useActivateProject } from '@/hooks/useActivateProject'
import { useTransferStore } from '@/stores/transfer'
import { hasPermission } from '@/stores/permission'
import type { TransferApplication } from '@/mock/transfer-maintenance'
import {
  aggregateWorkbenchTodos,
  mapTransferOwnerToPmsUser,
  resolvePlanTodoNavigation,
  type PlanTodoCandidate,
  type TransferTodoCandidate,
  type WorkbenchTodo,
} from '@/lib/todoAggregation'
import {
  getMarketCurrentVersion,
  getMarketPlanVersionKey,
  getMarketVersions,
  setMarketCurrentVersion,
} from '@/lib/marketRules'

type WorkbenchProject = ReturnType<typeof useProjectStore.getState>['projects'][number]

function resolvePlanStatus(task: Record<string, any>): PlanTodoCandidate['status'] {
  if (task.status === '已完成' || Number(task.progress) >= 100) return 'completed'
  if (task.status === '进行中' || Number(task.progress) > 0) return 'in_progress'
  return 'pending'
}

function adaptPlanTasks(
  projects: WorkbenchProject[],
  marketPlanData: ReturnType<typeof usePlanStore.getState>['marketPlanData'],
  level2PlanTasks: ReturnType<typeof usePlanStore.getState>['level2PlanTasks'],
  level2PlanMeta: ReturnType<typeof usePlanStore.getState>['level2PlanMeta'],
  versions: ReturnType<typeof usePlanStore.getState>['versions'],
  currentVersion: string,
  marketVersionsByKey: ReturnType<typeof usePlanStore.getState>['marketVersionsByKey'],
  marketCurrentVersionByKey: ReturnType<typeof usePlanStore.getState>['marketCurrentVersionByKey'],
): PlanTodoCandidate[] {
  const configuredProjectName = Object.values(level2PlanMeta)
    .find(meta => typeof meta?.projectName === 'string')?.projectName
  const project = projects.find(item => item.name === configuredProjectName)
    ?? projects.find(item => Array.isArray(item.markets) && item.markets.length > 0)
  if (!project) return []

  const level1Candidates = Object.entries(marketPlanData).flatMap(([market, data]) => (
    data.tasks.map(task => {
      const marketKey = getMarketPlanVersionKey(project.id, market)
      const marketVersions = getMarketVersions(marketVersionsByKey, project.id, market, versions)
      const versionId = getMarketCurrentVersion(
        marketCurrentVersionByKey,
        project.id,
        market,
        marketVersions,
        currentVersion,
      )
      return {
      id: `plan:${project.id}:${market}:level1:${task.id}`,
      projectId: project.id,
      projectName: project.name,
      assignee: task.responsible || '',
      dueDate: task.planEndDate || '',
      completed: resolvePlanStatus(task) === 'completed',
      completedAt: task.actualEndDate || undefined,
      status: resolvePlanStatus(task),
      title: `${market} · ${task.taskName || '未命名计划任务'}`,
      planLevel: 'level1' as const,
      planKey: 'level1',
      versionId,
      market,
      marketKey,
      }
    })
  ))

  const level2Candidates = level2PlanTasks.map(task => ({
    id: `plan:${project.id}:level2:${task.planId || 'plan0'}:${task.id}`,
    projectId: project.id,
    projectName: project.name,
    assignee: task.responsible || '',
    dueDate: task.planEndDate || '',
    completed: resolvePlanStatus(task) === 'completed',
    completedAt: task.actualEndDate || undefined,
    status: resolvePlanStatus(task),
    title: task.taskName || '未命名计划任务',
    planLevel: 'level2' as const,
    planKey: task.planId || 'plan0',
    versionId: currentVersion,
    market: project.markets?.[0],
  }))

  return [...level1Candidates, ...level2Candidates]
}

function getTransferView(application: TransferApplication): TransferTodoCandidate['view'] | null {
  if (application.status !== 'in_progress') return null
  if (['in_progress', 'failed'].includes(application.pipeline.sqaReview)) return 'sqa-review'
  if (['in_progress', 'failed'].includes(application.pipeline.maintenanceReview)) return 'review'
  if (['in_progress', 'failed'].includes(application.pipeline.dataEntry)) return 'entry'
  return null
}

function getTransferOwnerExternalIdentity(
  application: TransferApplication,
  view: NonNullable<ReturnType<typeof getTransferView>>,
): { id: string; name: string } | undefined {
  if (view === 'entry') return { id: application.applicantId, name: application.applicant }
  if (view === 'review') {
    return application.team.maintenance.find(member => member.role === 'SPM')
  }
  return application.team.research.find(member => member.role === 'SQA')
}

function adaptTransferApplications(
  applications: TransferApplication[],
  projects: WorkbenchProject[],
): TransferTodoCandidate[] {
  return applications.flatMap(application => {
    const view = getTransferView(application)
    if (!view) return []
    const linkedProject = projects.find(project => (
      project.id === application.projectId || project.name === application.projectName
    ))
    if (!linkedProject) return []
    const externalOwner = getTransferOwnerExternalIdentity(application, view)
    const activeOwner = mapTransferOwnerToPmsUser(externalOwner?.id, externalOwner?.name)
    if (!activeOwner) return []
    const nodeTitle = view === 'entry' ? '转维资料录入' : view === 'review' ? '转维维护审核' : '转维 SQA 审核'
    return [{
      applicationId: application.id,
      projectId: linkedProject?.id || application.projectId,
      projectName: linkedProject?.name || application.projectName,
      activeOwner,
      dueDate: application.plannedReviewDate,
      completed: false,
      title: nodeTitle,
      view,
    }]
  })
}

export default function WorkbenchContainer() {
  const {
    workbenchTab,
    setWorkbenchTab,
    enterProjectSpace,
    setProjectSpaceModule,
    navigateWithEditGuard,
    setIsEditMode,
  } = useUiStore()
  const {
    projects,
    currentLoginUser,
  } = useProjectStore()
  const {
    setProjectPlanLevel,
    setProjectPlanViewMode,
    setCurrentVersion,
    setActiveLevel2Plan,
    createdLevel2Plans,
    versions,
    currentVersion,
    level2PlanTasks,
    level2PlanMeta,
    marketPlanData,
    marketVersionsByKey,
    marketCurrentVersionByKey,
    setMarketCurrentVersionByKey,
  } = usePlanStore()
  const {
    transferApplications,
    setSelectedTransferAppId,
    setTransferView,
  } = useTransferStore()
  const activateProject = useActivateProject()
  const isCurrentDraft = versions.find(version => version.id === currentVersion)?.status === '修订中'
  const today = dayjs().format('YYYY-MM-DD')

  const planTodoCandidates = useMemo(
    () => adaptPlanTasks(
      projects,
      marketPlanData,
      level2PlanTasks,
      level2PlanMeta,
      versions,
      currentVersion,
      marketVersionsByKey,
      marketCurrentVersionByKey,
    ),
    [
      currentVersion,
      level2PlanMeta,
      level2PlanTasks,
      marketCurrentVersionByKey,
      marketPlanData,
      marketVersionsByKey,
      projects,
      versions,
    ],
  )
  const transferTodoCandidates = useMemo(
    () => adaptTransferApplications(transferApplications, projects),
    [projects, transferApplications],
  )
  const todos = useMemo(() => aggregateWorkbenchTodos({
    currentUser: currentLoginUser,
    today,
    planTodos: planTodoCandidates,
    transferApplications: transferTodoCandidates,
  }), [currentLoginUser, planTodoCandidates, today, transferTodoCandidates])

  const openTodo = (todo: WorkbenchTodo) => {
    const route = todo.route
    const project = projects.find(item => item.id === todo.projectId || item.name === todo.projectName)
    if (!project) {
      void message.warning('该待办暂无可打开的项目，请先补齐项目关联')
      return
    }

    const planNavigation = route.kind === 'plan'
      ? resolvePlanTodoNavigation({
        projectId: project.id,
        projectMarkets: project.markets || [],
        todoMarket: todo.market,
        route,
        baseVersions: versions,
        marketVersionsByKey,
        marketCurrentVersionByKey,
        baseCurrentVersion: currentVersion,
      })
      : null
    if (route.kind === 'plan' && !planNavigation) {
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
        market: planNavigation?.usesMarketVersion ? planNavigation.market : undefined,
      })
      setIsEditMode(false)

      if (route.kind === 'plan' && planNavigation) {
        const selectedVersion = planNavigation.versionId
        if (selectedVersion !== route.versionId) {
          void message.info('原待办版本已不可用，已安全回退到当前版本')
        }
        setProjectSpaceModule('plan')
        setProjectPlanLevel(route.planLevel)
        setProjectPlanViewMode('table')
        if (planNavigation.usesMarketVersion) {
          setMarketCurrentVersionByKey(previous => setMarketCurrentVersion(
            previous,
            project.id,
            planNavigation.market,
            selectedVersion,
          ))
        } else {
          setCurrentVersion(selectedVersion)
        }
        if (route.planLevel === 'level2') {
          const targetPlan = createdLevel2Plans.find(plan => plan.id === route.planKey)
          const fallbackPlan = createdLevel2Plans[0]
          if (targetPlan) setActiveLevel2Plan(targetPlan.id)
          else if (fallbackPlan) {
            setActiveLevel2Plan(fallbackPlan.id)
            void message.info('原二级计划已不可用，已回退到首个可用计划')
          }
        }
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
