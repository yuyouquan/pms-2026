import { ALL_USERS } from '@/constants/permissions'
import { getTransferProjectType, getTransferMember, type TransferTeamRole } from '@/lib/transferConfig'
import type { ProjectTeam, TMTeamMember } from '@/mock/transfer-maintenance'

/** IPM data is represented by PMS project fields in this mock-only application. */
export function getInitialTransferTeam(project: Record<string, any>, config: TransferTeamRole[]): ProjectTeam {
  const kind = getTransferProjectType(project)
  const aliases: Record<string, string[]> = kind === 'tOS版本项目'
    ? { SPM: ['tosVersionProjectManager', 'spm'], TPM: ['tosTestRepresentative', 'tpm'], '底软': ['tosBasebandDevRepresentative'], '系统': ['tosSystemAppDevRepresentative'], '影像': ['tosImagingDevRepresentative'] }
    : { SPM: ['spm'], TPM: ['tpm', 'testRepresentative'], '底软': ['baseSoftwareRepresentative'], '系统': ['systemRepresentative'], '影像': ['imagingRepresentative'] }
  const readMembers = (side: 'research' | 'maintenance'): TMTeamMember[] => config.flatMap(role => {
    const team = project.team?.[side] ?? project[side === 'research' ? 'researchTeam' : 'maintenanceTeam']
    const existing = Array.isArray(team) ? getTransferMember(team, role.ipmRoleCode, config) : undefined
    if (existing) return [{ ...existing, role: role.roleName, ipmRoleCode: role.ipmRoleCode }]
    if (side === 'maintenance') return []
    const fields = [role.ipmRoleCode, role.ipmRoleCode.toLowerCase(), ...(aliases[role.ipmRoleCode] ?? [])]
    const value = fields.map(field => project.fieldValues?.[field] ?? project[field]).find(Boolean)
    const names = (Array.isArray(value) ? value : String(value ?? '').split(/[,，、]/)).map(value => String(value).trim())
    const name = names.find(name => ALL_USERS.includes(name))
    return name ? [{ id: `login-${name}`, name, role: role.roleName, ipmRoleCode: role.ipmRoleCode, department: '项目团队' }] : []
  })
  return { research: readMembers('research'), maintenance: readMembers('maintenance') }
}
