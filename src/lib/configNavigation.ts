import { PROJECT_TEMPLATE_TYPES } from '@/constants/projectTypes'
import { CONFIG_MODULE_MAP } from '@/constants/hrConfig'
import { ENUM_DEFINITIONS, ENUM_TYPE_KEYS } from '@/lib/enumValues'
import type { EnumTypeKey } from '@/types/enums'

export type ConfigMenuTarget =
  | { module: 'plan'; projectType: (typeof PROJECT_TEMPLATE_TYPES)[number] }
  | { module: 'transfer'; projectType: '整机产品项目' | 'tOS版本项目'; view: 'checklist' | 'review' | 'team' }
  | { module: 'enum'; enumType: EnumTypeKey }
  | { module: 'hrPipeline'; moduleKey: 'hrModel' | 'nonLaborSubject' | 'feeRate' }

export interface ConfigMenuLeaf {
  key: string
  label: string
  target: ConfigMenuTarget
}

export interface ConfigMenuGroup {
  key: ConfigMenuTarget['module']
  label: string
  children: ConfigMenuLeaf[]
}

export const CONFIG_MENU_GROUPS: ConfigMenuGroup[] = [
  {
    key: 'plan', label: '计划模板配置',
    children: PROJECT_TEMPLATE_TYPES.map(projectType => ({
      key: `plan:${projectType}`, label: projectType, target: { module: 'plan', projectType },
    })),
  },
  {
    key: 'transfer', label: '转维材料模板配置',
    children: [
      { key: 'transfer:整机产品项目:checklist', label: 'CheckList', target: { module: 'transfer', projectType: '整机产品项目', view: 'checklist' } },
      { key: 'transfer:整机产品项目:review', label: '评审要素', target: { module: 'transfer', projectType: '整机产品项目', view: 'review' } },
      { key: 'transfer:整机产品项目:team', label: '转维团队配置', target: { module: 'transfer', projectType: '整机产品项目', view: 'team' } },
      { key: 'transfer:tOS版本项目:checklist', label: 'CheckList', target: { module: 'transfer', projectType: 'tOS版本项目', view: 'checklist' } },
      { key: 'transfer:tOS版本项目:team', label: '转维团队配置', target: { module: 'transfer', projectType: 'tOS版本项目', view: 'team' } },
    ],
  },
  {
    key: 'enum', label: '枚举值配置',
    children: ENUM_TYPE_KEYS.map(enumType => ({
      key: `enum:${enumType}`, label: ENUM_DEFINITIONS[enumType].label, target: { module: 'enum', enumType },
    })),
  },
  {
    key: 'hrPipeline', label: '人力资源管道',
    children: (['hrModel', 'nonLaborSubject', 'feeRate'] as const).map(moduleKey => ({ key: `hrPipeline:${moduleKey}`, label: CONFIG_MODULE_MAP[moduleKey].label, target: { module: 'hrPipeline', moduleKey } })),
  },
]

/** Parent matches retain every child; child matches retain the path to that item. */
export function filterConfigMenu(query: string): ConfigMenuGroup[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return CONFIG_MENU_GROUPS
  return CONFIG_MENU_GROUPS.flatMap(group => {
    const children = group.children.filter(child => {
      const path = `${group.label} ${child.target.module === 'transfer' ? child.target.projectType : ''} ${child.label}`.toLocaleLowerCase()
      return terms.every(term => path.includes(term))
    })
    return children.length ? [{ ...group, children }] : []
  })
}
