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
      width={720}
      closable
      destroyOnClose={false}
      styles={{ body: { padding: 0 } }}
      title={null}
    >
      <AIAssistantContainer />
    </Drawer>
  )
}
