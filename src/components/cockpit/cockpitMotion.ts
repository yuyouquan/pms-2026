import { Easing, interpolate } from 'remotion'

export const COCKPIT_MOTION_FPS = 60
const easing = Easing.bezier(.22, 1, .36, 1)
export function cockpitMotionProgress(frame: number, duration: number): number {
  return interpolate(frame, [0, Math.max(1, duration)], [0, 1], { easing, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
}
export const cockpitTweenValue = (from: number, to: number, progress: number) => interpolate(progress, [0, 1], [from, to], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

/** Remotion's deterministic virtual frames are sampled for the live browser's native animation timeline. */
export function cockpitMotionFrames(kind: 'enter' | 'line' | 'bar', seconds: number): Keyframe[] {
  const frames = Math.max(1, Math.round(seconds * COCKPIT_MOTION_FPS))
  return Array.from({ length: frames + 1 }, (_, frame) => {
    const progress = cockpitMotionProgress(frame, frames), offset = frame / frames
    if (kind === 'line') return { offset, strokeDashoffset: String(1 - progress), opacity: .35 + progress * .65 }
    if (kind === 'bar') return { offset, transform: `scaleY(${.025 + progress * .975})`, opacity: .45 + progress * .55 }
    return { offset, opacity: .12 + progress * .88, transform: `translateY(${(1 - progress) * 8}px)` }
  })
}
