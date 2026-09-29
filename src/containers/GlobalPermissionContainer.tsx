'use client'

import PermissionCenter from '@/components/permission-center/PermissionCenter'
import { useProjectStore } from '@/stores/project'

export default function GlobalPermissionContainer() {
  const user = useProjectStore(state => state.currentLoginUser)
  return <PermissionCenter key={user} />
}
