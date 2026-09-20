/** Project-owned audit history survives version deletion. Values are serialized for display/export. */
export interface ResourceOperationLog {
  id: string
  versionId: string
  versionNumber: string
  budgetType: string
  operator: string
  timestamp: string
  action: string
  changes: { field: string; before: string; after: string }[]
}
export interface ResourceVersionOptions { versionNumber: string; sourceVersionId?: string }
