'use client'

import { useMemo, useState } from 'react'
import { Card, Tag, Input, Space } from 'antd'
import { SearchOutlined, SettingOutlined } from '@ant-design/icons'
import type { ConfigModuleKey } from '@/types/hrConfig'
import { CONFIG_MODULE_MAP } from '@/constants/hrConfig'
import { useHrConfigStore } from '@/stores/hrConfig'
import ConfigTablePanel from './ConfigTablePanel'
import ConfigEditModal from './ConfigEditModal'

interface ConfigContentProps {
  moduleKey: ConfigModuleKey
}

export default function ConfigContent({ moduleKey }: ConfigContentProps) {
  const moduleMeta = CONFIG_MODULE_MAP[moduleKey]
  const { showEditModal, editingId, setShowEditModal, setEditingId } = useHrConfigStore()

  // ── 搜索状态（由 ConfigTablePanel 内部管理，此处仅用于 header 展示） ──
  const [searchKeyword, setSearchKeyword] = useState('')

  const headerRight = useMemo(() => (
    <Space size={8}>
      <Tag color="purple" style={{ marginInlineEnd: 0 }}>
        {moduleMeta.category}
      </Tag>
      <Input
        allowClear
        size="small"
        placeholder="搜索配置..."
        prefix={<SearchOutlined style={{ color: 'var(--pms-text-tertiary)' }} />}
        style={{ width: 200 }}
        value={searchKeyword}
        onChange={(e) => setSearchKeyword(e.target.value)}
      />
    </Space>
  ), [moduleMeta.category, searchKeyword])

  return (
    <div className="pms-hr-config-content">
      {/* 模块标题区 */}
      <Card
        className="pms-hr-config-header"
        size="small"
        style={{ marginBottom: 12 }}
        styles={{ body: { padding: '14px 20px' } }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <SettingOutlined style={{ fontSize: 18, color: 'var(--pms-brand)' }} />
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--pms-text-primary)' }}>
                {moduleMeta.label}
              </div>
              <div style={{ fontSize: 12, color: 'var(--pms-text-tertiary)', marginTop: 2 }}>
                {moduleMeta.description}
              </div>
            </div>
          </div>
          {headerRight}
        </div>
      </Card>

      {/* 表格面板 */}
      <ConfigTablePanel moduleMeta={moduleMeta} searchKeyword={searchKeyword} />

      {/* 编辑弹窗 */}
      <ConfigEditModal
        open={showEditModal}
        moduleMeta={moduleMeta}
        recordId={editingId}
        onCancel={() => {
          setShowEditModal(false)
          setEditingId(null)
        }}
      />
    </div>
  )
}
