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
    leave: (inside: boolean, persist: (value: unknown) => void) => inside || save(persist),
    captureEscape: (event: { key: string; preventDefault: () => void; stopImmediatePropagation: () => void }) => {
      if (!state.editing || event.key !== 'Escape') return false
      event.preventDefault(); event.stopImmediatePropagation(); cancel(); return true
    } }
}

/** DatePicker commits onChange only after blur/Enter; retain the actual input before outside capture saves. */
export function inlineDateInputHandlers(change: (value: unknown) => void) {
  return { onInputCapture: (event: { target: EventTarget | { tagName?: string; value?: unknown } }) => {
    const target = event.target as { tagName?: string; value?: unknown }
    if (target.tagName === 'INPUT' && typeof target.value === 'string') change(target.value || null)
  } }
}

/** Each async parser/confirmation keeps the lifetime of the owner that initiated it. */
export function createInlineImportSession() {
  let active = true, generation = 0
  return {
    activate: () => { active = true; generation++ },
    invalidate: () => { active = false; generation++ },
    capture: (isCurrent: () => boolean) => {
      const started = generation
      return () => active && generation === started && isCurrent()
    },
  }
}
