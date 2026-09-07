'use client'

import { App, ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { pmsTheme } from '@/theme/pmsTheme'

export default function PmsThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider theme={pmsTheme} locale={zhCN} button={{ autoInsertSpace: false }}>
      <App>{children}</App>
    </ConfigProvider>
  )
}
