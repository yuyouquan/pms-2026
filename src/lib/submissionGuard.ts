export interface SubmissionGuard {
  tryBeginSubmit: () => boolean
  releaseSubmission: (afterCurrentTick?: boolean) => void
  dispose: () => void
}

/** Framework-free submission lock used by overlay hooks and executable contracts. */
export function createSubmissionGuard(): SubmissionGuard {
  let locked = false
  let unlockTimer: ReturnType<typeof setTimeout> | null = null

  const clearUnlockTimer = () => {
    if (unlockTimer === null) return
    clearTimeout(unlockTimer)
    unlockTimer = null
  }

  return {
    tryBeginSubmit: () => {
      if (locked) return false
      locked = true
      return true
    },
    releaseSubmission: (afterCurrentTick = false) => {
      clearUnlockTimer()
      if (!afterCurrentTick) {
        locked = false
        return
      }
      unlockTimer = setTimeout(() => {
        locked = false
        unlockTimer = null
      }, 0)
    },
    dispose: () => {
      clearUnlockTimer()
      locked = false
    },
  }
}
