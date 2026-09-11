'use client'
import { Button, Tag } from 'antd'
import { useHrResourceScope } from '@/components/project-resources/HrResourceScope'
import { canAccessHrProject, getHrRegistryProject, type HrRegistryRecord } from '@/lib/hrProjectRegistry'
import { useProjectStore } from '@/stores/project'
import { useUiStore } from '@/stores/ui'
import { useTransferStore } from '@/stores/transfer'
export default function HrSourceLink({ project }: { project?: HrRegistryRecord }) {
  const scopeId = useHrResourceScope()
  if (project?.migrationIssue) return <div><Tag color="warning">归属待核对</Tag><span>{project.migrationIssue}</span></div>
  if (!scopeId || !project || project.pmsProjectId === scopeId || !canAccessHrProject(project)) return null
  const source = getHrRegistryProject(project)
  if (!source) return null
  return <div><Tag>关联年度预算 · 只读</Tag><Button size="small" type="link" onClick={() => {
    if (!canAccessHrProject(project)) return
    useUiStore.getState().navigateWithEditGuard(() => {
      useProjectStore.getState().setSelectedProject(source)
      useTransferStore.getState().setTransferView(null)
      useUiStore.getState().setProjectSpaceModule('resources')
      useUiStore.getState().setActiveModule('projectSpace')
    }, false)
  }}>进入来源预算项目：{source.name}</Button></div>
}
