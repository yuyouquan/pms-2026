'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Home from '@/app/page'
import { usePlanStore } from '@/stores/plan'
import { useTransferStore } from '@/stores/transfer'
import { useUiStore } from '@/stores/ui'

// Both legacy URLs open the current template center. The retired level-two
// demo does not map to the newer MR template, which has a different scope.
// Rendering Home also retains the shared session, navigation and leave modal.
export default function LegacyPlanTemplateRoute() {
  const router = useRouter()

  useEffect(() => {
    const ui = useUiStore.getState()
    ui.navigateWithEditGuard(() => {
      ui.setConfigTab('plan')
      usePlanStore.getState().setPlanLevel('level1')
      useTransferStore.getState().setTransferView(null)
      ui.setActiveModule('config')
      router.replace('/')
    }, false)
  }, [router])

  return <Home />
}
