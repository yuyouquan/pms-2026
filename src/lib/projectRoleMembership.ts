import { PERMISSION_DEPARTMENTS, PERMISSION_USERS, PERMISSION_USER_DEPARTMENTS } from '@/constants/permissionCenter'

/** Project authorization only: never use inherited membership as named responsibility. */
export function roleAppliesToUser(role: { members: readonly string[]; departments?: readonly string[] }, user: string): boolean {
  if (!user) return false
  if (Array.isArray(role.members) && role.members.includes(user)) return true
  if (!PERMISSION_USERS.includes(user) || !Array.isArray(role.departments)) return false
  return role.departments.some(department => typeof department === 'string' && PERMISSION_USER_DEPARTMENTS[user]?.includes(department))
}

export function normalizeProjectRoleDepartments(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((item): item is string => typeof item === 'string').map(item => item.trim()).filter(item => PERMISSION_DEPARTMENTS.includes(item)))]
}
