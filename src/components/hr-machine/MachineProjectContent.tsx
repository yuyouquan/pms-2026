'use client'

import { useMemo } from 'react'
import { Segmented } from 'antd'
import { useHrMachineStore } from '@/stores/hrMachine'
import ProjectListTab from './ProjectListTab'
import ProjectDetailSpace from './ProjectDetailSpace'
import MonthlyInvestmentTab from './MonthlyInvestmentTab'
import NewProjectModal from './NewProjectModal'
import NewVersionModal from './NewVersionModal'
import MonthlyEditModal from './MonthlyEditModal'

export default function MachineProjectContent() {
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
    projects,
  } = useHrMachineStore()

  const selectedProject = useMemo(
    () => projects.find(p => p.id === selectedProjectId),
    [projects, selectedProjectId],
  )

  // If a project is selected, show detail space regardless of tab
  if (selectedProjectId && selectedProject) {
    return (
      <div className="pms-hr-machine-content">
        <ProjectDetailSpace
          projectId={selectedProjectId}
          onBack={() => setSelectedProjectId(null)}
          onNewVersion={() => setShowNewVersionModal(true)}
        />
        <NewVersionModal
          open={showNewVersionModal}
          projectId={selectedProjectId}
          onCancel={() => setShowNewVersionModal(false)}
        />
        {/* Keep modals mounted for detail view */}
        <MonthlyEditModal
          open={showMonthlyEditModal}
          monthlyId={editingMonthlyId}
          onCancel={() => {
            setShowMonthlyEditModal(false)
            setEditingMonthlyId(null)
          }}
        />
      </div>
    )
  }

  return (
    <div className="pms-hr-machine-content">
      {/* Top-level TAB switcher */}
      <div className="pms-hr-machine-tab-bar">
        <Segmented
          value={activeTab}
          onChange={(v) => setActiveTab(v as 'projectList' | 'monthlyInvestment')}
          options={[
            { value: 'projectList', label: '项目列表' },
            { value: 'monthlyInvestment', label: '项目月度预估投入' },
          ]}
        />
      </div>

      {/* Tab content */}
      <div className="pms-hr-machine-tab-content">
        {activeTab === 'projectList' && (
          <ProjectListTab
            onSelectProject={(id) => setSelectedProjectId(id)}
            onNewProject={() => setShowNewProjectModal(true)}
          />
        )}

        {activeTab === 'monthlyInvestment' && (
          <MonthlyInvestmentTab
            onEditMonthly={(id) => {
              setEditingMonthlyId(id)
              setShowMonthlyEditModal(true)
            }}
          />
        )}
      </div>

      {/* Modals */}
      <NewProjectModal
        open={showNewProjectModal}
        onCancel={() => setShowNewProjectModal(false)}
      />
      <MonthlyEditModal
        open={showMonthlyEditModal}
        monthlyId={editingMonthlyId}
        onCancel={() => {
          setShowMonthlyEditModal(false)
          setEditingMonthlyId(null)
        }}
      />
    </div>
  )
}
