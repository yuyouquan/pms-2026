export const PROJECT_INFO_EDIT_ACTION = 'edit-basic-info'

/** Stable project identity; names and notification recipients never form the route. */
export function buildProjectInfoLink(projectId: string): string {
  const params = new URLSearchParams({ projectId, action: PROJECT_INFO_EDIT_ACTION })
  return `/?${params.toString()}`
}

export function parseProjectInfoLink(search: string): { projectId: string } | { error: string } | null {
  const params = new URLSearchParams(search)
  if (!params.has('projectId') && !params.has('action')) return null
  const projectId = params.get('projectId')?.trim()
  if (!projectId || params.getAll('projectId').length !== 1
    || params.getAll('action').length !== 1 || params.get('action') !== PROJECT_INFO_EDIT_ACTION) {
    return { error: '项目通知链接无效，请重新打开原通知中的入口。' } as const
  }
  return { projectId } as const
}
