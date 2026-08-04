#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const source = fs.readFileSync(path.join(root, 'src/containers/ProjectListContainer.tsx'), 'utf8')
const styles = fs.readFileSync(path.join(root, 'src/styles/globals.css'), 'utf8')

assert.match(source, /useEffect/, 'fullscreen lifecycle uses a React effect')
assert.match(source, /FullscreenOutlined/, 'supported views expose a fullscreen icon')
assert.match(source, /FullscreenExitOutlined/, 'fullscreen mode exposes an exit icon')
assert.match(source, /const \[isFullscreen, setIsFullscreen\] = useState\(false\)/)
assert.match(source, /projectListView !== 'card'[\s\S]{0,400}aria-label="全屏展示"[\s\S]{0,180}>全屏<\/Button>/)
assert.match(source, /aria-label="退出全屏"[\s\S]{0,180}>\s*退出全屏\s*<\/Button>/)
assert.match(source, /event\.key === 'Escape'[\s\S]{0,100}setIsFullscreen\(false\)/)
assert.match(source, /document\.body\.style\.overflow = 'hidden'/)
assert.match(source, /document\.body\.style\.overflow = previousOverflow/)
assert.match(source, /className=\{`pms-project-list-content \$\{isFullscreen \? 'is-fullscreen' : ''\}`\.trim\(\)\}/)
assert.match(source, /aria-label=\{isFullscreen \? `\$\{fullscreenViewTitle\}全屏展示` : undefined\}/)
assert.doesNotMatch(source, /requestFullscreen|document\.exitFullscreen/, 'fullscreen stays inside the application UI')

assert.match(styles, /\.pms-project-list-content\.is-fullscreen\s*\{[^}]*position:\s*fixed;[^}]*inset:\s*0;[^}]*z-index:\s*1300;/s)
assert.match(styles, /\.pms-project-list-fullscreen__header\s*\{[^}]*display:\s*flex;[^}]*justify-content:\s*space-between;/s)
assert.match(styles, /\.pms-project-list-content\.is-fullscreen \.pms-project-list-content__body\s*\{[^}]*flex:\s*1;[^}]*overflow:\s*auto;/s)
assert.doesNotMatch(
  styles,
  /@keyframes pms-project-list-fullscreen-enter[\s\S]{0,240}transform:/,
  'fullscreen entry animation must not shrink the viewport overlay',
)

console.log('project list fullscreen contract passed')
