/** Actual field event handlers, kept independent of React for executable lifecycle tests. */
export function createInlineFieldSession(notify: () => void) {
  const state = { editing: false, value: undefined as unknown, error: '' }
  const cancel = () => { state.editing = false; state.error = ''; notify() }
  const save = (persist: (value: unknown) => void): boolean => {
    if (!state.editing) return true
    try { persist(state.value); cancel(); return true }
    catch (error) { state.error = error instanceof Error ? error.message : '保存失败，请检查输入'; notify(); return false }
  }
  return { state, begin: (value: unknown) => { state.value = value; state.error = ''; state.editing = true; notify() },
    change: (value: unknown) => { state.value = value; state.error = ''; notify() }, cancel, save,
    leave: (inside: boolean, persist: (value: unknown) => void) => inside || save(persist) }
}
