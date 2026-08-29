const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000
const SAFE_MIDNIGHT_OFFSET_MS = 25

const SHANGHAI_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export type ShanghaiBusinessTimerId = ReturnType<typeof setTimeout>

export interface ShanghaiBusinessDateTimer {
  now: () => Date
  setTimer: (callback: () => void, delay: number) => ShanghaiBusinessTimerId
  clearTimer: (timerId: ShanghaiBusinessTimerId) => void
}

export function getShanghaiBusinessDate(now: Date): string {
  if (Number.isNaN(now.getTime())) return ''
  const parts = new Map(SHANGHAI_DATE_FORMATTER.formatToParts(now).map(part => [part.type, part.value]))
  return `${parts.get('year')}-${parts.get('month')}-${parts.get('day')}`
}

export function getNextShanghaiBusinessDateDelay(
  now: Date,
  safeOffsetMs = SAFE_MIDNIGHT_OFFSET_MS,
): number {
  if (Number.isNaN(now.getTime())) return 1
  const localDate = getShanghaiBusinessDate(now)
  const [year, month, day] = localDate.split('-').map(Number)
  const nextMidnightUtc = Date.UTC(year, month - 1, day + 1) - SHANGHAI_OFFSET_MS
  return Math.max(1, nextMidnightUtc - now.getTime() + Math.max(0, safeOffsetMs))
}

const defaultTimer: ShanghaiBusinessDateTimer = {
  now: () => new Date(),
  setTimer: (callback, delay) => setTimeout(callback, delay),
  clearTimer: timerId => clearTimeout(timerId),
}

export function createShanghaiBusinessDateTicker(
  onDateChange: (businessDate: string) => void,
  timer: ShanghaiBusinessDateTimer = defaultTimer,
): () => void {
  let active = true
  let currentDate = getShanghaiBusinessDate(timer.now())
  let timerId: ShanghaiBusinessTimerId | null = null

  const schedule = () => {
    if (!active) return
    timerId = timer.setTimer(() => {
      timerId = null
      if (!active) return
      const nextDate = getShanghaiBusinessDate(timer.now())
      if (nextDate && nextDate !== currentDate) {
        currentDate = nextDate
        onDateChange(nextDate)
      }
      schedule()
    }, getNextShanghaiBusinessDateDelay(timer.now()))
  }

  schedule()
  return () => {
    active = false
    if (timerId !== null) timer.clearTimer(timerId)
    timerId = null
  }
}
