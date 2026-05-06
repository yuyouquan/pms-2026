import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TOKEN = 'REDACTED'
const FILE_KEY = 'rKjs3JEd23k3Ker6ugu9yJ'

const screens = [
  { file: '01-workspace-cards.png', name: '工作台 - 项目列表' },
  { file: '02-workspace-tracker.png', name: '工作台 - 工作跟踪' },
  { file: '03-project-basic-info.png', name: '项目空间 - 基本信息' },
  { file: '04-plan-L1-table.png', name: '一级计划 - 竖版表格' },
  { file: '05-plan-L1-horizontal.png', name: '一级计划 - 横版表格' },
  { file: '06-plan-L1-gantt.png', name: '一级计划 - 甘特图' },
  { file: '07-roadmap.png', name: '路标视图' },
  { file: '08-config.png', name: '配置中心' },
  { file: '09-permission.png', name: '权限中心' },
  { file: '10-share-whole-machine.png', name: '分享页 - 整机产品项目' },
  { file: '11-share-product.png', name: '分享页 - 产品项目' },
]

async function uploadImages() {
  // Step 1: Upload images to Figma and get image refs
  console.log('Uploading images to Figma...')
  const imageRefs = {}

  for (const screen of screens) {
    const filePath = path.join(__dirname, screen.file)
    if (!fs.existsSync(filePath)) {
      console.log(`  Skipping ${screen.file} (not found)`)
      continue
    }

    const imageData = fs.readFileSync(filePath)
    const resp = await fetch(`https://api.figma.com/v1/images/${FILE_KEY}`, {
      method: 'POST',
      headers: {
        'X-Figma-Token': TOKEN,
        'Content-Type': 'image/png',
      },
      body: imageData,
    })

    if (resp.ok) {
      const data = await resp.json()
      // The response contains a map of image references
      if (data.meta && data.meta.images) {
        const ref = Object.keys(data.meta.images)[0]
        imageRefs[screen.file] = ref
        console.log(`  Uploaded ${screen.name}: ref=${ref}`)
      }
    } else {
      const errText = await resp.text()
      console.log(`  Failed ${screen.name}: ${resp.status} ${errText}`)
    }
  }

  // Step 2: Create frames with image fills using the Plugin API approach
  // Since the REST API doesn't support creating nodes, we'll create a simple
  // approach - just report the image URLs for manual import

  console.log('\n--- Image Upload Results ---')
  console.log(`File: https://www.figma.com/design/${FILE_KEY}`)
  console.log('\nUploaded image refs:')
  for (const [file, ref] of Object.entries(imageRefs)) {
    const screen = screens.find(s => s.file === file)
    console.log(`  ${screen.name}: ${ref}`)
  }

  // Step 3: Try to use the Figma REST API to add a comment with all the image info
  // This at least puts the info inside Figma
  const commentBody = screens.map(s => `- ${s.name}`).join('\n')
  const commentResp = await fetch(`https://api.figma.com/v1/files/${FILE_KEY}/comments`, {
    method: 'POST',
    headers: {
      'X-Figma-Token': TOKEN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: `PMS-2026 UI Screenshots (${new Date().toISOString().split('T')[0]})\n\n${commentBody}\n\nScreenshots captured from dev server for UI review.`,
      client_meta: { x: 0, y: 0 },
    }),
  })

  if (commentResp.ok) {
    console.log('\nComment added to Figma file with screenshot list.')
  }

  console.log('\nDone!')
}

uploadImages().catch(e => { console.error(e); process.exit(1) })
