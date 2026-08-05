'use client'

import { ConfigProvider } from 'antd'
import { pmsTheme } from '@/theme/pmsTheme'

export default function PmsThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider theme={pmsTheme} button={{ autoInsertSpace: false }}>
      {children}
    </ConfigProvider>
  )
}
