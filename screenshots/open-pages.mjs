// 自动依次打开每个页面，等你捕获完按回车继续下一个
import readline from 'readline'
import { exec } from 'child_process'

const BASE = 'http://localhost:3004'

const pages = [
  { name: '1/10 工作台 - 项目列表', url: `${BASE}` },
  { name: '2/10 项目空间 (点击任意项目卡片进入后再捕获)', url: `${BASE}` },
  { name: '3/10 一级计划 - 竖版表格 (侧栏点计划，确认竖版视图)', url: null },
  { name: '4/10 一级计划 - 横版表格 (切换到横版表格)', url: null },
  { name: '5/10 一级计划 - 甘特图 (切换到甘特图)', url: null },
  { name: '6/10 路标视图', url: `${BASE}` },
  { name: '7/10 配置中心', url: `${BASE}` },
  { name: '8/10 权限中心', url: `${BASE}` },
  { name: '9/10 分享页 - 整机产品项目', url: `${BASE}/share/plan?projectId=1&level=level1` },
  { name: '10/10 分享页 - 产品项目', url: `${BASE}/share/plan?projectId=2&level=level1` },
]

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const ask = (q) => new Promise(r => rl.question(q, r))

console.log('=== PMS-2026 → Figma 捕获助手 ===')
console.log('确保已在 Figma 中打开 HTML to Figma 插件\n')

for (const page of pages) {
  console.log(`\n📌 ${page.name}`)
  if (page.url) {
    exec(`open "${page.url}"`)
    console.log(`   已在浏览器打开: ${page.url}`)
  } else {
    console.log(`   请在当前浏览器页面中手动操作`)
  }
  console.log('   👉 点击 Chrome 扩展图标 → Capture → 回到 Figma 点 Import')
  await ask('   按回车继续下一个...')
}

console.log('\n✅ 全部完成！去 Figma 中整理排列各 Frame 即可。')
rl.close()
