'use client'
import { Button, Dropdown, Empty, Modal, Input } from 'antd'
import {
  PlusOutlined, PushpinOutlined, EditOutlined, DeleteOutlined,
  MoreOutlined, MenuFoldOutlined, MenuUnfoldOutlined,
} from '@ant-design/icons'
import { useState } from 'react'
import { useAIChatStore } from '@/stores/ai-chat'
import type { Conversation } from '@/types/ai'

function groupByTime(conversations: Conversation[]) {
  const now = Date.now()
  const oneDay = 24 * 60 * 60 * 1000
  const today: Conversation[] = []
  const thisWeek: Conversation[] = []
  const earlier: Conversation[] = []
  conversations.forEach(c => {
    const diff = now - c.updatedAt
    if (diff < oneDay) today.push(c)
    else if (diff < 7 * oneDay) thisWeek.push(c)
    else earlier.push(c)
  })
  return { today, thisWeek, earlier }
}

export function ConversationSidebar() {
  const {
    conversations, activeConversationId, setActiveConversation,
    createConversation, renameConversation, pinConversation, deleteConversation,
  } = useAIChatStore()
  const [collapsed, setCollapsed] = useState(true)
  const [renameTarget, setRenameTarget] = useState<{ id: string; title: string } | null>(null)
  const [renameValue, setRenameValue] = useState('')

  if (collapsed) {
    return (
      <div style={{ width: 48, borderRight: '1px solid #f0f0f0', padding: '8px 4px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        background: '#fafbfc' }}>
        <Button type="text" icon={<MenuUnfoldOutlined />} onClick={() => setCollapsed(false)} />
        <Button type="primary" shape="circle" icon={<PlusOutlined />}
          onClick={createConversation} size="small" title="新对话" />
      </div>
    )
  }

  const pinned = conversations.filter(c => c.pinned)
  const rest = conversations.filter(c => !c.pinned)
  const groups = groupByTime(rest)

  const renderItem = (c: Conversation) => (
    <div key={c.id}
      onClick={() => setActiveConversation(c.id)}
      style={{ display: 'flex', alignItems: 'center', padding: '6px 12px', cursor: 'pointer',
        background: c.id === activeConversationId ? '#e6f4ff' : 'transparent',
        borderRadius: 6, marginBottom: 2 }}
    >
      {c.pinned && <PushpinOutlined style={{ marginRight: 6, fontSize: 10, color: '#faad14' }} />}
      <span style={{ flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {c.title}
      </span>
      <Dropdown
        menu={{
          items: [
            { key: 'rename', label: '重命名', icon: <EditOutlined />,
              onClick: () => {
                setRenameTarget({ id: c.id, title: c.title })
                setRenameValue(c.title)
              } },
            { key: 'pin', label: c.pinned ? '取消置顶' : '置顶', icon: <PushpinOutlined />,
              onClick: () => pinConversation(c.id) },
            { key: 'delete', label: '删除', icon: <DeleteOutlined />, danger: true,
              onClick: () => deleteConversation(c.id) },
          ],
        }}
        trigger={['click']}
      >
        <Button size="small" type="text" icon={<MoreOutlined />} onClick={e => e.stopPropagation()} />
      </Dropdown>
    </div>
  )

  return (
    <div style={{ width: 240, borderRight: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column',
      background: '#fafbfc' }}>
      <div style={{ padding: 12, display: 'flex', gap: 6 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={createConversation} style={{ flex: 1 }}>新对话</Button>
        <Button type="text" icon={<MenuFoldOutlined />} onClick={() => setCollapsed(true)} />
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px 12px' }}>
        {conversations.length === 0 && (
          <Empty description="暂无会话" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ marginTop: 40 }} />
        )}
        {pinned.length > 0 && (<>
          <div style={{ padding: '6px 12px', fontSize: 11, color: '#8c8c8c' }}>📌 置顶</div>
          {pinned.map(renderItem)}
        </>)}
        {groups.today.length > 0 && (<>
          <div style={{ padding: '6px 12px', fontSize: 11, color: '#8c8c8c' }}>今天</div>
          {groups.today.map(renderItem)}
        </>)}
        {groups.thisWeek.length > 0 && (<>
          <div style={{ padding: '6px 12px', fontSize: 11, color: '#8c8c8c' }}>本周</div>
          {groups.thisWeek.map(renderItem)}
        </>)}
        {groups.earlier.length > 0 && (<>
          <div style={{ padding: '6px 12px', fontSize: 11, color: '#8c8c8c' }}>更早</div>
          {groups.earlier.map(renderItem)}
        </>)}
      </div>
      <Modal
        open={!!renameTarget}
        title="重命名会话"
        onCancel={() => setRenameTarget(null)}
        onOk={() => {
          if (renameTarget && renameValue.trim()) {
            renameConversation(renameTarget.id, renameValue.trim())
          }
          setRenameTarget(null)
        }}
        okText="确认"
        cancelText="取消"
      >
        <Input value={renameValue} onChange={e => setRenameValue(e.target.value)} autoFocus />
      </Modal>
    </div>
  )
}
