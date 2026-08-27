'use client'

import { useMemo } from 'react'
import { message } from 'antd'
import ProjectInfoModal, { type ProjectInfoSubmitPayload } from '@/components/project-info/ProjectInfoModal'
import { EXTERNAL_PROJECT_POOL, type ExternalProjectEntry } from '@/data/externalProjectPool'
import { useProjectStore } from '@/stores/project'
import { useUiStore } from '@/stores/ui'
import { usePermissionStore } from '@/stores/permission'
import { inferOsSeriesFromProjectName } from '@/constants/projectBasicFields'
import {
  PROJECT_TYPE_TOS_VERSION,
  PROJECT_CATEGORY_TECH,
  isMachineProjectType,
  isSoftwareProjectType,
} from '@/constants/projectTypes'
import { mergeProjectInfoValues, type ProjectInfoProject } from '@/lib/projectInfoValues'
import { deriveProjectResponsiblePersons, deriveProjectTosVersion } from '@/lib/projectInfoRules'
import { resolveMachineTosUpdate } from '@/lib/machineTosVersions'
import { normalizeTargetMarkets } from '@/lib/marketRules'
import { adaptNormalProject } from '@/lib/roadmapProjectAdapter'
import { normalizeTosEnumReference, resolveCurrentTosEnumValue } from '@/lib/tosEnumOptions'
import { useActivateProject } from '@/hooks/useActivateProject'
import { useEnumHydration } from '@/hooks/useEnumOptions'
import { getSingleEnumValues } from '@/lib/enumConsumers'
import { useEnumStore } from '@/stores/enums'
import { synchronizeTechnicalProjectRecord } from '@/lib/technicalProjectRules'

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
  const rowsByType = useEnumStore(state => state.rowsByType)
  useEnumHydration(open)
  const machineTosValues = useMemo(() => getSingleEnumValues(rowsByType, 'first-sale-tos'), [rowsByType])

  const candidatePool = useMemo<ExternalProjectEntry[]>(() => {
    const existingBids = new Set(projects
      .map(project => typeof project.sourceBid === 'string' ? project.sourceBid : '')
      .filter(Boolean))
    return EXTERNAL_PROJECT_POOL.filter(entry => !existingBids.has(entry.bid))
  }, [projects])

  const handleSubmit = async (payload: ProjectInfoSubmitPayload) => {
    const enumState = useEnumStore.getState()
    if (!enumState.hasHydrated || enumState.hydrationError) {
      message.error(enumState.hydrationError || '枚举配置正在加载，请稍后重试')
      return false
    }
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
    const inferredOsSeries = inferOsSeriesFromProjectName(entry.name)
    const selectedFirstSaleTosVersion = typeof payload.infoValues.firstSaleTosVersion === 'string'
      ? payload.infoValues.firstSaleTosVersion.trim()
      : ''
    const selectedCurrentTosVersion = typeof payload.infoValues.currentTosVersion === 'string'
      ? payload.infoValues.currentTosVersion.trim()
      : ''
    const machineProductType = typeof payload.infoValues.productType === 'string'
      ? payload.infoValues.productType
      : extra.productType ?? ''
    const selectedMachineTosVersion = machineProductType === '老品'
      ? selectedCurrentTosVersion
      : selectedFirstSaleTosVersion
    const selectedMachineTosVersionId = resolveCurrentTosEnumValue(
      'tos-3-part',
      selectedMachineTosVersion,
      machineTosValues,
    )
    const firstSaleTosVersionId = machineProductType === '老品'
      ? normalizeTosEnumReference(selectedFirstSaleTosVersion)
      : selectedMachineTosVersionId
    const currentTosVersionId = machineProductType === '老品'
      ? selectedMachineTosVersionId
      : firstSaleTosVersionId
    const derivedResponsiblePersons = deriveProjectResponsiblePersons(
      projectType,
      payload.infoValues,
      payload.responsiblePersons,
    )
    const rawVersionType = typeof payload.infoValues.versionType === 'string'
      ? payload.infoValues.versionType
      : extra.versionType ?? ''
    const developmentMode = typeof payload.infoValues.developmentMode === 'string'
      ? payload.infoValues.developmentMode
      : extra.developMode ?? ''
    const baseProject = {
      id: newId,
      sourceBid: payload.bid,
      name: entry.name,
      type: projectType,
      secondaryCategory: payload.projectSecondaryCategory,
      status: payload.projectStatus,
      progress: 0,
      leader: derivedResponsiblePersons[0] || '',
      responsiblePersons: derivedResponsiblePersons,
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
      tosVersion: deriveProjectTosVersion(
        projectType,
        entry.name,
        isSoftwareProject ? (extra.tosVersion || '') : (extra.tosVersion ?? ''),
      ),
      brand: extra.brand ?? undefined,
      planStartDate: extra.planStartDate ?? '',
      planEndDate: extra.planEndDate ?? '',
      healthStatus: payload.healthStatus,
      ...(isMachineProjectType(projectType) ? {
        firstSaleTosVersionId,
        firstSaleTosVersion: firstSaleTosVersionId,
        currentTosVersionId,
        currentTosVersion: currentTosVersionId,
        projectCode: extra.projectCode ?? (typeof payload.infoValues.projectModel === 'string' ? payload.infoValues.projectModel : entry.name),
        platform: extra.platform ?? extra.chipPlatform ?? '',
        productType: machineProductType,
        startRam: extra.startRam ?? (typeof payload.infoValues.startingRam === 'string' ? payload.infoValues.startingRam : ''),
        versionType: rawVersionType,
        str5Date: extra.str5Date ?? '',
        launchDate: extra.launchDate ?? (typeof payload.infoValues.launchDate === 'string' ? payload.infoValues.launchDate : ''),
        developMode: developmentMode,
        remark: extra.remark ?? '',
      } : {}),
    }
    const mergedProject = mergeProjectInfoValues(baseProject as ProjectInfoProject, payload.infoValues) as typeof baseProject
    const synchronizedProject = projectType === PROJECT_CATEGORY_TECH
      ? synchronizeTechnicalProjectRecord(
          mergedProject as unknown as Record<string, unknown>,
          payload.infoValues as Record<string, unknown>,
          { ipmProjectType: entry.ipmProjectCategoryName },
        )
      : mergedProject
    const newProject = isMachineProjectType(projectType)
      ? { ...synchronizedProject, market: initialMarkets.join(','), markets: initialMarkets }
      : synchronizedProject

    if (isMachineProjectType(projectType) && !selectedMachineTosVersionId) {
      if (!machineTosValues.length) message.error('请先维护 tOS 版本后再创建整机项目')
      else if (machineProductType === '老品') message.error('请选择当前 tOS 版本')
      else message.error('请选择首销 tOS 版本')
      return false
    }
    if (isMachineProjectType(projectType) && !adaptNormalProject(newProject as any, [])) {
      message.error('外部项目缺少或不符合路标字段，请检查安卓版本、品牌、产品类型、起步 RAM、版本类型和开发模式')
      return false
    }
    if (isMachineProjectType(projectType)) {
      const resolution = resolveMachineTosUpdate(projects as any[], newProject as any)
      if (!resolution.ok) {
        const reasonMessage = resolution.reason === 'missing-new-product'
          ? '未找到项目名完全相同的新品项目，无法创建老品项目'
          : resolution.reason === 'duplicate-new-product'
            ? machineProductType === '新品'
              ? '已存在项目名完全相同的新品项目，无法重复创建'
              : '存在多个项目名完全相同的新品项目，无法创建老品项目'
            : 'tOS 版本必须是严格的三段数字，例如 14.0.0'
        message.error(reasonMessage)
        return false
      }
    }
    const added = addProject(newProject as unknown as Parameters<typeof addProject>[0], currentLoginUser, {
      allowedFirstSaleTosValues: machineTosValues,
    })
    if (!added) {
      message.error('项目创建失败，请检查整机项目的首销 tOS 版本和路标字段')
      return false
    }
    setProjectMember(newId, derivedResponsiblePersons)
    if (projectType !== PROJECT_CATEGORY_TECH && projectType !== PROJECT_TYPE_TOS_VERSION) {
      initProjectPermissions(newId, { '系统管理员': derivedResponsiblePersons })
    }
    const createdProject = useProjectStore.getState().projects.find(project => project.id === newId)
    if (createdProject) activateProject(createdProject as unknown as Parameters<typeof activateProject>[0])
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
    />
  )
}
