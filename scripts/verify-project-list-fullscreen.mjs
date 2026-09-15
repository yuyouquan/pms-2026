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
assert.match(source, /const \[fullscreenPhase, setFullscreenPhase\] = useState<'closed' \| 'open' \| 'closing'>\('closed'\)/, 'fullscreen tracks its closing animation phase')
assert.match(source, /const isFullscreen = fullscreenPhase !== 'closed'/, 'the overlay remains mounted until exit finishes')
assert.match(source, /projectListView !== 'card'[\s\S]{0,400}aria-label="全屏展示"[\s\S]{0,120}icon=\{<FullscreenOutlined \/>\}[\s\S]{0,120}setFullscreenPhase\('open'\)/)
assert.match(source, /aria-label="退出全屏"[\s\S]{0,120}icon=\{<FullscreenExitOutlined \/>\}[\s\S]{0,120}onClick=\{exitFullscreen\}/)
assert.match(source, /event\.key === 'Escape'[\s\S]{0,100}exitFullscreen\(\)/)
assert.match(source, /window\.matchMedia\('\(prefers-reduced-motion: reduce\)'\)\.matches \? 'closed' : 'closing'/, 'reduced-motion users exit immediately')
assert.match(source, /fullscreenPhase !== 'closing'[\s\S]{0,250}window\.setTimeout\(\(\) => setFullscreenPhase\('closed'\), 300\)/, 'interrupted exit animations have a completion fallback')
assert.match(source, /event\.target === event\.currentTarget && event\.animationName === 'pms-project-list-fullscreen-exit'[\s\S]{0,100}setFullscreenPhase\('closed'\)/, 'only the overlay exit animation closes fullscreen')
assert.match(source, /document\.body\.style\.overflow = 'hidden'/)
assert.match(source, /document\.body\.style\.overflow = previousOverflow/)
assert.match(
  source,
  /<section\s+className=\{`pms-project-list-content \$\{isFullscreen \? 'is-fullscreen pms-page-shell' : ''\}\$\{fullscreenPhase === 'closing' \? ' is-fullscreen-closing' : ''\}`\.trim\(\)\}/,
  'the fixed fullscreen section owns the semantic page shell',
)
assert.doesNotMatch(
  source,
  /pms-project-list-content__body[^\n]*pms-page-shell/,
  'the inner fullscreen body must not own the page shell',
)
assert.match(source, /aria-label=\{isFullscreen \? `\$\{fullscreenViewTitle\}全屏展示` : undefined\}/)
assert.doesNotMatch(source, /requestFullscreen|document\.exitFullscreen/, 'fullscreen stays inside the application UI')

assert.match(styles, /\.pms-project-list-content\.is-fullscreen\s*\{[^}]*position:\s*fixed;[^}]*inset:\s*0;[^}]*z-index:\s*1300;/s)
assert.doesNotMatch(
  styles,
  /\.pms-project-list-content\.is-fullscreen\s*\{[^}]*background:/s,
  'the fixed fullscreen rule must allow pms-page-shell to provide var(--pms-page)',
)
assert.match(styles, /\.pms-project-list-fullscreen__header\s*\{[^}]*display:\s*flex;[^}]*justify-content:\s*space-between;/s)
assert.match(styles, /\.pms-project-list-content\.is-fullscreen \.pms-project-list-content__body\s*\{[^}]*flex:\s*1;[^}]*overflow:\s*auto;/s)
assert.match(
  styles,
  /@keyframes pms-project-list-fullscreen-enter\s*\{\s*from\s*\{[^}]*\}\s*to\s*\{[^}]*opacity:\s*1;[^}]*transform:\s*none;/,
  'fullscreen entry animation restores an untransformed opaque viewport overlay',
)
assert.match(styles, /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.pms-project-list-content\.is-fullscreen\s*\{\s*animation:\s*none;/, 'fullscreen entry respects reduced-motion preferences')

console.log('project list fullscreen contract passed')
