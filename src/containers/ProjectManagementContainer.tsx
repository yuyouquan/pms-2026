'use client'

import { Card, Tabs } from 'antd'
import ProjectConfiguration from '@/components/project-management/ProjectConfiguration'
import ProjectListContainer from '@/containers/ProjectListContainer'
import { useUiStore, type ProjectManagementTab } from '@/stores/ui'

export default function ProjectManagementContainer() {
  const projectManagementTab = useUiStore(state => state.projectManagementTab)
  const setProjectManagementTab = useUiStore(state => state.setProjectManagementTab)

  return (
    <section className="pms-project-management" aria-label="项目管理">
      <Card className="pms-project-management__card pms-solid-surface" variant="borderless">
        <Tabs
          activeKey={projectManagementTab}
          onChange={key => setProjectManagementTab(key as ProjectManagementTab)}
          items={[
            { key: 'configuration', label: '项目配置', children: <ProjectConfiguration /> },
            { key: 'view', label: '项目视图', children: <ProjectListContainer /> },
          ]}
        />
      </Card>
    </section>
  )
}
