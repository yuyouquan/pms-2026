'use client'

import { useEffect, useState } from 'react'
import dayjs from 'dayjs'

const localToday = () => dayjs().format('YYYY-MM-DD')

export function useLocalToday(): string {
  const [today, setToday] = useState(localToday)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const scheduleNextMidnight = () => {
      const now = dayjs()
      const milliseconds = now.add(1, 'day').startOf('day').diff(now) + 50
      timer = setTimeout(() => {
        setToday(localToday())
        scheduleNextMidnight()
      }, milliseconds)
    }
    scheduleNextMidnight()
    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [])

  return today
}
