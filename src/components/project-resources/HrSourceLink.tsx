'use client'
import { Button, Tag } from 'antd'
import { useHrResourceScope } from '@/components/project-resources/HrResourceScope'
import { canAccessHrProject, getHrRegistryProject, type HrRegistryRecord } from '@/lib/hrProjectRegistry'
import { useProjectStore } from '@/stores/project'
import { useUiStore } from '@/stores/ui'
import { useTransferStore } from '@/stores/transfer'
export default function HrSourceLink({ project, name }: { project?: HrRegistryRecord; name: string }) {
  const scopeId = useHrResourceScope()
  const projectName = <span style={{ color: 'var(--pms-brand-strong)', fontWeight: 600 }}>{name}</span>
  const status = project?.status === 'cancelled' ? <Tag>已取消 · 不可新增版本</Tag> : null
  if (project?.migrationIssue) return <div>{projectName}{status}<Tag color="warning">归属待核对</Tag><span>{project.migrationIssue}</span></div>
  if (!scopeId || !project || project.pmsProjectId === scopeId || !canAccessHrProject(project)) return <>{projectName}{status}</>
  const source = getHrRegistryProject(project)
  if (!source) return projectName
  return <div><Button size="small" type="link" title={source.name} style={{ padding: 0, height: 'auto', whiteSpace: 'normal', textAlign: 'left', fontWeight: 600 }} onClick={() => {
    if (!canAccessHrProject(project)) return
    useUiStore.getState().navigateWithEditGuard(() => {
      useProjectStore.getState().setSelectedProject(source)
      useTransferStore.getState().setTransferView(null)
      useUiStore.getState().setProjectSpaceModule('resources')
      useUiStore.getState().setActiveModule('projectSpace')
    }, false)
  }}>{source.name}</Button>{status}</div>
}
