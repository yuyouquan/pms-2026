import type { MrPermissionResult } from '@/types/mrVersionPlan'

type ConfigPermissionKey = 'configCenter:planEdit' | 'configCenter:planPublish'

export function resolveMrTemplateConfigCapabilities(
  hasPermission: (key: ConfigPermissionKey) => boolean,
): { canEdit: boolean; canPublish: boolean } {
  return {
    canEdit: hasPermission('configCenter:planEdit'),
    canPublish: hasPermission('configCenter:planPublish'),
  }
}

export function createMrTemplateStorePermission(canEditTemplate: boolean): MrPermissionResult {
  return {
    canView: canEditTemplate,
    canEditTemplate,
    canEditTos: false,
    canEditMachine: false,
    canStopRelease: false,
    canEditMarket: false,
  }
}
