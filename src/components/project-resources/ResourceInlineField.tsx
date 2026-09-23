'use client'
import { cloneElement, useEffect, useId, useReducer, useRef, type ReactElement, type ReactNode } from 'react'
import { useUiStore } from '@/stores/ui'
import { createInlineFieldSession } from '@/components/project-resources/inlineFieldSession'

// A failed field can retain its draft while keyboard focus moves to another field.
const activeFields = new Set<string>()
const setFieldEditing = (id: string, editing: boolean) => {
  if (editing) activeFields.add(id)
  else activeFields.delete(id)
  useUiStore.getState().setIsEditMode(activeFields.size > 0)
}

export default function ResourceInlineField({ label, value, display, readOnly = false, onSave, renderEditor }: {
  label: string; value: unknown; display?: ReactNode; readOnly?: boolean; onSave: (value: unknown) => void
  renderEditor: (value: unknown, change: (value: unknown) => void, popup: () => HTMLElement) => ReactNode
}) {
  const [, redraw] = useReducer(n => n + 1, 0)
  const id = useId()
  const session = useRef(createInlineFieldSession(state => {
    setFieldEditing(id, state.editing && state.dirty)
    redraw()
  })).current
  const root = useRef<HTMLDivElement>(null)
  const popupRoot = useRef<HTMLDivElement | null>(null)
  const saveRef = useRef(onSave); saveRef.current = onSave
  const { editing, error } = session.state
  useEffect(() => {
    if (!editing) return
    const inside = (target: Node) => !!(root.current?.contains(target) || popupRoot.current?.contains(target))
    const outside = (event: PointerEvent) => {
      if (!session.leave(inside(event.target as Node), saveRef.current)) {
        event.preventDefault(); event.stopImmediatePropagation()
      } else if (!session.state.editing) setFieldEditing(id, false)
    }
    const preventFailedLeave = (event: MouseEvent) => {
      if (session.state.error && !inside(event.target as Node)) { event.preventDefault(); event.stopImmediatePropagation() }
    }
    const escape = (event: KeyboardEvent) => {
      if (inside(event.target as Node) && session.captureEscape(event)) setFieldEditing(id, false)
    }
    document.addEventListener('keydown', escape, true)
    document.addEventListener('pointerdown', outside, true)
    document.addEventListener('click', preventFailedLeave, true)
    return () => {
      document.removeEventListener('keydown', escape, true)
      document.removeEventListener('pointerdown', outside, true)
      document.removeEventListener('click', preventFailedLeave, true)
      popupRoot.current?.remove(); popupRoot.current = null
      setFieldEditing(id, false)
    }
  }, [editing, session, id])
  useEffect(() => { if (readOnly && session.state.editing) session.cancel() }, [readOnly, session])
  const change = (next: unknown) => {
    if (readOnly) return
    if (!session.state.editing) session.begin(value)
    session.change(next)
  }
  return <div ref={root} className={`pms-resource-inline-field${!readOnly ? ' is-editable' : ''}${editing ? ' is-editing' : ''}`} data-field-label={label}
    onFocusCapture={() => { if (!readOnly && !session.state.editing) session.begin(value) }}
    onBlur={event => {
      if (session.state.editing && event.relatedTarget && !event.currentTarget.contains(event.relatedTarget) && !popupRoot.current?.contains(event.relatedTarget)) session.save(saveRef.current)
    }} onKeyDown={event => {
      if (!session.state.editing) return
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); session.cancel() }
      else if (event.key === 'Enter' && !(event.target as HTMLElement).closest('.ant-select-dropdown, .ant-picker-panel')) {
        event.preventDefault(); event.stopPropagation(); session.save(saveRef.current)
      }
    }}>
    {!readOnly ? <><div key={`${session.state.revision}:${String(value ?? '')}`} aria-describedby={error ? id : undefined}>{renderEditor(editing ? session.state.value : value, change, () => {
        if (!popupRoot.current) { popupRoot.current = document.createElement('div'); popupRoot.current.dataset.resourceInlinePopup = id; document.body.appendChild(popupRoot.current) }
        return popupRoot.current
      })}</div>
      {error && <span role="alert" id={id} className="pms-resource-inline-error">{error}</span>}</>
      : <span className="pms-resource-inline-value">{display ?? (value === null || value === undefined || value === '' ? '待填写' : String(value))}</span>}
  </div>
}

/** Adapt existing controlled Select/InputNumber cells without changing legacy form behavior. */
export function ResourceInlineControl({ label, control, display }: { label: string; control: ReactElement; display?: ReactNode }) {
  const props = control.props as { value: unknown; onChange: (value: unknown) => void }
  return <ResourceInlineField label={label} value={props.value} display={display} onSave={props.onChange}
    renderEditor={(value, onChange, getPopupContainer) => cloneElement(control, { value, onChange, ...('options' in props ? { getPopupContainer } : {}), autoFocus: false } as Record<string, unknown>)} />
}
