'use client'
import { useRef, type ReactNode } from 'react'
import { useCockpitMotion } from '@/components/cockpit/useCockpitMotion'

export default function CockpitMotionContent({ motionKey, children }: { motionKey: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useCockpitMotion(ref, motionKey, 'content')
  return <div ref={ref} className="cockpit-tab-content">{children}</div>
}
