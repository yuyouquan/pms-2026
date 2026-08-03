'use client'

import { useMemo, useState } from 'react'
import { Button, Space, Tooltip } from 'antd'
import dayjs from 'dayjs'

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export interface ProjectListCalendarRow extends Record<string, unknown> {
  key: string
  projectId: string
  projectName: string
  targetProjectId?: string
  targetSubprojectId?: string
}

export interface ProjectListCalendarMilestoneDefinition {
  key: string
  label: string
}

export interface ProjectListCalendarProps {
  rows: readonly ProjectListCalendarRow[]
  milestoneDefinitions: readonly ProjectListCalendarMilestoneDefinition[]
  onOpenRow: (row: ProjectListCalendarRow) => void
}

const getCalendarDays = (month: dayjs.Dayjs) => {
  const start = month.startOf('month').startOf('week')
  return Array.from({ length: 42 }, (_, index) => start.add(index, 'day'))
}

export default function ProjectListCalendar({
  rows,
  milestoneDefinitions,
  onOpenRow,
}: ProjectListCalendarProps) {
  const [calendarMonth, setCalendarMonth] = useState(() => dayjs().startOf('month'))
  const calendarDays = useMemo(() => getCalendarDays(calendarMonth), [calendarMonth])
  const eventsByDay = useMemo(() => {
    const events = new Map<string, Array<{ row: ProjectListCalendarRow; nodeName: string }>>()
    rows.forEach(row => {
      milestoneDefinitions.forEach(definition => {
        const rawDate = String(row[definition.key] || '').trim()
        if (!ISO_DATE.test(rawDate) || !dayjs(rawDate, 'YYYY-MM-DD', true).isValid()) return
        events.set(rawDate, [...(events.get(rawDate) || []), { row, nodeName: definition.label }])
      })
    })
    return events
  }, [milestoneDefinitions, rows])

  return (
    <div className="pms-project-calendar pms-project-list-calendar" aria-label="项目日历视图">
      <div className="pms-project-calendar-header">
        <div className="pms-project-calendar-title">{calendarMonth.format('YYYY年M月')}</div>
        <Space size={6}>
          <Button size="small" shape="circle" aria-label="上个月" onClick={() => setCalendarMonth(month => month.subtract(1, 'month'))}>‹</Button>
          <Button size="small" onClick={() => setCalendarMonth(dayjs().startOf('month'))}>今天</Button>
          <Button size="small" shape="circle" aria-label="下个月" onClick={() => setCalendarMonth(month => month.add(1, 'month'))}>›</Button>
        </Space>
      </div>
      <div className="pms-project-calendar-weekdays">
        {WEEKDAYS.map(day => <div key={day}>{day}</div>)}
      </div>
      <div className="pms-project-calendar-grid">
        {calendarDays.map(day => {
          const dayKey = day.format('YYYY-MM-DD')
          const events = eventsByDay.get(dayKey) || []
          return (
            <div
              key={dayKey}
              className={`pms-project-calendar-cell${day.month() !== calendarMonth.month() ? ' pms-project-calendar-cell-muted' : ''}`}
            >
              <div className="pms-project-calendar-dayline"><span>{day.format('D日')}</span></div>
              <div className="pms-project-calendar-events">
                {events.slice(0, 4).map(({ row, nodeName }) => {
                  const title = `${nodeName} · ${row.projectName}`
                  return (
                    <Tooltip title={title} key={`${row.key}-${nodeName}-${dayKey}`}>
                      <button
                        type="button"
                        className="pms-project-calendar-event-single pms-project-list-calendar-event"
                        onClick={() => onOpenRow(row)}
                      >
                        {title}
                      </button>
                    </Tooltip>
                  )
                })}
                {events.length > 4 && <div className="pms-project-calendar-more">+{events.length - 4} 个节点</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
