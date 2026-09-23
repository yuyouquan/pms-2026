/** Actual field event handlers, kept independent of React for executable lifecycle tests. */
export function createInlineFieldSession(notify: (state: { editing: boolean; dirty: boolean }) => void) {
  let initialValue: unknown
  const state = { editing: false, dirty: false, value: undefined as unknown, error: '', revision: 0 }
  const cancel = () => { state.editing = false; state.dirty = false; state.error = ''; state.revision++; notify(state) }
  const save = (persist: (value: unknown) => void): boolean => {
    if (!state.editing) return true
    try { persist(state.value); cancel(); return true }
    catch (error) { state.error = error instanceof Error ? error.message : '保存失败，请检查输入'; notify(state); return false }
  }
  return { state, begin: (value: unknown) => { initialValue = value; state.value = value; state.dirty = false; state.error = ''; state.editing = true; notify(state) },
    change: (value: unknown) => { state.dirty = !Object.is(value, initialValue); state.value = value; state.error = ''; notify(state) }, cancel, save,
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
