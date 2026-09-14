'use client'

import { Button, Card, Tag } from 'antd'
import { CalendarOutlined, EditOutlined, ProjectOutlined } from '@ant-design/icons'
import { toRoadmapSpaceFormProject } from '@/lib/roadmapSpaceEditor'
import { formatRoadmapTosValue } from '@/lib/roadmapValidation'
import type { ProjectItem } from '@/types/app'

export default function RoadmapProjectInformationView({ project, canEdit, onEdit }: {
  project: ProjectItem; canEdit: boolean; onEdit: () => void
}) {
  const values = toRoadmapSpaceFormProject(project)
  const groups = [
    { title: '项目分类与识别', items: [
      ['项目分类', project.type], ['项目二级分类', values.machineProjectType],
      ['安卓版本', values.androidVersion], ['产品类型', values.productType],
      ['tOS 版本', formatRoadmapTosValue(values.firstSaleTosVersionId)],
    ] },
    { title: '产品与版本', items: [
      ['品牌', values.brand], ['产品线', values.productLine], ['产品系列', values.productSeries],
      ['市场名', values.marketName], ['芯片编码', values.chipCode], ['起步 RAM', values.startRam],
      ['版本类型', values.versionType], ['开发模式', values.developMode],
    ] },
  ]
  return <div className="pms-roadmap-project-info" aria-label="路标项目基础信息">
    <Card className="pms-project-info-core-card" title={<span className="pms-roadmap-project-info__title"><ProjectOutlined />{project.name}</span>}
      extra={<Button icon={<EditOutlined />} onClick={onEdit} disabled={!canEdit}>编辑</Button>}>
      <div className="pms-roadmap-project-info__dates">
        {[
          { label: 'STR5 时间', date: values.str5Date, estimated: values.str5Estimated },
          { label: '上市时间', date: values.launchDate, estimated: values.launchEstimated },
        ].map(item => <div key={item.label} className="pms-roadmap-project-info__date">
          <span><CalendarOutlined /> {item.label}</span>
          <div><strong>{item.date || '待填写'}</strong>{item.estimated && <Tag color="orange">预估</Tag>}</div>
        </div>)}
      </div>
    </Card>
    {groups.map(group => <Card key={group.title} size="small" title={group.title}>
      <dl className="pms-roadmap-project-info__fields">{group.items.map(([label, value]) => <div key={label}>
        <dt>{label}</dt><dd>{value || <span className="pms-project-info-empty">待填写</span>}</dd>
      </div>)}</dl>
    </Card>)}
    <Card size="small" title="备注"><div className="pms-roadmap-project-info__remark">{values.remark || <span className="pms-project-info-empty">暂无备注</span>}</div></Card>
  </div>
}
