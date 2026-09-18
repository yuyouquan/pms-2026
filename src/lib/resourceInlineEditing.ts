import dayjs from 'dayjs'
import type { ResourceProject, ResourceVersion } from '@/components/project-resources/resourceVersionAdapter'
import type { HrProjectCategory } from '@/lib/hrFormalProjectSource'
import { resolveHrFormalSource } from '@/lib/hrFormalProjectSource'
import type { ConfigRecord } from '@/types/hrConfig'
import type { NonLaborInvestment } from '@/types/nonLaborInvestment'
import { MILESTONE_FIELDS } from '@/constants/hrMachine'
import { TECH_MILESTONE_FIELDS, TECH_PHASE_INVESTMENT_FIELDS } from '@/constants/hrTechnical'
import { TOS_MILESTONE_FIELDS, TOS_PHASE_INVESTMENT_FIELDS } from '@/constants/hrTos'
import { calcEstimatedInvestment, getAvailableHrModelSelection, isHrModelAvailable } from '@/constants/hrConfig'
import { canEditHrInScope, getHrRegistryProject, isHrFormalRecord } from '@/lib/hrProjectRegistry'
import { canCreateHrVersion, getHrVersionSeed, isHrBatch, isHrVersionEditable, nextHrMinorVersion } from '@/lib/hrVersionRules'
import { HR_MANUAL_MILESTONE_KEYS, mergeHrFormalMilestones } from '@/lib/hrMilestoneOwnership'
import { cloneNonLaborInvestment, nonLaborDepartmentPairs, nonLaborItemKey, validateNonLaborInvestment } from '@/lib/nonLaborInvestment'
import { withMachineDerivedMilestones } from '@/lib/hrMachinePeriods'
import { normalizeHrEditedVersion } from '@/lib/hrProjectSync'
import { PRODUCT_LINES_BY_BRAND } from '@/lib/roadmapValidation'
import { useProjectStore } from '@/stores/project'
import { createHrDepartmentOptions, type HrDepartmentOptions } from '@/lib/hrDepartments'
import { useHrTosStore } from '@/stores/hrTos'
import { useHrTechnicalStore } from '@/stores/hrTechnical'
import { useHrCapabilityStore } from '@/stores/hrCapability'

export const resourceMilestoneFields = { machine: MILESTONE_FIELDS, tos: TOS_MILESTONE_FIELDS, technical: TECH_MILESTONE_FIELDS,
  capability: [{ key: 'projectStartTime', label: '项目开始时间' }, { key: 'projectEndTime', label: '项目结束时间' }] }
export const resourcePhaseFields = { machine: [], tos: TOS_PHASE_INVESTMENT_FIELDS, technical: TECH_PHASE_INVESTMENT_FIELDS,
  capability: [{ key: 'estimatedInvestment', label: '预估投入（人月）' }] }
export type InlineDepartment = { id: string; primaryDepartment: string; secondaryDepartment: string; estimatedInvestment: number; [key: string]: string | number }
export type ResourceInlinePatch =
  | { type: 'batch'; value: number | null }
  | { type: 'milestone'; key: string; value: string | null }
  | { type: 'model'; key: 'projectLevel' | 'hrModelVersion' | 'levelCoefficient'; value: string | number }
  | { type: 'metadata'; key: 'brand' | 'productLine' | 'marketName'; value: string }
  | { type: 'departments'; rows: InlineDepartment[]; complete?: boolean }
  | { type: 'nonLabor'; value: NonLaborInvestment }
