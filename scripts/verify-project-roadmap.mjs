#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import ts from 'typescript'

const root = process.cwd()
const require = createRequire(import.meta.url)
const assertions = []

export function registerAssertion(name, assertion) {
  assertions.push({ name, assertion })
}

export function resolveTypeScriptModule(specifier, parentPath = path.join(root, 'index.ts')) {
  const candidate = specifier.startsWith('@/')
    ? path.join(root, 'src', specifier.slice(2))
    : specifier.startsWith('.')
      ? path.resolve(path.dirname(parentPath), specifier)
      : null

  if (!candidate) return require.resolve(specifier)

  for (const extension of ['', '.ts', '.tsx', '.js', '.jsx']) {
    const resolved = `${candidate}${extension}`
    if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) return resolved
  }

  for (const extension of ['.ts', '.tsx', '.js', '.jsx']) {
    const resolved = path.join(candidate, `index${extension}`)
    if (fs.existsSync(resolved)) return resolved
  }

  throw new Error(`Cannot resolve module "${specifier}" from ${parentPath}`)
}

export function loadTypeScriptModule(modulePath, moduleCache = new Map()) {
  const resolvedPath = path.resolve(modulePath)
  if (moduleCache.has(resolvedPath)) return moduleCache.get(resolvedPath).exports

  const module = { exports: {} }
  moduleCache.set(resolvedPath, module)
  const source = fs.readFileSync(resolvedPath, 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: resolvedPath,
  }).outputText
  const localRequire = specifier => {
    const dependencyPath = resolveTypeScriptModule(specifier, resolvedPath)
    return /\.(?:ts|tsx|js|jsx)$/.test(dependencyPath)
      ? loadTypeScriptModule(dependencyPath, moduleCache)
      : require(dependencyPath)
  }
  const wrapper = vm.runInThisContext(`(function (exports, require, module, __filename, __dirname) {${compiled}\n})`, {
    filename: resolvedPath,
  })
  wrapper(module.exports, localRequire, module, resolvedPath, path.dirname(resolvedPath))
  return module.exports
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function findLegacyRoadmapReferences(content) {
  const references = []
  const legacyModulePattern = /import\s+(?:[\s\S]*?\s+from\s+)?['"]\.\/(MilestoneView|MRTrainView)['"]/g
  const defaultImportPattern = /import\s+([A-Za-z_$][\w$]*)\s*(?:,\s*[\s\S]*?)?\s+from\s+['"]\.\/(?:MilestoneView|MRTrainView)['"]/g
  const legacyJsxNames = new Set(['MilestoneView', 'MRTrainView'])

  for (const match of content.matchAll(legacyModulePattern)) {
    references.push(`legacy module import: ./${match[1]}`)
  }
  for (const match of content.matchAll(defaultImportPattern)) {
    legacyJsxNames.add(match[1])
  }
  for (const name of legacyJsxNames) {
    if (new RegExp(`<\\s*${escapeRegExp(name)}\\b`).test(content)) {
      references.push(`legacy JSX mount: <${name}`)
    }
  }

  return references
}

const roadmapPath = path.join(root, 'src/components/roadmap/RoadmapView.tsx')
const roadmapSource = fs.readFileSync(roadmapPath, 'utf8')

registerAssertion('RoadmapView does not import or mount legacy roadmap views', () => {
  const legacyReferences = findLegacyRoadmapReferences(roadmapSource)
  if (legacyReferences.length) {
    throw new Error(`found ${legacyReferences.join(', ')}`)
  }
})

registerAssertion('legacy roadmap detector catches aliased double-quoted imports and mounts', () => {
  const fixture = 'import LegacyMilestone from "./MilestoneView"\nconst view = <LegacyMilestone />'
  const references = findLegacyRoadmapReferences(fixture)
  if (references.length !== 2) {
    throw new Error(`expected two legacy references, found ${references.length}`)
  }
})

registerAssertion('RoadmapView retains the summary shell and blank roadmap branch', () => {
  for (const requiredFragment of [
    '<ProjectPlanSummaryBoard',
    "label: '项目路标视图'",
    ') : null}',
  ]) {
    if (!roadmapSource.includes(requiredFragment)) {
      throw new Error(`missing cleared-roadmap baseline fragment: ${requiredFragment}`)
    }
  }
})

const failures = []
for (const { name, assertion } of assertions) {
  try {
    assertion()
    console.log(`PASS ${name}`)
  } catch (error) {
    failures.push({ name, error })
    console.error(`FAIL ${name}: ${error.message}`)
  }
}

if (failures.length) process.exit(1)

console.log(`Project roadmap baseline verification passed (${assertions.length} assertions).`)
