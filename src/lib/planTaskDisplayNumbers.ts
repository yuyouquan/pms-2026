/** Display hierarchy separately from persisted IDs so migrations preserve references. */
export function planTaskDisplayNumbers(tasks: readonly { id: string; parentId?: string | null }[]): Map<string, string> {
  const numbers = new Map<string, string>()
  const children = new Map<string | null, string[]>()
  for (const task of tasks) {
    const parent = task.parentId || null
    children.set(parent, [...(children.get(parent) || []), task.id])
  }
  const visit = (parent: string | null, prefix: string) => {
    for (const [index, id] of (children.get(parent) || []).entries()) {
      if (numbers.has(id)) continue
      const number = prefix ? `${prefix}.${index + 1}` : String(index + 1)
      numbers.set(id, number)
      visit(id, number)
    }
  }
  visit(null, '')
  return numbers
}

/** A moved task may still own an ID derived from its former parent. */
export function nextPlanTaskId(tasks: readonly { id: string }[], parentId: string | null, initial: number): string {
  const used = new Set(tasks.map(task => task.id))
  let number = initial
  const candidate = () => parentId ? `${parentId}.${number}` : String(number)
  while (used.has(candidate())) number += 1
  return candidate()
}
