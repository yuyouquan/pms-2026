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
import { adaptNormalProject } from '@/lib/roadmapProjectAdapter'
import { resolveCurrentTosEnumValue } from '@/lib/tosEnumOptions'
import { useActivateProject } from '@/hooks/useActivateProject'
import { useTosEnumOptions } from '@/hooks/useTosEnumOptions'

interface AddProjectModalProps {
  open: boolean
  onCancel: () => void
}

export default function AddProjectModal({ open, onCancel }: AddProjectModalProps) {
  const {
    projects,
    currentLoginUser,
    addProject,
    setProjectMember,
  } = useProjectStore()
  const { enterProjectSpace, setProjectSpaceModule } = useUiStore()
  const activateProject = useActivateProject()
  const initProjectPermissions = usePermissionStore(state => state.initProjectPermissions)
  const { currentValues: machineTosValues, options: machineTosOptions } = useTosEnumOptions('tos-3-part')

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
    const selectedFirstSaleTosVersion = typeof payload.infoValues.firstSaleTosVersion === 'string'
      ? payload.infoValues.firstSaleTosVersion.trim()
      : ''
    const firstSaleTosVersionId = resolveCurrentTosEnumValue('tos-3-part', selectedFirstSaleTosVersion, machineTosValues)
    const rawVersionType = typeof payload.infoValues.versionType === 'string'
      ? payload.infoValues.versionType
      : extra.versionType ?? ''
    const normalizedVersionType = rawVersionType.toUpperCase() === 'GO' ? 'Go' : rawVersionType
    const developmentMode = typeof payload.infoValues.developmentMode === 'string'
      ? payload.infoValues.developmentMode
      : extra.developMode ?? ''
    const baseProject = {
      id: newId,
      name: entry.name,
      type: projectType,
      secondaryCategory: payload.projectSecondaryCategory,
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
      ...(isMachineProjectType(projectType) ? {
        firstSaleTosVersionId,
        projectCode: extra.projectCode ?? (typeof payload.infoValues.projectModel === 'string' ? payload.infoValues.projectModel : entry.name),
        platform: extra.platform ?? extra.chipPlatform ?? '',
        productType: extra.productType ?? (typeof payload.infoValues.productType === 'string' ? payload.infoValues.productType : ''),
        startRam: extra.startRam ?? (typeof payload.infoValues.startingRam === 'string' ? payload.infoValues.startingRam : ''),
        versionType: normalizedVersionType,
        str5Date: extra.str5Date ?? '',
        launchDate: extra.launchDate ?? (typeof payload.infoValues.launchDate === 'string' ? payload.infoValues.launchDate : ''),
        developMode: developmentMode,
        remark: extra.remark ?? '',
      } : {}),
    }
    const mergedProject = mergeProjectInfoValues(baseProject as ProjectInfoProject, payload.infoValues) as typeof baseProject
    const newProject = isMachineProjectType(projectType)
      ? { ...mergedProject, market: initialMarkets.join(','), markets: initialMarkets }
      : mergedProject

    if (isMachineProjectType(projectType) && !firstSaleTosVersionId) {
      message.error(machineTosValues.length ? '请选择首销 tOS 版本' : '请先维护 tOS 版本后再创建整机项目')
      return false
    }
    if (isMachineProjectType(projectType) && !adaptNormalProject(newProject as any, [])) {
      message.error('外部项目缺少或不符合路标字段，请检查安卓版本、品牌、产品类型、起步 RAM、版本类型和开发模式')
      return false
    }
    const added = addProject(newProject as unknown as Parameters<typeof addProject>[0], currentLoginUser, {
      allowedFirstSaleTosValues: machineTosValues,
    })
    if (!added) {
      message.error('项目创建失败，请检查整机项目的首销 tOS 版本和路标字段')
      return false
    }
    setProjectMember(newId, payload.responsiblePersons)
    initProjectPermissions(newId, { '系统管理员': payload.responsiblePersons })
    activateProject(newProject as unknown as Parameters<typeof activateProject>[0])
    return true
  }

  const handleAfterCreate = () => {
    setProjectSpaceModule('basic')
    enterProjectSpace({ module: 'projectList' })
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
      fieldOptionOverrides={{
        firstSaleTosVersion: machineTosOptions,
        versionType: ['Full', 'Slim', 'Go'],
        developmentMode: ['自研', 'ODC', 'ITD-ODC', 'ODM', '纯外研'],
      }}
    />
  )
}
