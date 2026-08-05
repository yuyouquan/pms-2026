import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const failures = []

function read(file) {
  const target = path.join(root, file)
  return fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : ''
}

function sourceFiles(dir) {
  const target = path.join(root, dir)
  if (!fs.existsSync(target)) return []

  return fs.readdirSync(target, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(relativePath)
    return /\.tsx?$/.test(entry.name) ? [relativePath] : []
  })
}

function expectIncludes(file, fragments) {
  const contents = read(file)
  for (const fragment of fragments) {
    if (!contents.includes(fragment)) {
      failures.push(`${file} is missing ${fragment}`)
    }
  }
}

sourceFiles('src')

expectIncludes('src/theme/pmsTheme.ts', [
  "brandStrong: '#5D49F6'",
  "brandMain: '#7562FF'",
  "brandSoft: '#AD98EE'",
  "brandSurface: '#F5F3FF'",
  'export const pmsTheme',
  "colorBorderSecondary: '#EFEDF4'",
  "fontFamily: '-apple-system, BlinkMacSystemFont, \"SF Pro Text\", \"Segoe UI\", \"PingFang SC\", \"Hiragino Sans GB\", \"Microsoft YaHei\", sans-serif'",
])
expectIncludes('src/components/shared/PmsThemeProvider.tsx', [
  "'use client'",
  '<ConfigProvider',
  'theme={pmsTheme}',
  'button={{ autoInsertSpace: false }}',
])
expectIncludes('src/app/layout.tsx', [
  "import PmsThemeProvider from '@/components/shared/PmsThemeProvider'",
  '<PmsThemeProvider>{children}</PmsThemeProvider>',
])
expectIncludes('src/styles/globals.css', [
  '--pms-brand-strong: #5d49f6;',
  '--pms-brand: #7562ff;',
  '--pms-brand-soft: #ad98ee;',
  '--pms-brand-surface: #f5f3ff;',
  '--pms-gradient-brand:',
  '--pms-glass-filter: blur(14px) saturate(145%);',
  '--pms-shadow-glass: 0 12px 32px rgb(75 59 148 / 8%);',
  '--pms-shadow-floating: 0 22px 60px rgb(79 62 158 / 12%);',
])

if (failures.length > 0) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('Liquid glass core theme contract passed')
