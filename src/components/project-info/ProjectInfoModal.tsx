'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ReloadOutlined } from '@ant-design/icons'
import { Alert, Button, Collapse, Form, Input, Modal, Select, Space, Spin, Tag, message } from 'antd'
import { ALL_USERS } from '@/components/permission/PermissionModule'
import ProjectInfoFieldInput from '@/components/project-info/ProjectInfoFieldInput'
import TechnicalProjectCreateFields from '@/components/technical-project/TechnicalProjectCreateFields'
import {
  getProjectInfoFields,
  isTargetProjectInfoType,
  type ProjectInfoGroupKey,
} from '@/constants/projectInfoSchema'
import {
  PROJECT_SECONDARY_CATEGORIES,
  PROJECT_TYPES,
  PROJECT_TYPE_TOS_VERSION,
  PROJECT_CATEGORY_TECH,
  isMachineProjectType,
  mapIpmProjectClassification,
  normalizeMachineProjectType,
  resolveProjectClassification,
} from '@/constants/projectTypes'
import { fetchByBid, type ExternalProjectEntry } from '@/data/externalProjectPool'
import {
  deriveMachineProjectInfoValues,
  deriveProjectResponsiblePersons,
  deriveTosProjectAggregates,
  getProjectInfoModalFields,
  getProjectInfoModalGroups,
  getProjectInfoModalSubmitValues,
  validateProjectInfoValues,
} from '@/lib/projectInfoRules'
import {
  buildProjectInfoValues,
  type ProjectInfoProject,
} from '@/lib/projectInfoValues'
import { normalizeTosEnumReference } from '@/lib/tosEnumOptions'
import { normalizeMachineFamilyName, resolveMachineTosUpdate } from '@/lib/machineTosVersions'
import { normalizeTechnicalProjectValues, TechnicalProjectValidationError, validateTechnicalProject } from '@/lib/technicalProjectRules'
import {
  defaultProjectCreationDraftRepository,
  isProjectCreationDraftEmpty,
  PROJECT_CREATION_DRAFT_SCHEMA_VERSION,
  shouldClearSubmittedProjectCreationDraft,
  type ProjectCreationDraftSession,
  type ProjectCreationDraftRepository,
} from '@/lib/projectCreationDraft'
import type { ProjectInfoValues } from '@/types/app'
import { TECHNICAL_DELIVERABLE_FIELDS } from '@/constants/technicalProject'
import { useProjectStore } from '@/stores/project'
import { useOverlayInteraction } from '@/hooks/useOverlayInteraction'

type ProjectInfoFormState = ProjectInfoValues & {
  bid?: string
  projectName?: string
  type?: string
  secondaryCategory?: string
  responsiblePersons?: string[]
  healthStatus?: string
  status?: string
  currentNode?: string
  cancelPauseDate?: string
  marketName?: string
  brand?: string
  productLine?: string
}

export interface ProjectInfoSubmitPayload {
  bid?: string
  projectName: string
  projectType: string
  projectSecondaryCategory: string
  responsiblePersons: string[]
  healthStatus: string
  infoValues: ProjectInfoValues
  sourceEntry?: ExternalProjectEntry
  sourceValues: ReturnType<typeof fetchByBid>
}

interface ProjectInfoModalProps {
  mode: 'create' | 'edit'
  open: boolean
  candidateProjects: ExternalProjectEntry[]
  project?: ProjectInfoProject
  existingProjects: ProjectInfoProject[]
  responsiblePersons: string[]
  draftOwnerId?: string
  draftRepository?: ProjectCreationDraftRepository
  onCancel: () => void
  onSubmit: (payload: ProjectInfoSubmitPayload) => Promise<boolean | void> | boolean | void
  onAfterCreate?: () => void
  fieldOptionOverrides?: Partial<Record<string, readonly (string | { label: string; value: string; disabled?: boolean })[]>>
}

export const PROJECT_CREATION_DRAFT_SAVE_DELAY_MS = 300

const CREATE_FORM_DEFAULTS: ProjectInfoFormState = {
  responsiblePersons: [],
  healthStatus: 'normal',
  status: '待立项',
}

type DraftReadStatus = 'idle' | 'loading' | 'ready' | 'failed'

const HEALTH_OPTIONS = [
  { label: '正常', value: 'normal' },
  { label: '预警', value: 'warning' },
  { label: '风险', value: 'risk' },
]

const GROUP_COLORS: Record<ProjectInfoGroupKey, string> = {
  basic: '#6366f1',
  extended: '#f59e0b',
  team: '#14b8a6',
}

