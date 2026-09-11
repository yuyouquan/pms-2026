import { roundHrMonthlyAllocation } from '@/lib/hrMonthlyRounding'
/* ── HR Pipeline Configuration Center Constants ─────────────────────── */

import type { ConfigModuleMeta, ConfigModuleKey, ConfigRecord } from '@/types/hrConfig'
import type { MilestoneNodes } from '@/types/hrMachine'
import type { TosMilestoneNodes, TosDepartmentInvestment, TosPhaseKey } from '@/types/hrTos'
import type { TechMilestoneNodes, TechDepartmentInvestment, TechPhaseKey } from '@/types/hrTechnical'

/* ── 模块元信息 & 列定义 ───────────────────────────────────────────── */

export const CONFIG_MODULES: ConfigModuleMeta[] = [
  /* ── 整机产品 ── */
  {
    key: 'hrModel',
    label: '整机人力模型',
    category: '整机产品',
    description: '配置项目等级对应的人力模型版本及各阶段投入比例',
    columns: [
      { key: 'projectLevel', label: '项目等级', width: 100, editable: true, inputType: 'select', options: [
        { value: 'S', label: 'S' },
        { value: 'A', label: 'A' },
        { value: 'B', label: 'B' },
        { value: 'C', label: 'C' },
        { value: 'D', label: 'D' },
      ] },
      { key: 'modelVersion', label: '模型版本号', width: 120, editable: true, inputType: 'text' },
      { key: 'primaryDepartment', label: '一级部门', width: 120, editable: true, inputType: 'text' },
      { key: 'secondaryDepartment', label: '二级部门', width: 120, editable: true, inputType: 'text' },
      { key: 'conceptPhase', label: '概念阶段', width: 100, editable: true, inputType: 'number', align: 'right' },
      { key: 'planningPhase', label: '计划阶段', width: 100, editable: true, inputType: 'number', align: 'right' },
      { key: 'developmentPhase', label: '开发阶段', width: 100, editable: true, inputType: 'number', align: 'right' },
      { key: 'validationPhase', label: '验证阶段', width: 100, editable: true, inputType: 'number', align: 'right' },
      { key: 'launchPhase', label: '上市阶段', width: 100, editable: true, inputType: 'number', align: 'right' },
      { key: 'lifecycle', label: '生命周期', width: 100, editable: true, inputType: 'number', align: 'right' },
    ],
  },

  /* ── tOS项目 ── */
  {
    key: 'tosPhaseRatio',
    label: 'tOS项目阶段投入比',
    category: 'tOS项目',
    description: '配置tOS项目各版本号下各部门的阶段投入比例',
    columns: [
      { key: 'modelVersion', label: '版本号', width: 120, editable: true, inputType: 'text' },
      { key: 'primaryDepartment', label: '一级部门', width: 120, editable: true, inputType: 'text' },
      { key: 'secondaryDepartment', label: '二级部门', width: 120, editable: true, inputType: 'text' },
      { key: 'planningPhase', label: '规划阶段', width: 100, editable: true, inputType: 'number', align: 'right' },
      { key: 'conceptPhase', label: '概念阶段', width: 100, editable: true, inputType: 'number', align: 'right' },
      { key: 'planningPhase2', label: '计划阶段', width: 100, editable: true, inputType: 'number', align: 'right' },
      { key: 'developmentValidationPhase', label: '开发验证阶段', width: 120, editable: true, inputType: 'number', align: 'right' },
      { key: 'marketIterationPhase', label: '上市迭代阶段', width: 120, editable: true, inputType: 'number', align: 'right' },
      { key: 'maintenancePhase', label: '维护阶段', width: 100, editable: true, inputType: 'number', align: 'right' },
    ],
  },
  {
    key: 'tosBrandAllocation',
    label: '品牌&产品线分摊比',
    category: 'tOS项目',
    description: '配置品牌与产品线的分摊比例',
    columns: [
      { key: 'brand', label: '品牌', width: 120, editable: true, inputType: 'select', options: [
        { value: 'TECNO', label: 'TECNO' },
        { value: 'Infinix', label: 'Infinix' },
        { value: 'itel', label: 'itel' },
      ] },
      { key: 'productLine', label: '产品线', width: 120, editable: true, inputType: 'text' },
      { key: 'allocationRatio', label: '分摊比(%)', width: 120, editable: true, inputType: 'number', align: 'right' },
    ],
  },

  /* ── 技术项目 ── */
  {
    key: 'techModuleDept',
    label: '模块与二级部门/三级部门',
    category: '技术项目',
    description: '配置技术项目模块与部门层级映射关系',
    columns: [
      { key: 'module', label: '模块', width: 160, editable: true, inputType: 'text' },
      { key: 'secondaryDepartment', label: '二级部门', width: 140, editable: true, inputType: 'text' },
      { key: 'tertiaryDepartment', label: '三级部门', width: 140, editable: true, inputType: 'text' },
    ],
  },
  {
    key: 'techTmg',
    label: 'TMG及技术领域与子领域',
    category: '技术项目',
    description: '配置TMG与技术领域、子领域的层级关系',
    columns: [
      { key: 'tmg', label: 'TMG', width: 160, editable: true, inputType: 'text' },
      { key: 'techDomain', label: '技术领域', width: 160, editable: true, inputType: 'text' },
      { key: 'subDomain', label: '子领域', width: 160, editable: true, inputType: 'text' },
    ],
  },
  {
    key: 'techPhaseRatio',
    label: '技术项目项目阶段投入比',
    category: '技术项目',
    description: '配置技术项目各阶段的工期计算规则及投入比例',
    columns: [
      { key: 'phase', label: '项目阶段', width: 140, editable: true, inputType: 'select', options: [
        { value: '规划阶段', label: '规划阶段' },
        { value: '概念阶段', label: '概念阶段' },
        { value: '计划阶段', label: '计划阶段' },
        { value: '开发验证阶段', label: '开发验证阶段' },
        { value: '迁移阶段', label: '迁移阶段' },
      ] },
      { key: 'startMilestone', label: '起始里程碑', width: 140, editable: true, inputType: 'text' },
      { key: 'endMilestone', label: '结束里程碑', width: 140, editable: true, inputType: 'text' },
      { key: 'phaseRatio', label: '阶段投入比(%)', width: 130, editable: true, inputType: 'number', align: 'right' },
    ],
  },
]

