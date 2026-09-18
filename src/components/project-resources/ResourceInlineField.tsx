'use client'
import { cloneElement, useEffect, useId, useReducer, useRef, type ReactElement, type ReactNode } from 'react'
import { Button, Tooltip } from 'antd'
import { EditOutlined } from '@ant-design/icons'
import { useUiStore } from '@/stores/ui'
import { createInlineFieldSession } from '@/components/project-resources/inlineFieldSession'

export default function ResourceInlineField({ label, value, display, readOnly = false, onSave, renderEditor }: {
  label: string; value: unknown; display?: ReactNode; readOnly?: boolean; onSave: (value: unknown) => void
  renderEditor: (value: unknown, change: (value: unknown) => void, popup: () => HTMLElement) => ReactNode
}) {
  const [, redraw] = useReducer(n => n + 1, 0)
  const session = useRef(createInlineFieldSession(redraw)).current
  const root = useRef<HTMLDivElement>(null)
  const popupRoot = useRef<HTMLDivElement | null>(null)
  const saveRef = useRef(onSave); saveRef.current = onSave
  const id = useId()
  const { editing, error } = session.state
  useEffect(() => {
    if (!editing) return
    useUiStore.getState().setIsEditMode(true)
    const inside = (target: Node) => !!(root.current?.contains(target) || popupRoot.current?.contains(target))
    const outside = (event: PointerEvent) => {
      if (!session.leave(inside(event.target as Node), saveRef.current)) {
        event.preventDefault(); event.stopImmediatePropagation()
      } else if (!session.state.editing) useUiStore.getState().setIsEditMode(false)
    }
    const preventFailedLeave = (event: MouseEvent) => {
      if (session.state.error && !inside(event.target as Node)) { event.preventDefault(); event.stopImmediatePropagation() }
    }
    document.addEventListener('pointerdown', outside, true)
    document.addEventListener('click', preventFailedLeave, true)
    return () => {
      document.removeEventListener('pointerdown', outside, true)
      document.removeEventListener('click', preventFailedLeave, true)
      popupRoot.current?.remove(); popupRoot.current = null
      useUiStore.getState().setIsEditMode(false)
    }
  }, [editing, session])
  useEffect(() => { if (readOnly && session.state.editing) session.cancel() }, [readOnly, session])
  return <div ref={root} className={`pms-resource-inline-field${editing ? ' is-editing' : ''}`} data-field-label={label}
    onBlur={event => {
      if (session.state.editing && event.relatedTarget && !event.currentTarget.contains(event.relatedTarget) && !popupRoot.current?.contains(event.relatedTarget)) session.save(saveRef.current)
    }} onKeyDown={event => {
      if (!session.state.editing) return
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); session.cancel() }
      else if (event.key === 'Enter' && !(event.target as HTMLElement).closest('.ant-select-dropdown, .ant-picker-panel')) {
        event.preventDefault(); event.stopPropagation(); session.save(saveRef.current)
      }
    }}>
    {editing && !readOnly ? <><div aria-describedby={error ? id : undefined}>{renderEditor(session.state.value, session.change, () => {
        if (!popupRoot.current) { popupRoot.current = document.createElement('div'); popupRoot.current.dataset.resourceInlinePopup = id; document.body.appendChild(popupRoot.current) }
        return popupRoot.current
      })}</div>
      {error && <span role="alert" id={id} className="pms-resource-inline-error">{error}</span>}</>
      : <><span className="pms-resource-inline-value">{display ?? (value === null || value === undefined || value === '' ? '待填写' : String(value))}</span>
        {!readOnly && <Tooltip title={`编辑${label}`}><Button type="text" size="small" className="pms-resource-inline-trigger" aria-label={`编辑${label}`} icon={<EditOutlined />} onClick={() => session.begin(value)} /></Tooltip>}</>}
  </div>
}

/** Adapt existing controlled Select/InputNumber cells without changing legacy form behavior. */
export function ResourceInlineControl({ label, control, display }: { label: string; control: ReactElement; display?: ReactNode }) {
  const props = control.props as { value: unknown; onChange: (value: unknown) => void }
  return <ResourceInlineField label={label} value={props.value} display={display} onSave={props.onChange}
    renderEditor={(value, onChange, getPopupContainer) => cloneElement(control, { value, onChange, ...('options' in props ? { getPopupContainer } : {}), autoFocus: true } as Record<string, unknown>)} />
}
