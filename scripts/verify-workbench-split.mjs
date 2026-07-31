#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = relativePath => {
  const file = path.join(root, relativePath)
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
}
const requireContract = (file, pattern, message) => assert.match(read(file), pattern, message)

requireContract('src/stores/ui.ts', /activeModule[\s\S]*?['"]workbench['"][\s\S]*?['"]projectList['"]/, 'UI navigation must model workbench and projectList as distinct modules.')
requireContract('src/stores/ui.ts', /projectSpaceOrigin\b/, 'UI state must retain the project-space origin for source return.')
requireContract('src/stores/ui.ts', /projectSpaceOrigin\.module\b/, 'The UI store must restore the originating module from projectSpaceOrigin.module.')
requireContract('src/stores/ui.ts', /projectSpaceOrigin\.workbenchTab\b/, 'The UI store must restore the originating workbench tab from projectSpaceOrigin.workbenchTab.')
requireContract('src/app/page.tsx', /ProjectListContainer\b/, 'The app router must render the extracted ProjectListContainer.')
requireContract('src/app/page.tsx', /['"]workbench['"]/, 'The app router must have a workbench module branch.')
requireContract('src/app/page.tsx', /['"]projectList['"]/, 'The app router must have a project-list module branch.')
requireContract('src/containers/AppShell.tsx', /navigateWithEditGuard\(\(\)\s*=>\s*returnFromProjectSpace\(\)\)/, 'ProjectSpaceHeader must invoke returnFromProjectSpace through the shared edit guard.')

console.log('workbench split contract passed')
