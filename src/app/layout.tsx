import type { Metadata } from 'next'
import '@/styles/globals.css'
import PmsThemeProvider from '@/components/shared/PmsThemeProvider'

export const metadata: Metadata = {
  title: '项目管理系统',
  description: '企业级项目管理平台',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body><PmsThemeProvider>{children}</PmsThemeProvider></body>
    </html>
  )
}
