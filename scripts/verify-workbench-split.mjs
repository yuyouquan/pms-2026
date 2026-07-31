#!/usr/bin/env node
import { projectRoot, requireSource } from './lib/source-contract.mjs'

const root = projectRoot(import.meta.url)
requireSource(root, 'src/stores/ui.ts', /activeModule[\s\S]*?['"]workbench['"][\s\S]*?['"]projectList['"]/, 'missing workbench and project-list modules')
requireSource(root, 'src/stores/ui.ts', /projectSpaceOrigin\b/, 'missing project-space origin state')
requireSource(root, 'src/stores/ui.ts', /projectSpaceOrigin\.module\b/, 'origin return must restore its module')
requireSource(root, 'src/stores/ui.ts', /projectSpaceOrigin\.workbenchTab\b/, 'origin return must restore its workbench tab')
requireSource(root, 'src/app/page.tsx', /ProjectListContainer\b/, 'missing ProjectListContainer route')
requireSource(root, 'src/app/page.tsx', /['"]workbench['"]/, 'missing workbench route branch')
requireSource(root, 'src/app/page.tsx', /['"]projectList['"]/, 'missing project-list route branch')
requireSource(root, 'src/containers/AppShell.tsx', /navigateWithEditGuard\(\(\)\s*=>\s*returnFromProjectSpace\(\)\)/, 'ProjectSpaceHeader must guard source return')
console.log('workbench split contract passed')
