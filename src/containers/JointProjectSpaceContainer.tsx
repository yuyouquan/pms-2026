'use client'

import { Card, Tabs } from 'antd'
import JointMrVersionPlan from '@/components/joint/JointMrVersionPlan'

export default function JointProjectSpaceContainer() {
  return (
    <section className="pms-joint-space" aria-label="联合项目空间">
      <Card className="pms-joint-space__card pms-solid-surface" bordered={false}>
        <Tabs
          className="pms-joint-space__tabs"
          activeKey="mr-version-plan"
          items={[{
            key: 'mr-version-plan',
            label: 'tOS&整机MR版本计划',
            children: <JointMrVersionPlan />,
          }]}
        />
      </Card>
    </section>
  )
}
