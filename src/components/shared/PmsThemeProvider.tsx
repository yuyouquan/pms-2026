'use client'

import { App, ConfigProvider } from 'antd'
import { pmsTheme } from '@/theme/pmsTheme'

export default function PmsThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider theme={pmsTheme} button={{ autoInsertSpace: false }}>
      <App>{children}</App>
    </ConfigProvider>
  )
}
