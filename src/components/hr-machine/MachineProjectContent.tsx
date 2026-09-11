'use client'

import { useHrResourceScope } from '@/components/project-resources/HrResourceScope'
import { Segmented } from 'antd'
import { useHrMachineStore } from '@/hooks/useHrResourceStores'
import ProjectListTab from './ProjectListTab'
import HistoryVersionSpace from './HistoryVersionSpace'
import MonthlyInvestmentTab from './MonthlyInvestmentTab'
import NewProjectModal from './NewProjectModal'
import NewVersionModal from './NewVersionModal'
import MonthlyEditModal from './MonthlyEditModal'
import MachineVersionDetailModal from './MachineVersionDetailModal'

export default function MachineProjectContent() {
  const scopeId = useHrResourceScope()
  const {
    activeTab,
    setActiveTab,
    selectedProjectId,
    setSelectedProjectId,
    showNewProjectModal,
    setShowNewProjectModal,
    showNewVersionModal,
    setShowNewVersionModal,
    showMonthlyEditModal,
    setShowMonthlyEditModal,
    editingMonthlyId,
    setEditingMonthlyId,
    showVersionDetailModal,
    setShowVersionDetailModal,
    editingVersionId,
    setEditingVersionId,
    projects,
    setHistoryVersionFilters,
  } = useHrMachineStore()

  // 点击项目名称 → 切换到历史版本空间，并自动筛选该项目
  const handleSelectProject = (id: string) => {
    const project = projects.find(p => p.id === id)
    if (!project) return
    setSelectedProjectId(id)
    setHistoryVersionFilters({ projectName: [project.id] })
    setActiveTab('historyVersion')
  }

  return (
    <div className="pms-hr-machine-content">
      {/* Top-level TAB switcher */}
      <div className="pms-hr-machine-tab-bar">
        {!scopeId && <Segmented
          value={activeTab}
          onChange={(v) => setActiveTab(v as 'projectList' | 'monthlyInvestment' | 'historyVersion')}
          options={[
            { value: 'projectList', label: '项目列表' },
            { value: 'historyVersion', label: '项目预估投入空间' },
            { value: 'monthlyInvestment', label: '项目月度预估投入' },
          ]}
        />}
      </div>

      {/* Tab content */}
      <div className="pms-hr-machine-tab-content">
        {activeTab === 'projectList' && (
          <ProjectListTab
            onSelectProject={handleSelectProject}
            onNewProject={() => setShowNewProjectModal(true)}
          />
        )}

        {activeTab === 'monthlyInvestment' && <MonthlyInvestmentTab />}

        {activeTab === 'historyVersion' && <HistoryVersionSpace />}
      </div>

      {/* Modals */}
      <NewProjectModal
        open={showNewProjectModal}
        onCancel={() => setShowNewProjectModal(false)}
      />
      <NewVersionModal
        open={showNewVersionModal}
        projectId={selectedProjectId ?? ''}
        onCancel={() => setShowNewVersionModal(false)}
      />
      <MonthlyEditModal
        open={showMonthlyEditModal}
        monthlyId={editingMonthlyId}
        onCancel={() => {
          setShowMonthlyEditModal(false)
          setEditingMonthlyId(null)
        }}
      />
      <MachineVersionDetailModal
        open={showVersionDetailModal}
        versionId={editingVersionId}
        onCancel={() => {
          setShowVersionDetailModal(false)
          setEditingVersionId(null)
        }}
      />
    </div>
  )
}
