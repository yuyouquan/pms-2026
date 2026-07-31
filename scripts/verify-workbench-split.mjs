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
requireContract('src/app/page.tsx', /ProjectListContainer\b/, 'The app router must render the extracted ProjectListContainer.')
requireContract('src/app/page.tsx', /['"]workbench['"]/, 'The app router must have a workbench module branch.')
requireContract('src/app/page.tsx', /['"]projectList['"]/, 'The app router must have a project-list module branch.')
requireContract('src/containers/AppShell.tsx', /projectSpaceOrigin\b/, 'Project-space header must read the saved navigation origin.')
requireContract('src/containers/AppShell.tsx', /navigateWithEditGuard\(/, 'Source return must pass through the shared edit guard.')
requireContract('src/containers/AppShell.tsx', /returnFromProjectSpace\b/, 'Project-space header must centralize source return for the origin object.')
requireContract('src/containers/AppShell.tsx', /projectSpaceOrigin\.module\b/, 'Source return must restore the originating module from projectSpaceOrigin.module.')
requireContract('src/containers/AppShell.tsx', /projectSpaceOrigin\.workbenchTab\b/, 'Source return must restore the originating workbench tab from projectSpaceOrigin.workbenchTab.')

console.log('workbench split contract passed')
