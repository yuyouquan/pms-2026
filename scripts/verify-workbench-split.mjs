#!/usr/bin/env node
import assert from 'node:assert/strict'
import { hasCallExpression, projectRoot, readSource, requireSource } from './lib/source-contract.mjs'

const root = projectRoot(import.meta.url)
requireSource(root, 'src/stores/ui.ts', /activeModule[\s\S]*?['"]workbench['"][\s\S]*?['"]projectList['"]/, 'missing workbench and project-list modules')
requireSource(root, 'src/stores/ui.ts', /projectSpaceOrigin\b/, 'missing project-space origin state')
requireSource(root, 'src/stores/ui.ts', /projectSpaceOrigin\.module\b/, 'origin return must restore its module')
requireSource(root, 'src/stores/ui.ts', /projectSpaceOrigin\.workbenchTab\b/, 'origin return must restore its workbench tab')
requireSource(root, 'src/app/page.tsx', /ProjectListContainer\b/, 'missing ProjectListContainer route')
requireSource(root, 'src/app/page.tsx', /['"]workbench['"]/, 'missing workbench route branch')
requireSource(root, 'src/app/page.tsx', /['"]projectList['"]/, 'missing project-list route branch')
const uiSource = readSource(root, 'src/stores/ui.ts')
assert.equal(hasCallExpression(uiSource, 'returnFromProjectSpace'), true, 'UI store exposes an origin return action')
assert.ok(/projectSpaceOrigin\.module/.test(uiSource) && /projectSpaceOrigin\.workbenchTab/.test(uiSource), 'origin return reads module and workbench tab')
const shellSource = readSource(root, 'src/containers/AppShell.tsx')
assert.equal(hasCallExpression(shellSource, 'navigateWithEditGuard'), true, 'ProjectSpaceHeader calls edit guard')
assert.equal(hasCallExpression(shellSource, 'returnFromProjectSpace'), true, 'ProjectSpaceHeader calls origin return')
console.log('workbench split contract passed')