/* ── 快速查找映射 ─────────────────────────────────────────────────── */

export const CONFIG_MODULE_MAP: Record<ConfigModuleKey, ConfigModuleMeta> = Object.fromEntries(
  CONFIG_MODULES.map(m => [m.key, m]),
) as Record<ConfigModuleKey, ConfigModuleMeta>

export const CONFIG_MODULE_LABELS: Record<ConfigModuleKey, string> = Object.fromEntries(
  CONFIG_MODULES.map(m => [m.key, m.label]),
) as Record<ConfigModuleKey, string>

/** 侧边栏叶子 key → 模块 key 映射 */
export const CONFIG_LEAF_KEY_PREFIX = 'config/'

/** 侧边栏 kebab-case → 模块 camelCase 映射表 */
const LEAF_TO_MODULE: Record<string, ConfigModuleKey> = {
  'tos-phase-ratio': 'tosPhaseRatio',
  'tos-brand-allocation': 'tosBrandAllocation',
  'tech-module-dept': 'techModuleDept',
  'tech-tmg': 'techTmg',
  'tech-phase-ratio': 'techPhaseRatio',
}

export function resolveConfigModule(leafKey: string): ConfigModuleKey | null {
  if (!leafKey.startsWith(CONFIG_LEAF_KEY_PREFIX)) return null
  const suffix = leafKey.slice(CONFIG_LEAF_KEY_PREFIX.length)
  const moduleKey = LEAF_TO_MODULE[suffix]
  return moduleKey ?? null
}

/* ── 配置中心 → 整机产品项目联动函数 ───────────────────────────────── */

/** 配置中心阶段字段 key 列表 */
export const HR_MODEL_PHASE_FIELDS = ['概念阶段', '计划阶段', '开发阶段', '验证阶段', '上市阶段', '生命周期'].map((label, index) => ({ label, key: ['conceptPhase', 'planningPhase', 'developmentPhase', 'validationPhase', 'launchPhase', 'lifecycle'][index] }))
const HR_MODEL_PHASE_KEYS = ['conceptPhase', 'planningPhase', 'developmentPhase', 'validationPhase', 'launchPhase', 'lifecycle'] as const

/**
 * 从配置中心 hrModel 数据中提取去重的项目等级列表（仅启用记录）
 */
