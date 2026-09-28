import { PERMISSION_MENUS } from '@/constants/permissionCenter'
import type { PermissionMenu } from '@/types/permissionCenter'

// HR configuration is deferred; keep its registry and existing grants intact.
export const CONFIGURABLE_PERMISSION_MENUS = PERMISSION_MENUS.filter(menu => !menu.id.startsWith('hr.') && !menu.id.startsWith('config.hrPipeline:'))

export interface PermissionMenuNode {
  key: string
  label: string
  isLeaf: boolean
  children?: PermissionMenuNode[]
}

export interface PermissionMatrixRow {
  menu: PermissionMenu
  parents: string[]
  leaf: string
  /** Zero means the same full ancestor path is merged with an earlier row. */
  spans: number[]
}

/** Build table rows with spans keyed by every ancestor, not just the displayed label. */
export function buildPermissionMatrixRows(query = ''): { rows: PermissionMatrixRow[]; depth: number } {
  const flatten = (nodes: readonly PermissionMenuNode[], parents: string[] = []): Omit<PermissionMatrixRow, 'spans'>[] =>
    nodes.flatMap(node => node.children ? flatten(node.children, [...parents, node.label]) : {
      menu: CONFIGURABLE_PERMISSION_MENUS.find(menu => menu.id === node.key)!,
      parents, leaf: node.label,
    })
  const flat = flatten(buildPermissionMenuTree(query))
  const depth = Math.max(0, ...flat.map(row => row.parents.length))
  const rows = flat.map((row, index) => ({
    ...row,
    spans: Array.from({ length: depth }, (_, level) => {
      if (!row.parents[level]) return 1
      const prefix = row.parents.slice(0, level + 1).join('\u0000')
      if (index > 0 && flat[index - 1].parents.slice(0, level + 1).join('\u0000') === prefix) return 0
      let count = 1
      while (index + count < flat.length && flat[index + count].parents.slice(0, level + 1).join('\u0000') === prefix) count++
      return count
    }),
  }))
  return { rows, depth }
}

function getMenuPath(menu: PermissionMenu): string[] {
  const labels = menu.id.startsWith('config.transfer:') ? menu.label.split(' / ') : [menu.label]
  return [...menu.category.split(' / '), ...labels]
}

/** Search the full path, retaining each matching leaf's expandable ancestors. */
export function buildPermissionMenuTree(query = ''): PermissionMenuNode[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  const roots: PermissionMenuNode[] = []
  for (const menu of CONFIGURABLE_PERMISSION_MENUS) {
    const path = getMenuPath(menu)
    if (!terms.every(term => path.join(' ').toLocaleLowerCase().includes(term))) continue
    let siblings = roots
    path.forEach((label, index) => {
      const isLeaf = index === path.length - 1
      const key = isLeaf ? menu.id : `group:${JSON.stringify(path.slice(0, index + 1))}`
      let node = siblings.find(item => item.key === key)
      if (!node) {
        node = { key, label, isLeaf, ...(!isLeaf ? { children: [] } : {}) }
        siblings.push(node)
      }
      if (node.children) siblings = node.children
    })
  }
  return roots
}

export function getMenuGroupKeys(nodes: readonly PermissionMenuNode[]): string[] {
  return nodes.flatMap(node => node.children ? [node.key, ...getMenuGroupKeys(node.children)] : [])
}
