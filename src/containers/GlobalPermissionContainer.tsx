'use client'

import { GlobalPermissionConfig } from '@/components/permission/PermissionModule'
import { usePermissionStore } from '@/stores/permission'

export default function GlobalPermissionContainer() {
  const {
    globalRoles, setGlobalRoles,
    globalRolePerms, setGlobalRolePerms,
    globalPermTab, setGlobalPermTab,
    showGlobalAddRole, setShowGlobalAddRole,
    globalNewRoleName, setGlobalNewRoleName,
    globalEditingRole, setGlobalEditingRole,
    globalEditRoleValue, setGlobalEditRoleValue,
    globalPermActiveRole, setGlobalPermActiveRole,
  } = usePermissionStore()

  return (
    <GlobalPermissionConfig
      globalRoles={globalRoles}
      setGlobalRoles={setGlobalRoles}
      globalRolePerms={globalRolePerms}
      setGlobalRolePerms={setGlobalRolePerms}
      globalPermTab={globalPermTab}
      setGlobalPermTab={setGlobalPermTab}
      showGlobalAddRole={showGlobalAddRole}
      setShowGlobalAddRole={setShowGlobalAddRole}
      globalNewRoleName={globalNewRoleName}
      setGlobalNewRoleName={setGlobalNewRoleName}
      globalEditingRole={globalEditingRole}
      setGlobalEditingRole={setGlobalEditingRole}
      globalEditRoleValue={globalEditRoleValue}
      setGlobalEditRoleValue={setGlobalEditRoleValue}
      globalPermActiveRole={globalPermActiveRole}
      setGlobalPermActiveRole={setGlobalPermActiveRole}
    />
  )
}