export function getConfigProjectLevels(records: ConfigRecord[]): string[] {
  const levels = new Set<string>()
  records.forEach(r => {
    if (r.enabled === false) return
    const level = r.projectLevel
    if (level !== null && level !== undefined && level !== '') {
      levels.add(String(level))
    }
  })
  return [...levels]
}

/**
 * 从配置中心 hrModel 数据中提取去重的模型版本号列表（仅启用记录）
 */
export function getConfigModelVersions(records: ConfigRecord[]): string[] {
  const versions = new Set<string>()
  records.forEach(r => {
    if (r.enabled === false) return
    const ver = r.modelVersion
    if (ver !== null && ver !== undefined && ver !== '') {
      versions.add(String(ver))
    }
  })
  return [...versions]
}

/** 新建版本只能使用仍启用、且覆盖所选项目等级的模型。 */
export function isHrModelAvailable(records: ConfigRecord[], projectLevel: string, modelVersion: string): boolean {
  return Boolean(projectLevel && modelVersion) && records.some(record =>
    record.enabled !== false && String(record.projectLevel) === projectLevel && String(record.modelVersion) === modelVersion,
  )
}

export function getAvailableHrModelSelection(
  records: ConfigRecord[],
  seed?: { projectLevel: string; hrModelVersion: string },
): { projectLevel: string; hrModelVersion: string } {
  const available = records.filter(record => record.enabled !== false && record.projectLevel && record.modelVersion)
  const selected = available.find(record => String(record.projectLevel) === seed?.projectLevel && String(record.modelVersion) === seed?.hrModelVersion)
    ?? available.find(record => String(record.projectLevel) === seed?.projectLevel)
    ?? available[0]
  return { projectLevel: selected ? String(selected.projectLevel) : '', hrModelVersion: selected ? String(selected.modelVersion) : '' }
}

/**
 * 计算配置中心模型综合：给定项目等级 + 模型版本号，
 * 返回所有匹配记录的阶段值总和（模型综合）。
 * 模型综合 = Σ(概念阶段 + 计划阶段 + 开发阶段 + 验证阶段 + 上市阶段 + 生命周期)
 */
export function calcModelSum(
  records: ConfigRecord[],
  projectLevel: string,
  modelVersion: string,
): number {
  return records
    .filter(r => r.enabled !== false && String(r.projectLevel) === projectLevel && String(r.modelVersion) === modelVersion)
    .reduce((sum, r) => {
      return sum + HR_MODEL_PHASE_KEYS.reduce((phaseSum, key) => phaseSum + (Number(r[key]) || 0), 0)
    }, 0)
}

/**
 * 计算预估投入 = 模型综合 * 等级系数
 */
export function calcEstimatedInvestment(
  records: ConfigRecord[],
  projectLevel: string,
  modelVersion: string,
  levelCoefficient: number,
): number {
  const modelSum = calcModelSum(records, projectLevel, modelVersion)
  return Math.round(modelSum * levelCoefficient * 10) / 10
}

/* ── 月度预估投入按部门拆分 ─────────────────────────────────────────── */

/** 阶段定义：里程碑起止字段 + 配置中心对应的阶段值 key */
interface PhaseDef {
  /** 阶段名称 */
  label: string
  /** 起始里程碑 key */
  startField: keyof MilestoneNodes
  /** 结束里程碑 key */
  endField: keyof MilestoneNodes
  /** 配置中心记录中对应的阶段值 key */
  configKey: string
  /** 是否为生命周期阶段（特殊处理：固定 180 天） */
  isLifecycle?: boolean
}

/** 六个阶段的定义 */
const PHASE_DEFS: PhaseDef[] = [
  { label: '概念阶段', startField: 'conceptStart', endField: 'str1', configKey: 'conceptPhase' },
  { label: '计划阶段', startField: 'str1', endField: 'str3', configKey: 'planningPhase' },
  { label: '开发阶段', startField: 'str3', endField: 'str4', configKey: 'developmentPhase' },
  { label: '验证阶段', startField: 'str4', endField: 'str5', configKey: 'validationPhase' },
  { label: '上市阶段', startField: 'str5', endField: 'productLaunch', configKey: 'launchPhase' },
  { label: '生命周期', startField: 'productLaunch', endField: 'productLaunch', configKey: 'lifecycle', isLifecycle: true },
]

