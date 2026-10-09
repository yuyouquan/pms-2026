'use client'
import { formatCockpit } from '@/components/cockpit/cockpitData'
import { useCockpitNumber } from '@/components/cockpit/useCockpitMotion'

export default function CockpitNumber({ value, suffix = '', context }: { value?: number; suffix?: string; context: string }) {
  const target = value !== undefined && Number.isFinite(value) ? value : undefined
  const display = useCockpitNumber(target, context)
  return <span aria-label={`${formatCockpit(target)}${target === undefined ? '' : suffix}`} data-motion-value={target ?? 'missing'}><span aria-hidden="true">{formatCockpit(display)}{target === undefined ? '' : suffix}</span></span>
}
