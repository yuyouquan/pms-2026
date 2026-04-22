'use client'
import { Drawer } from 'antd'
import { useAIChatStore } from '@/stores/ai-chat'
import AIAssistantContainer from './AIAssistantContainer'

export default function AIAssistantDrawer() {
  const { drawerOpen, setDrawerOpen } = useAIChatStore()

  return (
    <Drawer
      open={drawerOpen}
      onClose={() => setDrawerOpen(false)}
      placement="right"
      width={960}
      closable
      destroyOnClose={false}
      styles={{ body: { padding: 0 } }}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>🤖</span>
          <span style={{ fontWeight: 600 }}>智能助手</span>
        </div>
      }
    >
      <AIAssistantContainer />
    </Drawer>
  )
}