/** 计算两个日期之间的天数（包含首尾，+1） */
function calcDaysInclusive(startDate: string, endDate: string): number {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const diff = end.getTime() - start.getTime()
  if (!Number.isFinite(diff) || diff < 0) return 0
  return Math.round(diff / (1000 * 60 * 60 * 24)) + 1
}

/** 将日期加 N 天，返回 YYYY-MM-DD */
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

/** 某个阶段在指定月份内的天数 */
function daysInMonth(monthKey: string, phaseStart: string, phaseEnd: string): number {
  const [year, month] = monthKey.split('-').map(Number)
  const monthStart = new Date(year, month - 1, 1)
  const monthEnd = new Date(year, month, 0) // last day of month

  const pStart = new Date(phaseStart)
  const pEnd = new Date(phaseEnd)

  // 交集
  const overlapStart = pStart > monthStart ? pStart : monthStart
  const overlapEnd = pEnd < monthEnd ? pEnd : monthEnd

  if (overlapStart > overlapEnd) return 0
  return Math.round((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
}

/** Round once across departments, then reconcile each department's phase values to its share. */
export function calcMachineDepartmentInvestments(records: ConfigRecord[], projectLevel: string, modelVersion: string, coefficient: number) {
  const matched = records.filter(record => record.enabled !== false
    && String(record.projectLevel) === projectLevel && String(record.modelVersion) === modelVersion)
  const rawTotals = Object.fromEntries(matched.map((record, index) => [String(index),
    HR_MODEL_PHASE_KEYS.reduce((sum, key) => sum + (Number(record[key]) || 0), 0) * coefficient,
  ]))
  const totals = roundHrMonthlyAllocation(rawTotals, Object.values(rawTotals).reduce((sum, value) => sum + value, 0))
  return matched.map((record, index) => {
    const estimatedTotal = totals[String(index)] ?? 0
    const rawPhases = Object.fromEntries(HR_MODEL_PHASE_KEYS.map(key => [key, (Number(record[key]) || 0) * coefficient]))
    return {
      id: record.id,
      primaryDepartment: String(record.primaryDepartment ?? ''),
      secondaryDepartment: String(record.secondaryDepartment ?? ''),
      phases: roundHrMonthlyAllocation(rawPhases, estimatedTotal),
      estimatedTotal,
    }
  })
}

/** 单个部门的月度拆分结果 */
export interface DepartmentMonthlySplit {
  /** Stable source row ID, including when several rows share department names. */
  departmentId?: string
  primaryDepartment: string
  secondaryDepartment: string
  /** 月度投入：key = 'YYYY-MM' → value = 人月 */
  monthlyData: Record<string, number>
  /** 预估合计（该部门） */
  estimatedTotal: number
}

/**
 * 按部门拆分月度预估投入。
 *
 * 逻辑：
 * 1. 从配置中心筛选出与版本 projectLevel + hrModelVersion 匹配的所有记录（每条 = 一个部门）
 * 2. 对每个部门的每个阶段：
 *    - 阶段工期 = (结束里程碑 - 起始里程碑) + 1（生命周期固定 180 天）
 *    - 每日预估 = 配置中心阶段值 × 等级系数 / 阶段工期
 *    - 月度预估 = 该阶段在当月的天数 × 每日预估
 * 3. 汇总所有阶段的月度数据
 */
export function calcDepartmentMonthlySplit(
  records: ConfigRecord[],
  projectLevel: string,
  modelVersion: string,
  levelCoefficient: number,
  milestones: MilestoneNodes,
): DepartmentMonthlySplit[] {
  const departments = calcMachineDepartmentInvestments(records, projectLevel, modelVersion, levelCoefficient)
  const results: DepartmentMonthlySplit[] = []
  for (const department of departments) {
    const { primaryDepartment, secondaryDepartment, estimatedTotal } = department

    const monthlyData: Record<string, number> = {}
    let totalForDept = 0

    for (const phase of PHASE_DEFS) {
      const startVal = milestones[phase.startField]
      if (!startVal) continue

      let phaseDays: number
      let phaseStart: string
      let phaseEnd: string

      if (phase.isLifecycle) {
        // 生命周期：自上市日期起 180 天
        phaseDays = 180
        phaseStart = startVal
        phaseEnd = addDays(startVal, 179) // 180 days inclusive
      } else {
        const endVal = milestones[phase.endField]
        if (!endVal) continue
        phaseDays = calcDaysInclusive(startVal, endVal)
        if (phaseDays <= 0) continue
        phaseStart = startVal
        phaseEnd = endVal
      }

      // 配置中心阶段值
      const phaseInvestment = department.phases[phase.configKey] || 0
      if (phaseInvestment === 0) continue

      // 每日预估 = 阶段值 × 等级系数 / 工期
      const dailyRate = phaseInvestment / phaseDays

      // 计算该阶段覆盖的所有月份
      const startMonth = phaseStart.substring(0, 7) // YYYY-MM
      const endMonth = phaseEnd.substring(0, 7)

      let current = new Date(phaseStart)
      while (current <= new Date(phaseEnd)) {
        const monthKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`
        const days = daysInMonth(monthKey, phaseStart, phaseEnd)
        if (days > 0) {
          monthlyData[monthKey] = (monthlyData[monthKey] || 0) + Math.round(dailyRate * days * 100) / 100
        }
        // Move to next month
        current = new Date(current.getFullYear(), current.getMonth() + 1, 1)
      }

      totalForDept += phaseInvestment
      // Suppress unused variable warning for startMonth/endMonth
      void startMonth
      void endMonth
    }

    Object.assign(monthlyData, roundHrMonthlyAllocation(monthlyData, totalForDept))

    results.push({
      departmentId: department.id,
      primaryDepartment,
      secondaryDepartment,
      monthlyData,
      estimatedTotal,
    })
  }

  return results
}

function makeId(module: string, idx: number): string {
  return `cfg-${module}-${idx}`
}

export const MOCK_CONFIG_DATA: Record<ConfigModuleKey, ConfigRecord[]> = {
  hrModel: [
    { id: makeId('hrModel', 1), enabled: true, projectLevel: 'S', modelVersion: 'V2026.1', primaryDepartment: '研发中心', secondaryDepartment: '产品部', conceptPhase: 5, planningPhase: 8, developmentPhase: 18, validationPhase: 10, launchPhase: 8, lifecycle: 3 },
    { id: makeId('hrModel', 2), enabled: true, projectLevel: 'S', modelVersion: 'V2026.1', primaryDepartment: '研发中心', secondaryDepartment: '软件部', conceptPhase: 3, planningPhase: 5, developmentPhase: 12, validationPhase: 7, launchPhase: 5, lifecycle: 2 },
    { id: makeId('hrModel', 3), enabled: true, projectLevel: 'S', modelVersion: 'V2026.1', primaryDepartment: '硬件部', secondaryDepartment: '结构部', conceptPhase: 2, planningPhase: 2, developmentPhase: 5, validationPhase: 3, launchPhase: 2, lifecycle: 0 },
    { id: makeId('hrModel', 4), enabled: true, projectLevel: 'A', modelVersion: 'V2026.1', primaryDepartment: '研发中心', secondaryDepartment: '产品部', conceptPhase: 5, planningPhase: 10, developmentPhase: 15, validationPhase: 13, launchPhase: 5, lifecycle: 3 },
    { id: makeId('hrModel', 5), enabled: true, projectLevel: 'A', modelVersion: 'V2026.1', primaryDepartment: '研发中心', secondaryDepartment: '软件部', conceptPhase: 5, planningPhase: 10, developmentPhase: 15, validationPhase: 12, launchPhase: 5, lifecycle: 2 },
    { id: makeId('hrModel', 6), enabled: true, projectLevel: 'B', modelVersion: 'V2026.1', primaryDepartment: '研发中心', secondaryDepartment: '产品部', conceptPhase: 8, planningPhase: 10, developmentPhase: 13, validationPhase: 13, launchPhase: 5, lifecycle: 3 },
    { id: makeId('hrModel', 7), enabled: true, projectLevel: 'C', modelVersion: 'V2025.4', primaryDepartment: '研发中心', secondaryDepartment: '产品部', conceptPhase: 8, planningPhase: 13, developmentPhase: 13, validationPhase: 10, launchPhase: 5, lifecycle: 3 },
    { id: makeId('hrModel', 8), enabled: true, projectLevel: 'D', modelVersion: 'V2025.4', primaryDepartment: '研发中心', secondaryDepartment: '产品部', conceptPhase: 10, planningPhase: 13, developmentPhase: 10, validationPhase: 10, launchPhase: 5, lifecycle: 3 },
  ],
  tosPhaseRatio: [
    { id: makeId('tosPhaseRatio', 1), enabled: true, modelVersion: 'V2026.1', primaryDepartment: '软件部', secondaryDepartment: 'tOS开发', planningPhase: 8, conceptPhase: 10, planningPhase2: 15, developmentValidationPhase: 50, marketIterationPhase: 10, maintenancePhase: 7 },
    { id: makeId('tosPhaseRatio', 2), enabled: true, modelVersion: 'V2026.1', primaryDepartment: '软件部', secondaryDepartment: '框架组', planningPhase: 5, conceptPhase: 6, planningPhase2: 10, developmentValidationPhase: 35, marketIterationPhase: 7, maintenancePhase: 5 },
    { id: makeId('tosPhaseRatio', 3), enabled: true, modelVersion: 'V2026.1', primaryDepartment: '软件部', secondaryDepartment: '组件组', planningPhase: 3, conceptPhase: 4, planningPhase2: 8, developmentValidationPhase: 25, marketIterationPhase: 5, maintenancePhase: 3 },
    { id: makeId('tosPhaseRatio', 4), enabled: true, modelVersion: 'V2026.1', primaryDepartment: '软件部', secondaryDepartment: 'tOS开发', planningPhase: 6, conceptPhase: 8, planningPhase2: 12, developmentValidationPhase: 45, marketIterationPhase: 9, maintenancePhase: 6 },
    { id: makeId('tosPhaseRatio', 5), enabled: true, modelVersion: 'V2026.1', primaryDepartment: '软件部', secondaryDepartment: '框架组', planningPhase: 4, conceptPhase: 5, planningPhase2: 8, developmentValidationPhase: 30, marketIterationPhase: 6, maintenancePhase: 4 },
    { id: makeId('tosPhaseRatio', 6), enabled: true, modelVersion: 'V2025.4', primaryDepartment: '软件部', secondaryDepartment: 'tOS开发', planningPhase: 5, conceptPhase: 7, planningPhase2: 10, developmentValidationPhase: 40, marketIterationPhase: 8, maintenancePhase: 5 },
  ],
  tosBrandAllocation: [
    { id: makeId('tosBrand', 1), brand: 'TECNO', productLine: 'CAMON', allocationRatio: 30 },
    { id: makeId('tosBrand', 2), brand: 'TECNO', productLine: 'SPARK', allocationRatio: 20 },
    { id: makeId('tosBrand', 3), brand: 'Infinix', productLine: 'NOTE', allocationRatio: 25 },
    { id: makeId('tosBrand', 4), brand: 'Infinix', productLine: 'HOT', allocationRatio: 15 },
    { id: makeId('tosBrand', 5), brand: 'itel', productLine: 'A', allocationRatio: 10 },
  ],
  techModuleDept: [
    { id: makeId('techMod', 1), module: '摄像头驱动', secondaryDepartment: '软件部', tertiaryDepartment: '驱动开发' },
    { id: makeId('techMod', 2), module: '显示驱动', secondaryDepartment: '软件部', tertiaryDepartment: '驱动开发' },
    { id: makeId('techMod', 3), module: '电源管理', secondaryDepartment: '硬件部', tertiaryDepartment: '电源设计' },
    { id: makeId('techMod', 4), module: '射频调试', secondaryDepartment: '硬件部', tertiaryDepartment: '射频设计' },
  ],
  techTmg: [
    { id: makeId('techTmg', 1), tmg: '影像技术', techDomain: '摄像头', subDomain: '后摄' },
    { id: makeId('techTmg', 2), tmg: '影像技术', techDomain: '摄像头', subDomain: '前摄' },
    { id: makeId('techTmg', 3), tmg: '显示技术', techDomain: 'LCD', subDomain: '色彩调校' },
    { id: makeId('techTmg', 4), tmg: '显示技术', techDomain: 'OLED', subDomain: '亮度调节' },
    { id: makeId('techTmg', 5), tmg: '通信技术', techDomain: '5G', subDomain: '协议栈' },
  ],
  techPhaseRatio: [
    { id: makeId('techPhase', 1), phase: '规划阶段', startMilestone: '规划启动', endMilestone: 'Charter DCP', phaseRatio: 10 },
    { id: makeId('techPhase', 2), phase: '概念阶段', startMilestone: 'Charter DCP', endMilestone: 'TDR1', phaseRatio: 15 },
    { id: makeId('techPhase', 3), phase: '计划阶段', startMilestone: 'TDR1', endMilestone: 'PDCP', phaseRatio: 15 },
    { id: makeId('techPhase', 4), phase: '开发验证阶段', startMilestone: 'PDCP', endMilestone: 'TDCP-X', phaseRatio: 40 },
    { id: makeId('techPhase', 5), phase: '迁移阶段', startMilestone: 'TDCP-X', endMilestone: 'EDCP', phaseRatio: 20 },
  ],
}

/* ── tOS 项目月度预估投入按部门拆分 ────────────────────────────────── */

/** tOS 阶段定义 */
interface TosPhaseDef {
  label: string
  startField: keyof TosMilestoneNodes
  endField: keyof TosMilestoneNodes
  configKey: TosPhaseKey
}

/** tOS 六个阶段的定义 */
const TOS_PHASE_DEFS: TosPhaseDef[] = [
  { label: '规划阶段', startField: 'planningKO', endField: 'conceptStart', configKey: 'planningPhase' },
  { label: '概念阶段', startField: 'conceptStart', endField: 'str1', configKey: 'conceptPhase' },
  { label: '计划阶段', startField: 'str1', endField: 'str3', configKey: 'planningPhase2' },
  { label: '开发验证阶段', startField: 'str3', endField: 'str5', configKey: 'developmentValidationPhase' },
  { label: '上市迭代阶段', startField: 'str5', endField: 'marketIteration', configKey: 'marketIterationPhase' },
  { label: '维护阶段', startField: 'marketIteration', endField: 'maintenanceEnd', configKey: 'maintenancePhase' },
]

/**
 * 从配置中心 tosPhaseRatio 数据中提取去重的模型版本号列表（仅启用记录）
 */
export function getTosConfigModelVersions(records: ConfigRecord[]): string[] {
  const versions = new Set<string>()
  records.forEach(r => {
    if (r.enabled === false) return
    const ver = r.modelVersion
    if (ver !== null && ver !== undefined && ver !== '') {
      versions.add(String(ver))
    }
  })
  return [...versions]
}

/**
 * 按部门拆分 tOS 项目月度预估投入。
 *
 * 逻辑：
 * 1. 遍历每个部门的预估投入记录（TosDepartmentInvestment）
 * 2. 对每个部门的每个阶段（需有里程碑日期）：
 *    - 阶段预估投入 = dept[phase.configKey]（直接使用部门阶段投入值，支持用户编辑后的值）
 *    - 每日预估 = 阶段预估投入 / 阶段工期
 *    - 月度预估 = 该阶段在当月的天数 × 每日预估
 * 3. 汇总所有阶段的月度数据
 * 4. 修正最后一个月的值，使月度合计与 dept.estimatedInvestment 完全一致
 */
export function calcTosDepartmentMonthlySplit(
  departmentInvestments: TosDepartmentInvestment[],
  milestones: TosMilestoneNodes,
): DepartmentMonthlySplit[] {
  if (!departmentInvestments || departmentInvestments.length === 0) return []

  const results: DepartmentMonthlySplit[] = []

  for (const dept of departmentInvestments) {
    const primaryDepartment = dept.primaryDepartment
    const secondaryDepartment = dept.secondaryDepartment
    const deptEstimatedTotal = dept.estimatedInvestment

    const monthlyData: Record<string, number> = {}
    let allocatedTotal = 0

    for (const phase of TOS_PHASE_DEFS) {
      const startVal = milestones[phase.startField]
      const endVal = milestones[phase.endField]
      if (!startVal || !endVal) continue

      const phaseDays = calcDaysInclusive(startVal, endVal)
      if (phaseDays <= 0) continue

      // 直接使用部门阶段投入值（支持用户编辑后的值）
      const phaseInvestment = Number(dept[phase.configKey]) || 0
      if (phaseInvestment === 0) continue
      allocatedTotal += phaseInvestment

      // 每日预估 = 阶段预估投入 / 阶段工期
      const dailyRate = phaseInvestment / phaseDays

      // 计算该阶段覆盖的所有月份
      let current = new Date(startVal)
      while (current <= new Date(endVal)) {
        const monthKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`
        const days = daysInMonth(monthKey, startVal, endVal)
        if (days > 0) {
          monthlyData[monthKey] = (monthlyData[monthKey] || 0) + Math.round(dailyRate * days * 100) / 100
        }
        current = new Date(current.getFullYear(), current.getMonth() + 1, 1)
      }
    }

    Object.assign(monthlyData, roundHrMonthlyAllocation(monthlyData, allocatedTotal))

    results.push({
      departmentId: dept.id,
      primaryDepartment,
      secondaryDepartment,
      monthlyData,
      estimatedTotal: deptEstimatedTotal,
    })
  }

  return results
}

/* ── 技术项目月度预估投入按部门拆分 ────────────────────────────────── */

/** 技术项目 阶段定义 */
interface TechPhaseDef {
  label: string
  startField: keyof TechMilestoneNodes
  endField: keyof TechMilestoneNodes
  configKey: TechPhaseKey
}

/** 技术项目 五个阶段的定义 */
const TECH_PHASE_DEFS: TechPhaseDef[] = [
  { label: '规划阶段', startField: 'planningStart', endField: 'charterDCP', configKey: 'planningPhase' },
  { label: '概念阶段', startField: 'charterDCP', endField: 'tdr1', configKey: 'conceptPhase' },
  { label: '计划阶段', startField: 'tdr1', endField: 'pdcp', configKey: 'planPhase' },
  { label: '开发验证阶段', startField: 'pdcp', endField: 'tdcpx', configKey: 'developmentPhase' },
  { label: '迁移阶段', startField: 'tdcpx', endField: 'edcp', configKey: 'migrationPhase' },
]

/**
 * 按部门拆分 技术项目 月度预估投入。
 *
 * 逻辑：
 * 1. 遍历每个部门的预估投入记录（TechDepartmentInvestment）
 * 2. 对每个部门的每个阶段（需有里程碑日期）：
 *    - 阶段预估投入 = dept[phase.configKey]（直接使用部门阶段投入值，支持用户编辑后的值）
 *    - 每日预估 = 阶段预估投入 / 阶段工期
 *    - 月度预估 = 该阶段在当月的天数 × 每日预估
 * 3. 汇总所有阶段的月度数据
 * 4. 修正最后一个月的值，使月度合计与 dept.estimatedInvestment 完全一致
 */
export function calcTechDepartmentMonthlySplit(
  departmentInvestments: TechDepartmentInvestment[],
  milestones: TechMilestoneNodes,
): DepartmentMonthlySplit[] {
  if (!departmentInvestments || departmentInvestments.length === 0) return []

  const results: DepartmentMonthlySplit[] = []

  for (const dept of departmentInvestments) {
    const primaryDepartment = dept.primaryDepartment
    const secondaryDepartment = dept.secondaryDepartment
    const deptEstimatedTotal = dept.estimatedInvestment

    const monthlyData: Record<string, number> = {}
    let allocatedTotal = 0

    for (const phase of TECH_PHASE_DEFS) {
      const startVal = milestones[phase.startField]
      const endVal = milestones[phase.endField]
      if (!startVal || !endVal) continue

      const phaseDays = calcDaysInclusive(startVal, endVal)
      if (phaseDays <= 0) continue

      // 直接使用部门阶段投入值（支持用户编辑后的值）
      const phaseInvestment = Number(dept[phase.configKey]) || 0
      if (phaseInvestment === 0) continue
      allocatedTotal += phaseInvestment

      // 每日预估 = 阶段预估投入 / 阶段工期
      const dailyRate = phaseInvestment / phaseDays

      // 计算该阶段覆盖的所有月份
      let current = new Date(startVal)
      while (current <= new Date(endVal)) {
        const monthKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`
        const days = daysInMonth(monthKey, startVal, endVal)
        if (days > 0) {
          monthlyData[monthKey] = (monthlyData[monthKey] || 0) + Math.round(dailyRate * days * 100) / 100
        }
        current = new Date(current.getFullYear(), current.getMonth() + 1, 1)
      }
    }

    Object.assign(monthlyData, roundHrMonthlyAllocation(monthlyData, allocatedTotal))

    results.push({
      departmentId: dept.id,
      primaryDepartment,
      secondaryDepartment,
      monthlyData,
      estimatedTotal: deptEstimatedTotal,
    })
  }

  return results
}
