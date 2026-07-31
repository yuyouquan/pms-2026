'use client'

import { useState } from 'react'
import { Card, Tabs } from 'antd'
import { CheckSquareOutlined, ClockCircleOutlined } from '@ant-design/icons'
import { useUiStore, type WorkbenchTab } from '@/stores/ui'
import { useProjectStore } from '@/stores/project'
import { usePlanStore } from '@/stores/plan'
import { TodoList } from '@/components/workspace/WorkspaceModule'
import type { ProjectType, TodoType } from '@/components/workspace/WorkspaceModule'
import WorkTracker from '@/components/work-tracker/WorkTracker'
import { initialTodos } from '@/components/shared/PlanHelpers'
import { useActivateProject } from '@/hooks/useActivateProject'

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
    todoFilter,
    setSelectedMarketTab,
  } = useProjectStore()
  const {
    setProjectPlanLevel,
    setProjectPlanViewMode,
    setCurrentVersion,
    setActiveLevel2Plan,
    createdLevel2Plans,
    versions,
    currentVersion,
  } = usePlanStore()
  const [todos] = useState(initialTodos)
  const activateProject = useActivateProject()
  const isCurrentDraft = versions.find(version => version.id === currentVersion)?.status === '修订中'

  const todoContent = (
    <Card styles={{ body: { padding: 16 } }}>
      {/* Task 3 will replace this compatibility view with the aggregated TodoCenter. */}
      <TodoList
        todos={todos as TodoType[]}
        projects={projects as ProjectType[]}
        todoFilter={todoFilter}
        currentLoginUser={currentLoginUser}
        setSelectedProject={(project) => activateProject(project as typeof projects[number])}
        setActiveModule={(module) => {
          if (module === 'projectSpace') {
            enterProjectSpace({ module: 'workbench', workbenchTab: 'todo' })
          }
        }}
        setProjectSpaceModule={setProjectSpaceModule}
        setCurrentVersion={setCurrentVersion}
        setProjectPlanLevel={setProjectPlanLevel}
        setProjectPlanViewMode={setProjectPlanViewMode}
        setIsEditMode={setIsEditMode}
        setActiveLevel2Plan={setActiveLevel2Plan}
        setSelectedMarketTab={setSelectedMarketTab}
      />
    </Card>
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
