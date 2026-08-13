/* ── HR Pipeline Configuration Center Types ─────────────────────────── */

/** 配置中心模块类型 */
export type ConfigModuleKey =
  | 'hrModel'            // 人力模型
  | 'tosPhaseRatio'      // tOS项目阶段投入比
  | 'tosBrandAllocation' // 品牌&产品线分摊比
  | 'techModuleDept'     // 模块与二级部门/三级部门
  | 'techTmg'            // TMG及技术领域与子领域
  | 'techPhaseRatio'     // 技术项目项目阶段投入比

/** 配置记录（通用键值对） */
export interface ConfigRecord {
  id: string
  [key: string]: string | number | null
}

/** 列定义 */
export interface ConfigColumnDef {
  key: string
  label: string
  width?: number
  /** 是否可编辑 */
  editable?: boolean
  /** 输入类型 */
  inputType?: 'text' | 'number' | 'select'
  /** 下拉选项（inputType === 'select' 时使用） */
  options?: { value: string; label: string }[]
  /** 对齐方式 */
  align?: 'left' | 'right' | 'center'
}

/** 模块元信息 */
export interface ConfigModuleMeta {
  key: ConfigModuleKey
  label: string
  category: string
  description: string
  columns: ConfigColumnDef[]
}

/** 新增/编辑表单值 */
export type ConfigFormValues = Record<string, string | number | null>
