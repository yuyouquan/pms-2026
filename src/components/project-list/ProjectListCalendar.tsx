'use client'

import { useMemo, useState } from 'react'
import { Button, Space, Tooltip } from 'antd'
import { LeftOutlined, RightOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
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
  const firstDay = month.startOf('month')
  const start = firstDay.subtract((firstDay.day() + 6) % 7, 'day')
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
    <div className="pms-project-calendar pms-project-list-calendar pms-solid-surface" aria-label="项目日历视图">
      <div className="pms-project-calendar-header pms-toolbar">
        <Space size={6} className="pms-project-calendar-navigation">
          <Button size="small" onClick={() => setCalendarMonth(dayjs().startOf('month'))}>今天</Button>
          <Button size="small" type="text" aria-label="上个月" icon={<LeftOutlined />} onClick={() => setCalendarMonth(month => month.subtract(1, 'month'))} />
          <Button size="small" type="text" aria-label="下个月" icon={<RightOutlined />} onClick={() => setCalendarMonth(month => month.add(1, 'month'))} />
          <div className="pms-project-calendar-title">{calendarMonth.format('YYYY年M月')}</div>
        </Space>
        <span className="pms-project-calendar-month-mode" aria-label="当前视图：月">月</span>
      </div>
      <div className="pms-project-calendar-weekdays">
        {WEEKDAYS.map(day => <div key={day}>{day}</div>)}
      </div>
      <div className="pms-project-calendar-grid">
        {calendarDays.map(day => {
          const dayKey = day.format('YYYY-MM-DD')
          const events = eventsByDay.get(dayKey) || []
          const isToday = day.isSame(dayjs(), 'day')
          const dayLabel = day.date() === 1
            ? day.format('M月D日')
            : day.format('D')
          return (
            <div
              key={dayKey}
              className={`pms-project-calendar-cell${day.month() !== calendarMonth.month() ? ' pms-project-calendar-cell-muted' : ''}`}
            >
              <div className="pms-project-calendar-dayline">
                <span className={isToday ? 'pms-project-calendar-today' : undefined}>{dayLabel}</span>
              </div>
              <div className="pms-project-calendar-events">
                {events.slice(0, 3).map(({ row, nodeName }) => {
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
                {events.length > 3 && <div className="pms-project-calendar-more">还有 {events.length - 3} 条记录</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