export default function ProjectInfoModal({
  mode,
  open,
  candidateProjects,
  project,
  existingProjects,
  responsiblePersons,
  draftOwnerId,
  draftRepository = defaultProjectCreationDraftRepository,
  onCancel,
  onSubmit,
  onAfterCreate,
  fieldOptionOverrides,
}: ProjectInfoModalProps) {
  const [form] = Form.useForm<ProjectInfoFormState>()
  const syncTechnicalTeamPermissionMembers = useProjectStore(state => state.syncTechnicalTeamPermissionMembers)
  const syncTosTeamPermissionMembers = useProjectStore(state => state.syncTosTeamPermissionMembers)
  const [submitting, setSubmitting] = useState(false)
  const { tryBeginSubmit, releaseSubmission } = useOverlayInteraction()
  const [activeGroups, setActiveGroups] = useState<string[]>([])
  const [aggregateWarnings, setAggregateWarnings] = useState<string[]>([])
  const [machineFamilyError, setMachineFamilyError] = useState('')
  const [draftReadStatus, setDraftReadStatusState] = useState<DraftReadStatus>('idle')
  const [draftHydrationAttempt, setDraftHydrationAttempt] = useState(0)
  const lastAppliedSourceRef = useRef<string>('')
  const activeGroupsRef = useRef<string[]>([])
  const candidateProjectsRef = useRef(candidateProjects)
  const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const draftMutationQueueRef = useRef<Promise<void>>(Promise.resolve())
  const componentMountedRef = useRef(true)
  const draftReadStatusRef = useRef<DraftReadStatus>('idle')
  const createDraftSessionGenerationRef = useRef(0)
  const currentCreateDraftSessionRef = useRef<ProjectCreationDraftSession | null>(null)
  const createDraftContextRef = useRef({ open, mode, ownerId: draftOwnerId || '' })
  createDraftContextRef.current = { open, mode, ownerId: draftOwnerId || '' }
  const watchedValues = (Form.useWatch([], { form, preserve: true }) || {}) as ProjectInfoFormState
  const projectType = String(watchedValues.type || project?.type || '')
  const watchedBid = String(watchedValues.bid || '')
  const selectedCandidate = mode === 'create'
    ? candidateProjects.find(item => item.bid === watchedBid)
    : undefined
  const selectedIpmClassification = selectedCandidate
    ? mapIpmProjectClassification(selectedCandidate.ipmProjectCategoryName)
    : undefined
  const isIpmClassificationMissing = Boolean(selectedCandidate && !selectedIpmClassification)
  const machineProductType = String(watchedValues.productType || '')
  const isLegacyMachine = isMachineProjectType(projectType) && machineProductType === '老品'
  const isTechnicalProject = projectType === PROJECT_CATEGORY_TECH
  const fields = useMemo(() => getProjectInfoModalFields(projectType), [projectType])
  const editableFields = useMemo(() => fields.filter(field => !field.readOnly), [fields])
  const groups = useMemo(() => getProjectInfoModalGroups(projectType), [projectType])
  const firstLaunchOptions = useMemo(() => existingProjects
    .filter(item => isMachineProjectType(item.type))
    .map(item => ({ label: item.name, value: item.id })), [existingProjects])
  const secondaryCategoryOptions = useMemo(() => {
    const values = PROJECT_SECONDARY_CATEGORIES[
      projectType as keyof typeof PROJECT_SECONDARY_CATEGORIES
    ] as readonly string[] | undefined
    return (values || []).map(value => ({ label: value, value }))
  }, [projectType])
  const isDraftHydrating = mode === 'create'
    && open
    && (
      draftReadStatus === 'idle'
      || draftReadStatus === 'loading'
      || currentCreateDraftSessionRef.current?.ownerId !== (draftOwnerId || '')
    )
  const isCreateDraftReadFailed = mode === 'create' && open && draftReadStatus === 'failed'
  const isCreateDraftSubmitting = mode === 'create' && open && submitting
  const isDraftInteractionLocked = isDraftHydrating || isCreateDraftSubmitting
  const isCreateDraftInteractionBlocked = isDraftInteractionLocked || isCreateDraftReadFailed
  const draftInteractionDescription = isDraftHydrating
    ? '正在恢复项目草稿'
    : isCreateDraftSubmitting
      ? '正在创建项目'
      : undefined

  const cancelDraftSave = useCallback(() => {
    if (draftSaveTimerRef.current === null) return
    clearTimeout(draftSaveTimerRef.current)
    draftSaveTimerRef.current = null
  }, [])

  const startCreateDraftSession = useCallback((ownerId: string): ProjectCreationDraftSession => {
    cancelDraftSave()
    const session = {
      generation: createDraftSessionGenerationRef.current + 1,
      ownerId,
    }
    createDraftSessionGenerationRef.current = session.generation
    currentCreateDraftSessionRef.current = session
    return session
  }, [cancelDraftSave])

  const invalidateCreateDraftSession = useCallback(() => {
    cancelDraftSave()
    createDraftSessionGenerationRef.current += 1
    currentCreateDraftSessionRef.current = null
  }, [cancelDraftSave])

  const isCurrentCreateDraftSession = useCallback((session: ProjectCreationDraftSession) => {
    const currentSession = currentCreateDraftSessionRef.current
    const currentContext = createDraftContextRef.current
    return componentMountedRef.current
      && currentContext.open
      && currentContext.mode === 'create'
      && currentContext.ownerId === session.ownerId
      && currentSession?.generation === session.generation
      && currentSession.ownerId === session.ownerId
  }, [])

  const setDraftReadStatus = useCallback((status: DraftReadStatus) => {
    draftReadStatusRef.current = status
    if (componentMountedRef.current) setDraftReadStatusState(status)
  }, [])

  useEffect(() => {
    componentMountedRef.current = true
    return () => {
      componentMountedRef.current = false
      invalidateCreateDraftSession()
    }
  }, [invalidateCreateDraftSession])

  const enqueueDraftMutation = useCallback((operation: () => Promise<void>) => {
    const result = draftMutationQueueRef.current
      .catch(() => undefined)
      .then(operation)
    draftMutationQueueRef.current = result.catch(() => undefined)
    return result
  }, [])

  const resetCreateForm = useCallback(() => {
    form.resetFields()
    form.setFieldsValue(CREATE_FORM_DEFAULTS)
    setAggregateWarnings([])
    setMachineFamilyError('')
    activeGroupsRef.current = []
    setActiveGroups([])
    lastAppliedSourceRef.current = ''
  }, [form])

  const retryCreateDraftHydration = useCallback(() => {
    if (mode !== 'create' || !open || draftReadStatusRef.current !== 'failed') return
    setDraftHydrationAttempt(attempt => attempt + 1)
  }, [mode, open])

  useEffect(() => {
    candidateProjectsRef.current = candidateProjects
  }, [candidateProjects])

  useEffect(() => {
    activeGroupsRef.current = activeGroups
  }, [activeGroups])

  useEffect(() => {
    if (!open || mode !== 'edit' || !project) return
    lastAppliedSourceRef.current = ''
    setAggregateWarnings([])
    setMachineFamilyError('')
    // The Form instance survives modal close/reopen. Clear the previous project's
    // unmentioned fields before applying the next project's values.
    form.resetFields()
    const classification = resolveProjectClassification(
      project.type,
      typeof project.secondaryCategory === 'string' ? project.secondaryCategory : undefined,
    )
    const normalizedProjectType = classification.projectCategory
    const projectFields = getProjectInfoFields(normalizedProjectType)
    const storedInfoValues = buildProjectInfoValues(project, projectFields.map(field => field.key))
    let infoValues = isMachineProjectType(project.type)
      ? {
          ...storedInfoValues,
          firstSaleTosVersion: normalizeTosEnumReference(storedInfoValues.firstSaleTosVersion),
          currentTosVersion: normalizeTosEnumReference(storedInfoValues.currentTosVersion),
        }
      : storedInfoValues
    if (project.type === PROJECT_TYPE_TOS_VERSION) {
      const selectedIds = Array.isArray(storedInfoValues.firstLaunchProjects)
        ? storedInfoValues.firstLaunchProjects.filter((item): item is string => typeof item === 'string')
        : []
      const aggregateResult = deriveTosProjectAggregates(selectedIds, existingProjects, project.name)
      infoValues = { ...storedInfoValues, ...aggregateResult.values }
      setAggregateWarnings(aggregateResult.missingSources)
    }
    const initialValues: ProjectInfoFormState = {
      ...infoValues,
      projectName: project.name,
      type: normalizedProjectType,
      secondaryCategory: classification.secondaryCategory || '',
      responsiblePersons,
      healthStatus: typeof project.healthStatus === 'string' ? project.healthStatus : 'normal',
      status: typeof project.status === 'string' ? project.status : '',
      currentNode: typeof project.currentNode === 'string' ? project.currentNode : '',
      cancelPauseDate: typeof project.cancelPauseDate === 'string' ? project.cancelPauseDate : '',
      marketName: typeof project.marketName === 'string' ? project.marketName : '',
      brand: typeof project.brand === 'string' ? project.brand : '',
      productLine: typeof project.productLine === 'string' ? project.productLine : '',
    }
    form.setFieldsValue(initialValues)
    const nextActiveGroups = projectFields.length
      ? getProjectInfoModalGroups(normalizedProjectType).map(group => group.key)
      : []
    activeGroupsRef.current = nextActiveGroups
    setActiveGroups(nextActiveGroups)
  }, [existingProjects, form, mode, open, project, responsiblePersons])

  useEffect(() => {
    if (!open || mode !== 'create') {
      invalidateCreateDraftSession()
      setDraftReadStatus('idle')
      return
    }

    const session = startCreateDraftSession(draftOwnerId || '')
    setDraftReadStatus('loading')
    resetCreateForm()

    const hydrateDraft = async () => {
      if (!draftOwnerId) {
        if (isCurrentCreateDraftSession(session)) setDraftReadStatus('ready')
        return
      }

      let draft
      try {
        draft = await draftRepository.get(session.ownerId)
      } catch {
        if (!isCurrentCreateDraftSession(session)) return
        message.error('项目草稿读取失败')
        setDraftReadStatus('failed')
        return
      }

      if (!isCurrentCreateDraftSession(session)) return
      const restoredBid = typeof draft?.values.bid === 'string' ? draft.values.bid : ''
      if (restoredBid && !candidateProjectsRef.current.some(item => item.bid === restoredBid)) {
        try {
          await enqueueDraftMutation(() => (
            isCurrentCreateDraftSession(session)
              ? draftRepository.clear(session.ownerId)
              : Promise.resolve()
          ))
        } catch {
          if (isCurrentCreateDraftSession(session)) message.error('项目草稿清空失败')
        }
        if (!isCurrentCreateDraftSession(session)) return
      } else if (draft) {
        const restoredEntry = candidateProjectsRef.current.find(item => item.bid === restoredBid)
        const restoredClassification = mapIpmProjectClassification(
          restoredEntry?.ipmProjectCategoryName,
        )
        const restoredType = restoredClassification?.projectCategory || ''
        form.setFieldsValue({
          ...draft.values,
          type: restoredType || undefined,
          secondaryCategory: restoredClassification?.secondaryCategory,
        } as ProjectInfoFormState)
        lastAppliedSourceRef.current = `${restoredBid}::${restoredType}`
        const modalGroupKeys = new Set<string>(getProjectInfoModalGroups(restoredType).map(group => group.key))
        const restoredActiveGroups = draft.activeGroups.filter(groupKey => modalGroupKeys.has(groupKey))
        activeGroupsRef.current = restoredActiveGroups
        setActiveGroups(restoredActiveGroups)
      }

      if (isCurrentCreateDraftSession(session)) setDraftReadStatus('ready')
    }

    void hydrateDraft()

    return () => {
      if (currentCreateDraftSessionRef.current?.generation === session.generation) {
        invalidateCreateDraftSession()
      }
    }
  }, [draftHydrationAttempt, draftOwnerId, draftRepository, enqueueDraftMutation, form, invalidateCreateDraftSession, isCurrentCreateDraftSession, mode, open, resetCreateForm, setDraftReadStatus, startCreateDraftSession])

  const clearTypeFields = (type: string) => {
    const fieldNames = getProjectInfoFields(type).map(field => field.key)
    if (fieldNames.length) form.setFields(fieldNames.map(name => ({ name, value: undefined, errors: [] })))
  }

  const applySourceValues = (bid: string, nextType?: string) => {
    const entry = candidateProjects.find(item => item.bid === bid)
    if (!entry) return
    const sourceValues = fetchByBid(bid)
    const type = nextType || String(form.getFieldValue('type') || '')
    form.setFieldsValue({
      marketName: sourceValues.marketName || '',
      brand: sourceValues.brand || '',
      productLine: sourceValues.productLine || '',
      status: '待立项',
      technicalTrack: entry.technicalTrack || '',
      ipmProjectType: entry.ipmProjectCategoryName,
      ...(entry.ipmProjectCategoryName === '技术项目前置工作' ? {} : { preProjectId: undefined }),
    })
    if (isMachineProjectType(type)) {
      form.setFieldsValue(deriveMachineProjectInfoValues({ ...entry, ...sourceValues }))
    }
    if (type === 'tOS版本项目') {
      form.setFieldsValue({ newProductProjectList: '', legacyProductProjectList: '' })
    }
  }

  const handleCandidateChange = (bid: string) => {
    const entry = candidateProjects.find(item => item.bid === bid)
    if (!entry) return
    const classification = mapIpmProjectClassification(entry.ipmProjectCategoryName)
    const mappedType = classification?.projectCategory || ''
    const isMappedTos = mappedType === PROJECT_TYPE_TOS_VERSION
    const previousType = String(form.getFieldValue('type') || '')
    const previousFirstLaunchProjectIds = previousType === PROJECT_TYPE_TOS_VERSION
      && Array.isArray(form.getFieldValue('firstLaunchProjects'))
      ? (form.getFieldValue('firstLaunchProjects') as unknown[]).filter((item): item is string => typeof item === 'string')
      : []
    // Candidate-specific fields must never leak from the previously selected
    // external project. Source-derived values are reapplied immediately below.
    if (previousType) clearTypeFields(previousType)
    form.setFieldsValue({
      type: mappedType || undefined,
      secondaryCategory: classification?.secondaryCategory,
    })
    activeGroupsRef.current = mappedType
      ? getProjectInfoModalGroups(mappedType).map(group => group.key)
      : []
    setActiveGroups(activeGroupsRef.current)
    if (!classification) {
      message.error('该 IPM 项目分类尚未配置映射，请联系管理员维护')
    }
    applySourceValues(bid, mappedType)
    if (isMappedTos && previousFirstLaunchProjectIds.length > 0) {
      form.setFieldValue('firstLaunchProjects', previousFirstLaunchProjectIds)
      const aggregateResult = deriveTosProjectAggregates(previousFirstLaunchProjectIds, existingProjects, entry.name)
      form.setFieldsValue(aggregateResult.values)
      setAggregateWarnings(aggregateResult.missingSources)
    } else {
      setAggregateWarnings([])
    }
  }

  const handleInfoFieldChange = (fieldKey: string, value: ProjectInfoValues[string]) => {
    if (fieldKey !== 'firstLaunchProjects') return
    const selectedIds = Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
    const selectedEntry = candidateProjects.find(item => item.bid === form.getFieldValue('bid'))
    const projectName = mode === 'edit' ? project?.name || '' : selectedEntry?.name || ''
    const result = deriveTosProjectAggregates(selectedIds, existingProjects, projectName)
    form.setFieldsValue(result.values)
    setAggregateWarnings(result.missingSources)
  }

  const firstLaunchSignature = Array.isArray(watchedValues.firstLaunchProjects)
    ? watchedValues.firstLaunchProjects.join('|')
    : ''

  useEffect(() => {
    if (!open || mode !== 'create' || !watchedBid) return
    const sourceKey = `${watchedBid}::${projectType}`
    if (lastAppliedSourceRef.current === sourceKey) return
    const previousBid = lastAppliedSourceRef.current.split('::')[0]
    const selectedFirstLaunchIds = Array.isArray(form.getFieldValue('firstLaunchProjects'))
      ? (form.getFieldValue('firstLaunchProjects') as unknown[]).filter((item): item is string => typeof item === 'string')
      : []
    if (previousBid && previousBid !== watchedBid && projectType) clearTypeFields(projectType)
    applySourceValues(watchedBid, projectType)
    if (projectType === PROJECT_TYPE_TOS_VERSION && selectedFirstLaunchIds.length > 0) {
      const entry = candidateProjects.find(item => item.bid === watchedBid)
      const aggregateResult = deriveTosProjectAggregates(selectedFirstLaunchIds, existingProjects, entry?.name || '')
      form.setFieldsValue(aggregateResult.values)
      setAggregateWarnings(aggregateResult.missingSources)
    }
    lastAppliedSourceRef.current = sourceKey
  }, [candidateProjects, existingProjects, form, mode, open, projectType, watchedBid])

  useEffect(() => {
    if (!open || projectType !== PROJECT_TYPE_TOS_VERSION) return
    const selectedIds = firstLaunchSignature.split('|').filter(Boolean)
    const selectedEntry = candidateProjects.find(item => item.bid === watchedBid)
    const projectName = mode === 'edit' ? project?.name || '' : selectedEntry?.name || ''
    const result = deriveTosProjectAggregates(selectedIds, existingProjects, projectName)
    form.setFieldsValue(result.values)
    setAggregateWarnings(result.missingSources)
  }, [candidateProjects, existingProjects, firstLaunchSignature, form, mode, open, project, projectType, watchedBid])

  const machineProjectName = mode === 'edit'
    ? project?.name || ''
    : selectedCandidate?.name || ''
  const watchedFirstSaleTosVersion = String(watchedValues.firstSaleTosVersion || '')

  useEffect(() => {
    if (!open || !isMachineProjectType(projectType) || !machineProjectName) {
      setMachineFamilyError('')
      return
    }
    if (!isLegacyMachine) {
      const normalizedFirstSale = normalizeTosEnumReference(watchedFirstSaleTosVersion)
      if (!normalizedFirstSale) {
        setMachineFamilyError('')
        return
      }
      const existingProject = existingProjects.find(item => item.id === project?.id)
      const candidate = {
        ...(existingProject || project || {}),
        id: mode === 'edit' ? project?.id || '' : `create:${machineProjectName}`,
        name: machineProjectName,
        type: projectType,
        productType: '新品',
        firstSaleTosVersionId: normalizedFirstSale,
        firstSaleTosVersion: normalizedFirstSale,
      }
      const resolution = resolveMachineTosUpdate(existingProjects, candidate)
      if (!resolution.ok) {
        setMachineFamilyError(resolution.reason === 'duplicate-new-product'
          ? '已存在项目名完全相同的新品项目，不能重复创建或保存'
          : 'tOS 版本必须是严格的三段数字，例如 14.0.0')
        return
      }
      setMachineFamilyError('')
      const resolvedCurrent = mode === 'create'
        ? normalizedFirstSale
        : resolution.candidate.currentTosVersion
      if (form.getFieldValue('currentTosVersion') !== resolvedCurrent) {
        form.setFieldValue('currentTosVersion', resolvedCurrent)
      }
      return
    }

    const familyName = normalizeMachineFamilyName(machineProjectName)
    const matchingNewProjects = existingProjects.filter(item => {
      if (item.id === project?.id || !isMachineProjectType(item.type)) return false
      const values = buildProjectInfoValues(item, ['productType'])
      return values.productType === '新品'
        && normalizeMachineFamilyName(item.name) === familyName
    })
    if (matchingNewProjects.length !== 1) {
      form.setFieldValue('firstSaleTosVersion', '')
      setMachineFamilyError(matchingNewProjects.length === 0
        ? '未找到项目名完全相同的新品项目，无法继承首销 tOS 版本'
        : '找到多个项目名完全相同的新品项目，无法确定首销 tOS 版本来源')
      return
    }
    const inheritedValues = buildProjectInfoValues(matchingNewProjects[0], ['firstSaleTosVersion'])
    form.setFieldValue(
      'firstSaleTosVersion',
      normalizeTosEnumReference(inheritedValues.firstSaleTosVersion),
    )
    setMachineFamilyError('')
  }, [existingProjects, form, isLegacyMachine, machineProjectName, mode, open, project?.id, projectType, watchedFirstSaleTosVersion])

  const persistCreateDraft = useCallback(async (session: ProjectCreationDraftSession) => {
    if (draftReadStatusRef.current !== 'ready' || !isCurrentCreateDraftSession(session)) return

    const values = form.getFieldsValue(true) as ProjectInfoFormState
    const activeGroupsSnapshot = activeGroupsRef.current
    await enqueueDraftMutation(() => {
      if (draftReadStatusRef.current !== 'ready' || !isCurrentCreateDraftSession(session)) {
        return Promise.resolve()
      }
      if (isProjectCreationDraftEmpty(values)) return draftRepository.clear(session.ownerId)
      return draftRepository.save({
        schemaVersion: PROJECT_CREATION_DRAFT_SCHEMA_VERSION,
        ownerId: session.ownerId,
        values,
        activeGroups: activeGroupsSnapshot,
        updatedAt: new Date().toISOString(),
      })
    })
  }, [draftRepository, enqueueDraftMutation, form, isCurrentCreateDraftSession])

  useEffect(() => {
    if (!open || mode !== 'create' || !draftOwnerId || draftReadStatus !== 'ready' || submitting) return

    const session = currentCreateDraftSessionRef.current
    if (!session) return
    cancelDraftSave()
    draftSaveTimerRef.current = setTimeout(() => {
      draftSaveTimerRef.current = null
      void persistCreateDraft(session).catch(() => {
        if (isCurrentCreateDraftSession(session)) message.error('项目草稿自动保存失败')
      })
    }, PROJECT_CREATION_DRAFT_SAVE_DELAY_MS)

    return cancelDraftSave
  }, [activeGroups, cancelDraftSave, draftOwnerId, draftReadStatus, isCurrentCreateDraftSession, mode, open, persistCreateDraft, submitting, watchedValues])

  const requestClose = async () => {
    if (mode === 'create') {
      if (submitting) return
      if (draftReadStatusRef.current === 'loading' || draftReadStatusRef.current === 'idle') {
        return
      }
      if (currentCreateDraftSessionRef.current?.ownerId !== (draftOwnerId || '')) return
      const session = startCreateDraftSession(draftOwnerId || '')
      if (draftReadStatusRef.current !== 'ready' || !draftOwnerId) {
        if (isCurrentCreateDraftSession(session)) onCancel()
        return
      }
      try {
        await persistCreateDraft(session)
        if (isCurrentCreateDraftSession(session)) onCancel()
      } catch {
        if (isCurrentCreateDraftSession(session)) message.error('项目草稿自动保存失败')
      }
      return
    }

    if (!form.isFieldsTouched()) {
      onCancel()
      return
    }
    Modal.confirm({
      title: '放弃本次填写？',
      content: '关闭后，本次未保存的内容将丢失。',
      okText: '放弃',
      cancelText: '继续填写',
      okButtonProps: { danger: true },
      onOk: onCancel,
    })
  }

  const clearAndResetCreateDraft = useCallback(async () => {
    if (mode !== 'create' || !draftOwnerId) return

    const previousReadStatus = draftReadStatusRef.current
    const session = startCreateDraftSession(draftOwnerId)
    setDraftReadStatus('loading')
    try {
      await enqueueDraftMutation(() => draftRepository.clear(session.ownerId))
    } catch (error) {
      if (!isCurrentCreateDraftSession(session)) return
      setDraftReadStatus(previousReadStatus)
      message.error('项目草稿清空失败')
      throw error
    }
    if (!isCurrentCreateDraftSession(session)) return
    resetCreateForm()
    setDraftReadStatus('ready')
  }, [draftOwnerId, draftRepository, enqueueDraftMutation, isCurrentCreateDraftSession, mode, resetCreateForm, setDraftReadStatus, startCreateDraftSession])

  const requestResetCreateDraft = () => {
    if (mode !== 'create' || !draftOwnerId || isDraftInteractionLocked) return

    Modal.confirm({
      title: '重新填写？',
      content: '将清空当前已填写并自动保存的全部内容，此操作不可撤销。',
      okText: '确认清空',
      cancelText: '继续填写',
      okButtonProps: { danger: true },
      onOk: clearAndResetCreateDraft,
    })
  }

  const clearSubmittedCreateDraft = useCallback(async (session: ProjectCreationDraftSession) => {
    await enqueueDraftMutation(() => {
      const currentSession = currentCreateDraftSessionRef.current
      if (!shouldClearSubmittedProjectCreationDraft(session, currentSession)) {
        return Promise.resolve()
      }
      return draftRepository.clear(session.ownerId)
    })
  }, [draftRepository, enqueueDraftMutation])

  const handleSubmit = async () => {
    if (isCreateDraftInteractionBlocked) return
    if (!tryBeginSubmit()) return
    setSubmitting(true)
    try {
    const selectedBid = String(form.getFieldValue('bid') || '')
    const sourceEntry = mode === 'create'
      ? candidateProjects.find(item => item.bid === selectedBid)
      : undefined
    const ipmClassification = sourceEntry
      ? mapIpmProjectClassification(sourceEntry.ipmProjectCategoryName)
      : undefined
    if (mode === 'create' && sourceEntry && !ipmClassification) {
      const mappingMessage = '该 IPM 项目分类尚未配置映射，请联系管理员维护'
      form.setFields([
        { name: 'type', value: undefined, errors: [mappingMessage] },
        { name: 'secondaryCategory', value: undefined, errors: [mappingMessage] },
      ])
      message.error(mappingMessage)
      return
    }
    let values: ProjectInfoFormState
    try {
      await form.validateFields()
      values = form.getFieldsValue(true) as ProjectInfoFormState
    } catch (error) {
      const failed = error as { errorFields?: Array<{ name: Array<string | number> }> }
      const firstName = String(failed.errorFields?.[0]?.name?.[0] || '')
      const firstField = fields.find(field => field.key === firstName)
      if (firstField) setActiveGroups(previous => [...new Set([...previous, firstField.group])])
      if (firstName) setTimeout(() => form.scrollToField(firstName, { block: 'center' }), 0)
      return
    }

    const normalizedProjectType = mode === 'create'
      ? ipmClassification?.projectCategory || ''
      : normalizeMachineProjectType(projectType)
    const projectSecondaryCategory = mode === 'create'
      ? ipmClassification?.secondaryCategory || ''
      : String(values.secondaryCategory || '')
    if (!normalizedProjectType || !projectSecondaryCategory) {
      message.error('项目分类和项目二级分类均为必填项')
      return
    }
    const infoValues = normalizedProjectType === PROJECT_CATEGORY_TECH
      ? normalizeTechnicalProjectValues(values as Record<string, unknown>) as ProjectInfoValues
      : getProjectInfoModalSubmitValues(normalizedProjectType, values)
    if (normalizedProjectType === PROJECT_CATEGORY_TECH) {
      try {
        validateTechnicalProject({
          ...infoValues,
          type: (sourceEntry?.ipmProjectCategoryName || String(values.ipmProjectType || project?.ipmProjectType || '')) === '技术项目前置工作'
            ? '技术项目前置工作'
            : 'tdt',
          deliverables: {
            projectKpi: infoValues.projectKpi,
            conceptDesign: infoValues.conceptDesign,
            charterReport: infoValues.charterReport,
            pdcpReport: infoValues.pdcpReport,
            tdcpReport: infoValues.tdcpReport,
            edcpReport: infoValues.edcpReport,
          },
        })
      } catch (error) {
        const field = error instanceof TechnicalProjectValidationError
          ? error.fieldKey
          : error instanceof Error ? error.message : 'technicalProject'
        const labels: Record<string, string> = { technicalLead: '技术项目负责人', tmg: 'TMG 及技术领域', subdomain: '子领域', preProjectId: '前置项目', projectYear: '项目年份', deliverable: '交付物' }
        const deliverableLabel = TECHNICAL_DELIVERABLE_FIELDS.find(item => item.key === field)?.label
        message.error(`请检查${labels[field] || deliverableLabel || '技术项目信息'}`)
        if (field !== 'deliverable') {
          form.setFields([{ name: field, errors: [`请填写有效的${deliverableLabel || labels[field] || '字段值'}`] }])
          form.scrollToField(field, { block: 'center' })
        }
        return
      }
    }
    if (isMachineProjectType(normalizedProjectType) && machineFamilyError) {
      form.setFields([{ name: 'firstSaleTosVersion', errors: [machineFamilyError] }])
      setActiveGroups(previous => [...new Set([...previous, 'basic'])])
      setTimeout(() => form.scrollToField('firstSaleTosVersion', { block: 'center' }), 0)
      message.error(machineFamilyError)
      return
    }
    const editableFieldKeys = new Set(editableFields.map(field => field.key))
    const editableErrors = validateProjectInfoValues(
      normalizedProjectType,
      infoValues,
      {
        fieldKeys: editableFieldKeys,
        tosAggregateMissingSources: aggregateWarnings,
        validateRequiredOnCreate: mode === 'create',
      },
    )
    if (editableErrors.length) {
      const first = editableErrors[0]
      form.setFields(editableErrors.map(error => ({ name: error.fieldKey, errors: [error.message] })))
      setActiveGroups(previous => [...new Set([...previous, first.groupKey])])
      setTimeout(() => form.scrollToField(first.fieldKey, { block: 'center' }), 0)
      message.error(first.message)
      return
    }

    const projectName = mode === 'edit' ? project?.name || '' : sourceEntry?.name || ''
    if (!projectName) {
      message.error('未找到项目名称')
      return
    }
    const submitSession = mode === 'create' ? currentCreateDraftSessionRef.current : null
    if (mode === 'create' && (
      !submitSession
      || draftReadStatusRef.current !== 'ready'
      || !isCurrentCreateDraftSession(submitSession)
    )) return

    cancelDraftSave()
      const submitResult = await onSubmit({
        bid: values.bid,
        projectName,
        projectType: normalizedProjectType,
        projectSecondaryCategory,
        responsiblePersons: deriveProjectResponsiblePersons(
          normalizedProjectType,
          infoValues,
          Array.isArray(values.responsiblePersons) ? values.responsiblePersons : [],
        ),
        healthStatus: String(values.healthStatus || 'normal'),
        infoValues,
        sourceEntry,
        sourceValues: values.bid ? fetchByBid(values.bid) : {},
      })
      if (submitResult === false) return
      if (mode === 'edit' && project?.id) {
        if (normalizedProjectType === PROJECT_CATEGORY_TECH) {
          syncTechnicalTeamPermissionMembers(project.id)
        } else if (normalizedProjectType === PROJECT_TYPE_TOS_VERSION) {
          syncTosTeamPermissionMembers(project.id)
        }
      }
      if (mode === 'create' && submitSession) {
        let draftClearFailed = false
        try {
          await clearSubmittedCreateDraft(submitSession)
        } catch {
          message.error('项目草稿清空失败')
          draftClearFailed = true
        }
        if (!isCurrentCreateDraftSession(submitSession)) return
        if (!draftClearFailed) {
          resetCreateForm()
          setDraftReadStatus('ready')
        }
        onCancel()
        onAfterCreate?.()
        return
      }
      if (componentMountedRef.current) {
        if (mode === 'create') resetCreateForm()
        else form.resetFields()
      }
    } finally {
      if (componentMountedRef.current) setSubmitting(false)
      releaseSubmission()
    }
  }

  return (
    <Modal
      title={mode === 'create' ? (
        <div className="pms-project-info-modal-title-row">
          <span>新增项目</span>
          <Button type="text" danger size="small" icon={<ReloadOutlined />} disabled={isDraftInteractionLocked} onClick={requestResetCreateDraft}>
            重新填写
          </Button>
        </div>
      ) : '编辑项目信息'}
      open={open}
      width={1240}
      onCancel={requestClose}
      onOk={handleSubmit}
      closable={!isDraftInteractionLocked}
      mask={{ closable: !isDraftInteractionLocked }}
      keyboard={!isDraftInteractionLocked}
      okText={mode === 'create' ? '创建' : '保存'}
      cancelText="取消"
      confirmLoading={submitting || isDraftHydrating}
      cancelButtonProps={{ disabled: isDraftInteractionLocked }}
      okButtonProps={{ disabled: isCreateDraftInteractionBlocked || isIpmClassificationMissing }}
      destroyOnHidden
      className="pms-modal pms-project-info-modal"
      styles={{ body: { maxHeight: '72vh', overflowY: 'auto', paddingRight: 24 } }}
    >
      {isCreateDraftReadFailed && (
        <Alert
          type="error"
          showIcon
          title="项目草稿读取失败"
          description="已保存的内容暂时无法恢复，当前填写和自动保存已暂停。"
          action={<Button size="small" onClick={retryCreateDraftHydration}>重新读取</Button>}
          style={{ marginBottom: 16 }}
        />
      )}
      <Spin spinning={isDraftInteractionLocked} description={draftInteractionDescription}>
      <Form
        form={form}
        layout="vertical"
        disabled={isCreateDraftInteractionBlocked}
        onValuesChange={(changedValues) => {
          if (typeof changedValues.bid === 'string') handleCandidateChange(changedValues.bid)
          if (changedValues.firstLaunchProjects !== undefined) {
            handleInfoFieldChange('firstLaunchProjects', changedValues.firstLaunchProjects)
          }
        }}
      >
        <div className="pms-project-info-form-grid pms-project-info-universal">
          {mode === 'create' ? (
            <Form.Item label="项目名" name="bid" rules={[{ required: true, message: '请选择项目名' }]}>
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="搜索并选择项目"
                options={candidateProjects.map(item => ({ label: `${item.name}（${item.bid}）`, value: item.bid }))}
              />
            </Form.Item>
          ) : (
            <Form.Item label="项目名" name="projectName"><Input disabled /></Form.Item>
          )}
          <Form.Item label="项目分类" name="type" rules={[{ required: true, message: '请选择项目分类' }]}>
            <Select disabled options={PROJECT_TYPES.map(type => ({ label: type, value: type }))} />
          </Form.Item>
          <Form.Item label="项目二级分类" name="secondaryCategory" rules={[{ required: true, message: '请选择项目二级分类' }]}>
            <Select disabled options={secondaryCategoryOptions} />
          </Form.Item>
          {projectType !== PROJECT_TYPE_TOS_VERSION && !isMachineProjectType(projectType) && !isTechnicalProject && (
            <Form.Item label="项目责任人" name="responsiblePersons" extra="负责项目可见范围，并作为权限中心的系统管理员" rules={[{ required: true, type: 'array', min: 1, message: '请选择项目责任人' }]}>
              <Select mode="multiple" showSearch optionFilterProp="label" options={ALL_USERS.map(user => ({ label: user, value: user }))} />
            </Form.Item>
          )}
          {isTargetProjectInfoType(projectType) && (
            <Form.Item label="健康状态" name="healthStatus" initialValue="normal" rules={[{ required: true, message: '请选择健康状态' }]}>
              <Select options={HEALTH_OPTIONS} />
            </Form.Item>
          )}
        </div>

        {projectType !== PROJECT_TYPE_TOS_VERSION && aggregateWarnings.length > 0 && (
          <Alert type="warning" showIcon style={{ marginBottom: 12 }} title="首发项目来源字段不完整" description={aggregateWarnings.join('；')} />
        )}

        {machineFamilyError && (
          <Alert type="error" showIcon style={{ marginBottom: 12 }} title="tOS 版本联动失败" description={machineFamilyError} />
        )}

        {isTechnicalProject && (
          <TechnicalProjectCreateFields
            form={form}
            existingProjects={existingProjects}
            currentProjectId={project?.id}
            ipmProjectType={mode === 'create' ? selectedCandidate?.ipmProjectCategoryName || '' : String(watchedValues.ipmProjectType || project?.fieldValues?.ipmProjectType || project?.ipmProjectType || '')}
            technicalTrack={mode === 'create' ? selectedCandidate?.technicalTrack || '' : String(watchedValues.technicalTrack || project?.fieldValues?.technicalTrack || '')}
          />
        )}

        {groups.length > 0 && (
          <Collapse
            className="pms-project-info-form-groups"
            activeKey={activeGroups}
            onChange={(keys) => {
              if (isCreateDraftInteractionBlocked) return
              const nextActiveGroups = keys as string[]
              activeGroupsRef.current = nextActiveGroups
              setActiveGroups(nextActiveGroups)
            }}
            items={groups.map(group => {
              const groupFields = editableFields.filter(field => field.group === group.key)
              return {
                key: group.key,
                label: <Space><span className="pms-project-info-group-dot" style={{ background: GROUP_COLORS[group.key] }} /><strong>{group.label}</strong><Tag>{groupFields.length} 项</Tag></Space>,
                children: (
                  <div className="pms-project-info-form-grid">
                    {groupFields.map(field => {
                      const active = !field.visibleWhen || field.visibleWhen(watchedValues)
                      if (!active) return null
                      const isRequired = mode === 'create' ? field.requiredOnCreate : field.required
                      const renderedField = field.key === 'firstSaleTosVersion'
                        ? { ...field, readOnly: isLegacyMachine }
                        : field.key === 'currentTosVersion'
                          ? { ...field, readOnly: !isLegacyMachine }
                          : field
                      return (
                        <Form.Item
                          key={field.key}
                          label={field.label}
                          name={field.key}
                          extra={field.conditionalHint}
                          className={field.inputType === 'jira' ? 'pms-project-info-form-span' : undefined}
                          rules={isRequired
                            ? [{ required: true, message: `请填写${field.label}` }]
                            : undefined}
                        >
                          <ProjectInfoFieldInput
                            field={renderedField}
                            firstLaunchProjectOptions={firstLaunchOptions}
                            optionsOverride={isMachineProjectType(projectType) ? fieldOptionOverrides?.[field.key] : undefined}
                          />
                        </Form.Item>
                      )
                    })}
                  </div>
                ),
              }
            })}
          />
        )}
      </Form>
      </Spin>
    </Modal>
  )
}
