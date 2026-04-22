'use client'
import { Card } from 'antd'
import { LockOutlined } from '@ant-design/icons'

type Props = { data: { projectName: string; spm: string } }

export function PermissionNoticeCard({ data }: Props) {
  return (
    <Card size="small" style={{ borderRadius: 8, background: '#fff7e6', borderColor: '#ffd591' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500, marginBottom: 8 }}>
        <LockOutlined style={{ color: '#d48806' }} />
        <span>权限提示</span>
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.8 }}>
        项目：<b>{data.projectName}</b><br/>
        SPM：<b>{data.spm}</b>
      </div>
    </Card>
  )
}
