'use client'

import { useMemo } from 'react'
import { message } from 'antd'
import ProjectInfoModal, { type ProjectInfoSubmitPayload } from '@/components/project-info/ProjectInfoModal'
import { EXTERNAL_PROJECT_POOL, type ExternalProjectEntry } from '@/data/externalProjectPool'
import { useProjectStore } from '@/stores/project'
import { useUiStore } from '@/stores/ui'
import { usePermissionStore } from '@/stores/permission'
import { inferOsSeriesFromProjectName, inferTosVersionFromProjectName } from '@/constants/projectBasicFields'
import {
  PROJECT_TYPE_TOS_VERSION,
  isMachineProjectType,
  isSoftwareProjectType,
} from '@/constants/projectTypes'
import { mergeProjectInfoValues, type ProjectInfoProject } from '@/lib/projectInfoValues'
import { normalizeTargetMarkets } from '@/lib/marketRules'

interface AddProjectModalProps {
  open: boolean
  onCancel: () => void
}

export default function AddProjectModal({ open, onCancel }: AddProjectModalProps) {
  const {
    projects,
    currentLoginUser,
    addProject,
    setSelectedProject,
    setProjectMember,
    setSelectedMarketTab,
    setSelectedTosTypeTab,
  } = useProjectStore()
  const { setActiveModule, setProjectSpaceModule } = useUiStore()
  const initProjectPermissions = usePermissionStore(state => state.initProjectPermissions)

  const candidatePool = useMemo<ExternalProjectEntry[]>(() => {
    const existingNames = new Set(projects.map(project => project.name))
    return EXTERNAL_PROJECT_POOL.filter(entry => !existingNames.has(entry.name))
  }, [projects])

  const handleSubmit = async (payload: ProjectInfoSubmitPayload) => {
    const entry = payload.sourceEntry
    if (!entry) {
      message.error('未找到外部项目条目')
      return
    }
    const extra = payload.sourceValues
    const newId = `${Date.now()}`
    const projectType = payload.projectType
    const isSoftwareProject = isSoftwareProjectType(projectType)
    const initialMarkets = isMachineProjectType(projectType)
      ? normalizeTargetMarkets(payload.infoValues.targetMarkets ?? extra.targetMarkets)
      : []
    const inferredTosVersion = inferTosVersionFromProjectName(entry.name)
    const inferredOsSeries = inferOsSeriesFromProjectName(entry.name)
    const baseProject = {
      id: newId,
      name: entry.name,
      type: projectType,
      status: '待立项',
      progress: 0,
      leader: payload.responsiblePersons[0],
      responsiblePersons: payload.responsiblePersons,
      markets: initialMarkets,
      androidVersion: extra.androidVersion ?? '',
      chipPlatform: extra.chipPlatform ?? '',
      spm: entry.spm,
      updatedAt: '刚刚',
      productLine: extra.productLine ?? '',
      marketName: extra.marketName ?? '',
      productSeries: projectType === PROJECT_TYPE_TOS_VERSION ? inferredOsSeries : '',
      osSeries: projectType === PROJECT_TYPE_TOS_VERSION ? inferredOsSeries : (isSoftwareProject ? '' : undefined),
      versionType: projectType === PROJECT_TYPE_TOS_VERSION ? 'Full' : undefined,
      versionTypes: projectType === PROJECT_TYPE_TOS_VERSION ? ['Full'] : undefined,
      tosVersion: isSoftwareProject ? (inferredTosVersion || extra.tosVersion || '') : (extra.tosVersion ?? ''),
      brand: extra.brand ?? undefined,
      planStartDate: extra.planStartDate ?? '',
      planEndDate: extra.planEndDate ?? '',
      healthStatus: payload.healthStatus as 'normal' | 'warning' | 'risk',
    }
    const mergedProject = mergeProjectInfoValues(baseProject as ProjectInfoProject, payload.infoValues) as typeof baseProject
    const newProject = isMachineProjectType(projectType)
      ? { ...mergedProject, market: initialMarkets.join(','), markets: initialMarkets }
      : mergedProject

    addProject(newProject as unknown as Parameters<typeof addProject>[0])
    setProjectMember(newId, payload.responsiblePersons)
    initProjectPermissions(newId, { '系统管理员': payload.responsiblePersons })
    setSelectedProject(newProject as unknown as Parameters<typeof setSelectedProject>[0])
    setSelectedMarketTab(initialMarkets[0] || 'OP')
    if (projectType === PROJECT_TYPE_TOS_VERSION) setSelectedTosTypeTab('Full')
  }

  const handleAfterCreate = () => {
    setProjectSpaceModule('basic')
    setActiveModule('projectSpace')
    message.success('项目创建成功')
  }

  return (
    <ProjectInfoModal
      mode="create"
      open={open}
      draftOwnerId={currentLoginUser}
      candidateProjects={candidatePool}
      existingProjects={projects as unknown as ProjectInfoProject[]}
      responsiblePersons={[]}
      onCancel={onCancel}
      onSubmit={handleSubmit}
      onAfterCreate={handleAfterCreate}
    />
  )
}