export interface ResourceInlineActions {
  createVersionInline: (projectId: string, budgetType: 'annual' | 'projectEstimate' | 'projectBudget', scopeId: string) => string
  updateVersionInline: (projectId: string, versionId: string, patch: ResourceInlinePatch, scopeId: string) => void
}
type Config = Record<string, ConfigRecord[]>
const uid = () => `inline-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
export const canEditResourceMilestone = (category: HrProjectCategory, project: ResourceProject, key: string) =>
  !(category === 'machine' && key === 'str5Plus6Months') && (category === 'capability' || !isHrFormalRecord(project) || HR_MANUAL_MILESTONE_KEYS[category].includes(key))

/** Incomplete pairs are persisted only here; canonical modal/import validation stays strict. */
export function validateInlineNonLabor(value: NonLaborInvestment, previous: NonLaborInvestment | undefined, config: Config) {
  const result = cloneNonLaborInvestment(value)
  const subjects = config.nonLaborSubject ?? [], pairs = nonLaborDepartmentPairs(config.techModuleDept ?? [])
  const ids = new Set<string>(), keys = new Set<string>()
  for (const item of result.items) {
    for (const key of ['secondaryDepartment', 'tertiaryDepartment', 'secondarySubject', 'tertiarySubject'] as const) item[key] = item[key].trim()
    if (!item.id || ids.has(item.id)) throw new Error('非人力投入行标识重复')
    ids.add(item.id)
    const old = previous?.items.find(row => row.id === item.id)
    const retainedDepartment = old?.secondaryDepartment === item.secondaryDepartment && old?.tertiaryDepartment === item.tertiaryDepartment
    if ((item.secondaryDepartment || item.tertiaryDepartment) && !retainedDepartment && !pairs.some(row => row.secondaryDepartment === item.secondaryDepartment && (!item.tertiaryDepartment || row.tertiaryDepartment === item.tertiaryDepartment))) throw new Error('请选择有效的二级部门和对应三级部门')
    const retainedSubject = old?.subjectId === item.subjectId && old?.secondarySubject === item.secondarySubject && old?.tertiarySubject === item.tertiarySubject
    if ((item.secondarySubject || item.tertiarySubject || item.subjectId) && !retainedSubject && !subjects.some(row => row.enabled !== false && row.secondarySubject === item.secondarySubject && (!item.tertiarySubject && !item.subjectId || row.tertiarySubject === item.tertiarySubject && row.id === item.subjectId))) throw new Error('请选择有效的二级科目和对应三级科目')
    if ([item.secondaryDepartment, item.tertiaryDepartment, item.secondarySubject, item.tertiarySubject].every(Boolean)) {
      const key = nonLaborItemKey(item)
      if (keys.has(key)) throw new Error('同一版本中的二级部门、三级部门、二级科目和三级科目组合不能重复')
      keys.add(key)
      validateNonLaborInvestment({ ...result, items: [item] }, subjects, previous, config.techModuleDept ?? [])
    }
    for (const [month, amount] of Object.entries(item.monthlyAmounts)) {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('费用投入月份格式不正确')
      if (!Number.isFinite(amount) || amount < 0 || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.000001) throw new Error('非人力投入金额必须为非负数，最多保留两位小数')
    }
  }
  return result
}
export function validateInlineDepartments(category: HrProjectCategory, rows: InlineDepartment[], complete = false, options?: HrDepartmentOptions): InlineDepartment[] {
  const ids = new Set<string>(), pairs = new Set<string>()
  return rows.map(row => {
    const next: InlineDepartment = { ...row, primaryDepartment: row.primaryDepartment.trim(), secondaryDepartment: row.secondaryDepartment.trim() }
    if (!row.id || ids.has(row.id)) throw new Error('部门行标识重复')
    ids.add(row.id)
    if (options && (next.primaryDepartment || next.secondaryDepartment) && (!options.primaryOptions.some(option => option.value === next.primaryDepartment) || next.secondaryDepartment && !options.isValidPair(next.primaryDepartment, next.secondaryDepartment))) throw new Error('请选择有效的一级部门和对应二级部门')
    if (complete && (!next.primaryDepartment || !next.secondaryDepartment)) throw new Error('请填写一级部门和二级部门')
    if (next.primaryDepartment && next.secondaryDepartment) {
      const pair = JSON.stringify([next.primaryDepartment, next.secondaryDepartment])
      if (pairs.has(pair)) throw new Error('一级部门和二级部门组合不能重复')
      pairs.add(pair)
    }
    let total = 0
    for (const field of resourcePhaseFields[category]) {
      const value = next[field.key] ?? 0
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || Math.abs(value * 10 - Math.round(value * 10)) > 0.000001) throw new Error('人力投入必须为非负数，最多保留一位小数')
      next[field.key] = value
      total += value
    }
    next.estimatedInvestment = Math.round(total * 10) / 10
    return next
  })
}
export function createInlineResourceVersion(category: HrProjectCategory, project: ResourceProject | undefined, budgetType: 'annual' | 'projectEstimate' | 'projectBudget', scopeId: string, config: Config): ResourceVersion {
  if (!project || !scopeId || !canEditHrInScope(project, scopeId) || !canCreateHrVersion(project, budgetType)) throw new Error('当前项目不可创建版本')
  const seed = getHrVersionSeed<ResourceVersion>(project.versions, budgetType)
  const source = resolveHrFormalSource(category, project.ipmProjectCode, project.pmsProjectId)
  const minorVersion = nextHrMinorVersion(project.versions, budgetType)
  const common = { id: uid(), projectId: project.id, budgetType, versionNumber: `V0.${minorVersion}`, majorVersion: 0, minorVersion, batch: null,
    lockState: 'unlocked' as const, isActive: false, createdBy: useProjectStore.getState().currentLoginUser, createdAt: new Date().toISOString(), lockedAt: null,
    nonLaborInvestment: cloneNonLaborInvestment(seed?.nonLaborInvestment), estimatedInvestment: 0, operationLogs: [] }
  let version: ResourceVersion
  if (category === 'capability') {
    version = { ...common, projectStartTime: seed && 'projectStartTime' in seed ? seed.projectStartTime : '', projectEndTime: seed && 'projectEndTime' in seed ? seed.projectEndTime : '', departmentInvestments: seed && 'departmentInvestments' in seed ? seed.departmentInvestments.map(row => ({ ...row })) : [] }
  } else {
    const dates = { ...Object.fromEntries(resourceMilestoneFields[category].map(field => [field.key, null])), ...(seed && 'milestones' in seed ? seed.milestones : {}) }
    const milestones = isHrFormalRecord(project) ? mergeHrFormalMilestones(category, source.milestones, dates) : dates
    if (category === 'machine') {
      const selection = getAvailableHrModelSelection(config.hrModel ?? [], { projectLevel: isHrFormalRecord(project) ? source.projectLevel : seed && 'projectLevel' in seed ? seed.projectLevel : '', hrModelVersion: seed && 'hrModelVersion' in seed ? seed.hrModelVersion : '' })
      if (isHrFormalRecord(project)) selection.projectLevel = source.projectLevel
      if (!isHrModelAvailable(config.hrModel ?? [], selection.projectLevel, selection.hrModelVersion)) throw new Error('请选择有效的项目等级与人力模型版本')
      const levelCoefficient = seed && 'levelCoefficient' in seed ? seed.levelCoefficient : 1
      version = { ...common, ...selection, levelCoefficient, milestones: withMachineDerivedMilestones(milestones), modelSnapshot: (config.hrModel ?? []).filter(row => row.enabled !== false && String(row.projectLevel) === selection.projectLevel && String(row.modelVersion) === selection.hrModelVersion).map(row => ({ ...row })), estimatedInvestment: calcEstimatedInvestment(config.hrModel ?? [], selection.projectLevel, selection.hrModelVersion, levelCoefficient) } as unknown as ResourceVersion
    } else version = { ...common, milestones, departmentInvestments: seed && 'departmentInvestments' in seed ? seed.departmentInvestments.map(row => ({ ...row })) : [] } as unknown as ResourceVersion
  }
  if ('departmentInvestments' in version) version.estimatedInvestment = Math.round(version.departmentInvestments.reduce((sum, row) => sum + row.estimatedInvestment, 0) * 10) / 10
  return normalizeHrEditedVersion(version, category)
}
export function updateInlineResourceVersion(category: HrProjectCategory, project: ResourceProject | undefined, version: ResourceVersion | undefined, patch: ResourceInlinePatch, scopeId: string, config: Config): ResourceVersion {
  if (!project || !version || !scopeId || !canEditHrInScope(project, scopeId) || !isHrVersionEditable(project, version)) throw new Error('当前版本不可编辑')
  let next = { ...version }
  if (patch.type === 'batch') {
    if (patch.value !== null && !isHrBatch(patch.value)) throw new Error('请选择有效批次')
    next.batch = patch.value
  } else if (patch.type === 'milestone') {
    if (!resourceMilestoneFields[category].some(field => field.key === patch.key) || !canEditResourceMilestone(category, project, patch.key)) throw new Error('该日期由来源计划维护，不可编辑')
    if (patch.value && (!/^\d{4}-\d{2}-\d{2}$/.test(patch.value) || !dayjs(patch.value).isValid() || dayjs(patch.value).format('YYYY-MM-DD') !== patch.value)) throw new Error('请选择有效日期')
    if ('projectStartTime' in next) Object.assign(next, { [patch.key]: patch.value ?? '' })
    else next.milestones = { ...next.milestones, [patch.key]: patch.value }
    const dates = ('projectStartTime' in next ? next : next.milestones) as unknown as Record<string, string | null>
    let previous: string | null = null
    for (const field of resourceMilestoneFields[category]) {
      if (field.key === 'str5Plus6Months') continue
      const date = dates[field.key]
      if (date && previous && date < previous) throw new Error('结束时间不能早于开始时间，请检查里程碑顺序')
      if (date) previous = date
    }
    if (category === 'machine' && 'milestones' in next) next.milestones = withMachineDerivedMilestones(next.milestones)
  } else if (patch.type === 'model') {
    if (!('hrModelVersion' in next) || patch.key === 'projectLevel' && isHrFormalRecord(project)) throw new Error('项目等级由来源项目维护')
    Object.assign(next, { [patch.key]: patch.value })
    if (!Number.isFinite(next.levelCoefficient) || next.levelCoefficient < 0 || Math.abs(next.levelCoefficient * 100 - Math.round(next.levelCoefficient * 100)) > 0.000001 || !isHrModelAvailable(config.hrModel ?? [], next.projectLevel, next.hrModelVersion)) throw new Error('请选择有效的项目等级、人力模型版本号和等级系数')
    next.modelSnapshot = (config.hrModel ?? []).filter(row => row.enabled !== false && String(row.projectLevel) === next.projectLevel && String(row.modelVersion) === next.hrModelVersion).map(row => ({ ...row }))
    next.estimatedInvestment = calcEstimatedInvestment(next.modelSnapshot, next.projectLevel, next.hrModelVersion, next.levelCoefficient)
  } else if (patch.type === 'departments') {
    if (!('departmentInvestments' in next)) throw new Error('整机部门投入由模型计算')
    next.departmentInvestments = validateInlineDepartments(category, patch.rows, patch.complete, createHrDepartmentOptions(Object.values(config).flat(), [useHrTosStore.getState().projects, useHrTechnicalStore.getState().projects, useHrCapabilityStore.getState().projects])) as unknown as typeof next.departmentInvestments
    next.estimatedInvestment = Math.round(next.departmentInvestments.reduce((sum, row) => sum + row.estimatedInvestment, 0) * 10) / 10
  } else if (patch.type === 'nonLabor') next.nonLaborInvestment = validateInlineNonLabor(patch.value, version.nonLaborInvestment, config)
  else if (patch.type === 'metadata') {
    const canonical = getHrRegistryProject(project)
    if (category !== 'machine' || !canonical || isHrFormalRecord(project) || canonical.boundFormalProjectId) throw new Error('项目信息由来源项目维护')
    const metadata = { brand: canonical.brand ?? '', productLine: canonical.productLine ?? '', marketName: canonical.marketName ?? '', [patch.key]: patch.value.trim() }
    if (patch.key === 'brand' && metadata.brand !== canonical.brand) metadata.productLine = ''
    const lines = PRODUCT_LINES_BY_BRAND[metadata.brand as keyof typeof PRODUCT_LINES_BY_BRAND]
    if (metadata.brand && !lines && metadata.brand !== canonical.brand || metadata.productLine && !(lines as readonly string[] | undefined)?.includes(metadata.productLine) && !(metadata.brand === canonical.brand && metadata.productLine === canonical.productLine)) throw new Error('请选择有效的品牌和对应产品线')
    if (!useProjectStore.getState().updateProject(canonical.id, previous => ({ ...previous, ...metadata, fieldValues: { ...previous.fieldValues, ...metadata } }))) throw new Error('项目信息保存失败，请检查字段或编辑权限')
  }
  if ('operationLogs' in next) next.operationLogs = [...next.operationLogs, { id: uid(), operation: 'edited', operator: useProjectStore.getState().currentLoginUser, timestamp: new Date().toISOString(), description: '行内更新版本信息' }]
  return normalizeHrEditedVersion(next, category)
}
