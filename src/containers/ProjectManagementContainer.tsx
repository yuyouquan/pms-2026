'use client'

import { Card, Segmented, Tabs } from 'antd'
import { useEffect } from 'react'
import ProjectConfiguration from '@/components/project-management/ProjectConfiguration'
import ProjectListContainer from '@/containers/ProjectListContainer'
import { usePermissionStore } from '@/stores/permission'
import { useProjectStore } from '@/stores/project'
import { useUiStore, type ProjectManagementTab } from '@/stores/ui'

export default function ProjectManagementContainer() {
  const projectManagementTab = useUiStore(state => state.projectManagementTab)
  const setProjectManagementTab = useUiStore(state => state.setProjectManagementTab)
  const currentLoginUser = useProjectStore(state => state.currentLoginUser)
  const projectListView = useProjectStore(state => state.projectListView)
  const isAdmin = usePermissionStore(state => state.globalRoles.some(
    role => role.name === '管理组' && role.members.includes(currentLoginUser),
  ))
  const activeTab = isAdmin ? projectManagementTab : 'view'

  useEffect(() => {
    if (!isAdmin && projectManagementTab !== 'view') setProjectManagementTab('view')
  }, [isAdmin, projectManagementTab, setProjectManagementTab])

  return (
    <section className={`pms-project-management${activeTab === 'view' && projectListView === 'card' ? ' pms-project-management--cards' : ''}`} aria-label="项目管理">
      <Card className="pms-project-management__card pms-solid-surface" variant="borderless">
        <Tabs
          id="project-management-views"
          activeKey={activeTab}
          onChange={key => setProjectManagementTab(key as ProjectManagementTab)}
          renderTabBar={() => isAdmin ? (
            <div className="pms-project-management__view-mode">
              <Segmented<ProjectManagementTab>
                aria-label="项目管理视图"
                value={activeTab}
                onChange={setProjectManagementTab}
                options={[
                  { value: 'view', label: <span id="project-management-views-tab-view">项目视图</span> },
                  { value: 'configuration', label: <span id="project-management-views-tab-configuration">项目配置</span> },
                ]}
              />
            </div>
          ) : <></>}
          items={[
            { key: 'view', label: '项目视图', children: <ProjectListContainer /> },
            ...(isAdmin ? [{ key: 'configuration', label: '项目配置', children: <ProjectConfiguration /> }] : []),
          ]}
        />
      </Card>
    </section>
  )
}
