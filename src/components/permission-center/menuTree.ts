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

function getMenuPath(menu: PermissionMenu): string[] {
  const labels = menu.id.startsWith('config.transfer:') ? menu.label.split(' / ') : [menu.label]
  return [...menu.category.split(' / '), ...labels]
}

/** Search the full path, retaining each matching leaf's expandable ancestors. */
export function buildPermissionMenuTree(query = '', includeMenu: (menu: PermissionMenu) => boolean = () => true): PermissionMenuNode[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  const roots: PermissionMenuNode[] = []
  for (const menu of CONFIGURABLE_PERMISSION_MENUS) {
    if (!includeMenu(menu)) continue
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
