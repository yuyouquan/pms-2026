'use client'

import { useMemo } from 'react'
import { Button, Segmented, Space } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useHrCapabilityStore } from '@/stores/hrCapability'
import ProjectListTab from './ProjectListTab'
import HistoryVersionSpace from './HistoryVersionSpace'
import MonthlyInvestmentTab from './MonthlyInvestmentTab'
import NewProjectModal from './NewProjectModal'
import NewVersionModal from './NewVersionModal'
import VersionDetailModal from './VersionDetailModal'
import MonthlyEditModal from './MonthlyEditModal'
import VersionHistoryModal from './VersionHistoryModal'

export default function CapabilityProjectContent() {
  const activeTab = useHrCapabilityStore((s) => s.activeTab)
  const setActiveTab = useHrCapabilityStore((s) => s.setActiveTab)
  const setShowNewProjectModal = useHrCapabilityStore((s) => s.setShowNewProjectModal)
  const setShowNewVersionModal = useHrCapabilityStore((s) => s.setShowNewVersionModal)
  const selectedProjectId = useHrCapabilityStore((s) => s.selectedProjectId)
  const projects = useHrCapabilityStore((s) => s.projects)
  const setFilters = useHrCapabilityStore((s) => s.setFilters)
  const setHistoryVersionFilters = useHrCapabilityStore((s) => s.setHistoryVersionFilters)

  const showNewVersionModal = useHrCapabilityStore((s) => s.showNewVersionModal)
  const showVersionDetailModal = useHrCapabilityStore((s) => s.showVersionDetailModal)
  const showMonthlyEditModal = useHrCapabilityStore((s) => s.showMonthlyEditModal)
  const showVersionHistoryModal = useHrCapabilityStore((s) => s.showVersionHistoryModal)
  const editingVersionId = useHrCapabilityStore((s) => s.editingVersionId)
  const editingMonthlyId = useHrCapabilityStore((s) => s.editingMonthlyId)
  const historyVersionId = useHrCapabilityStore((s) => s.historyVersionId)
  const versionDetailReadOnly = useHrCapabilityStore((s) => s.versionDetailReadOnly)

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  )

  const tabs = useMemo(
    () => [
      { label: '项目列表', value: 'projectList' },
      { label: '项目预估投入空间', value: 'historyVersion' },
      { label: '项目月度预估投入', value: 'monthlyInvestment' },
    ],
    [],
  )

  const handleSelectProject = (projectId: string) => {
    useHrCapabilityStore.getState().setSelectedProjectId(projectId)
    const project = projects.find((p) => p.id === projectId)
    if (project) {
      setHistoryVersionFilters({ projectName: [project.name] })
    }
    setActiveTab('historyVersion')
  }

  const handleNewVersion = () => {
    setShowNewVersionModal(true)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 12 }}>
      {/* 工具栏 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <Segmented
          options={tabs}
          value={activeTab}
          onChange={(v) => setActiveTab(v as string)}
        />
        <Space>
          {activeTab === 'projectList' && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setShowNewProjectModal(true)}
            >
              新建项目
            </Button>
          )}
          {activeTab === 'historyVersion' && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleNewVersion}
              disabled={!selectedProjectId}
            >
              新建版本
            </Button>
          )}
        </Space>
      </div>

      {/* 内容区 */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {activeTab === 'projectList' && <ProjectListTab onSelectProject={handleSelectProject} />}
        {activeTab === 'historyVersion' && <HistoryVersionSpace />}
        {activeTab === 'monthlyInvestment' && <MonthlyInvestmentTab />}
      </div>

      {/* 弹窗 */}
      <NewProjectModal open={useHrCapabilityStore((s) => s.showNewProjectModal)} onCancel={() => {}} />
      <NewVersionModal open={showNewVersionModal} onCancel={() => setShowNewVersionModal(false)} />
      <VersionDetailModal
        open={showVersionDetailModal}
        versionId={editingVersionId}
        projectId={selectedProjectId ?? ''}
        readOnly={versionDetailReadOnly}
        onCancel={() => useHrCapabilityStore.getState().setShowVersionDetailModal(false)}
      />
      <MonthlyEditModal
        open={showMonthlyEditModal}
        monthlyId={editingMonthlyId}
        onCancel={() => useHrCapabilityStore.getState().setShowMonthlyEditModal(false)}
      />
      <VersionHistoryModal
        open={showVersionHistoryModal}
        versionId={historyVersionId}
        onCancel={() => useHrCapabilityStore.getState().setShowVersionHistoryModal(false)}
      />
    </div>
  )
}
