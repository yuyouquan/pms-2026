'use client'

import { Card, Segmented, Tabs } from 'antd'
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
          id="project-management-views"
          activeKey={projectManagementTab}
          onChange={key => setProjectManagementTab(key as ProjectManagementTab)}
          renderTabBar={() => (
            <div className="pms-project-management__view-mode">
              <Segmented<ProjectManagementTab>
                aria-label="项目管理视图"
                value={projectManagementTab}
                onChange={setProjectManagementTab}
                options={[
                  { value: 'view', label: <span id="project-management-views-tab-view">项目视图</span> },
                  { value: 'configuration', label: <span id="project-management-views-tab-configuration">项目配置</span> },
                ]}
              />
            </div>
          )}
          items={[
            { key: 'view', label: '项目视图', children: <ProjectListContainer /> },
            { key: 'configuration', label: '项目配置', children: <ProjectConfiguration /> },
          ]}
        />
      </Card>
    </section>
  )
}
