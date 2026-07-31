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
import { PROJECT_TYPE_TOS_VERSION } from '@/constants/projectTypes'
import { buildTosTypeRows, getMainTosType } from '@/lib/tosTypeRules'

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
    setSelectedProject,
    currentLoginUser,
    todoFilter,
    setSelectedMarketTab,
    setSelectedTosTypeTab,
    tosTypeConfigsByProjectId,
  } = useProjectStore()
  const {
    setProjectPlanLevel,
    setProjectPlanViewMode,
    setCurrentVersion,
    setActiveLevel2Plan,
    createdLevel2Plans,
  } = usePlanStore()
  const [todos] = useState(initialTodos)

  const activateProject = (project: typeof projects[number]) => {
    setSelectedProject(project)
    if (project.markets?.length) setSelectedMarketTab(project.markets[0])
    if (project.type === PROJECT_TYPE_TOS_VERSION) {
      const typeRows = buildTosTypeRows(
        project.versionTypes || [],
        project.versionType || '',
        tosTypeConfigsByProjectId[project.id],
      )
      setSelectedTosTypeTab(getMainTosType(typeRows) || typeRows[0]?.type || 'Full')
    }
  }

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
      onChange={(key) => navigateWithEditGuard(() => setWorkbenchTab(key as WorkbenchTab))}
      items={[
        { key: 'todo', label: <span><CheckSquareOutlined /> 待办中心</span>, children: todoContent },
        { key: 'workTracker', label: <span><ClockCircleOutlined /> 工作跟踪</span>, children: workTrackerContent },
      ]}
    />
  )
}
