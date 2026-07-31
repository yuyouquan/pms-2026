#!/usr/bin/env node
import { projectRoot, requireSource } from './lib/source-contract.mjs'

const root = projectRoot(import.meta.url)
requireSource(root, 'src/types/technicalProject.ts', /TechnicalProjectType[\s\S]*?['"]TDT['"][\s\S]*?['"]subproject['"]/, 'missing TDT and subproject type contract')
requireSource(root, 'src/constants/technicalProject.ts', /TECHNICAL_PROJECT_TYPES\b/, 'missing technical project type constants')
requireSource(root, 'src/lib/technicalProjectRules.ts', /validateTechnicalProjectType\b/, 'missing technical project type validation rule')
requireSource(root, 'src/lib/technicalProjectRules.ts', /subproject[\s\S]*?parent/, 'subproject rules must require a TDT parent')
console.log('technical project contract passed')
