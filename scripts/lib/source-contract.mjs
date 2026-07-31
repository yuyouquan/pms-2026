import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const moduleCache = new Map()

export const projectRoot = metaUrl => path.resolve(path.dirname(fileURLToPath(metaUrl)), '..')
export const readSource = (root, relativePath) => {
  const file = path.join(root, relativePath)
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
}
export const requireSource = (root, relativePath, pattern, message) => {
  assert.match(readSource(root, relativePath), pattern, message)
}

const resolveModule = (root, specifier, parentPath) => {
  const base = specifier.startsWith('@/')
    ? path.join(root, 'src', specifier.slice(2))
    : specifier.startsWith('.') ? path.resolve(path.dirname(parentPath), specifier) : null
  if (!base) return require.resolve(specifier)
  for (const extension of ['', '.ts', '.tsx', '.js', '.jsx']) {
    const candidate = `${base}${extension}`
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate
  }
  for (const extension of ['.ts', '.tsx', '.js', '.jsx']) {
    const candidate = path.join(base, `index${extension}`)
    if (fs.existsSync(candidate)) return candidate
  }
  throw new Error('unresolved dependency')
}

const loadResolved = (root, modulePath) => {
  const resolved = path.resolve(modulePath)
  if (!fs.existsSync(resolved)) throw new Error('missing module')
  if (moduleCache.has(resolved)) return moduleCache.get(resolved).exports
  const module = { exports: {} }
  moduleCache.set(resolved, module)
  const output = ts.transpileModule(fs.readFileSync(resolved, 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: resolved,
  }).outputText
  const localRequire = specifier => {
    const dependency = resolveModule(root, specifier, resolved)
    return /\.(?:ts|tsx|js|jsx)$/.test(dependency) ? loadResolved(root, dependency) : require(dependency)
  }
  const wrapper = vm.runInThisContext(`(function (exports, require, module, __filename, __dirname) {${output}\n})`, { filename: resolved })
  wrapper(module.exports, localRequire, module, resolved, path.dirname(resolved))
  return module.exports
}

export const loadTypeScriptModule = (root, relativePath) => {
  const absolutePath = path.join(root, relativePath)
  if (!fs.existsSync(absolutePath)) assert.fail(`contract module missing: ${relativePath}`)
  return loadResolved(root, absolutePath)
}

export const hasCallExpression = (source, name) => {
  const file = ts.createSourceFile('contract.tsx', source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX)
  let found = false
  const visit = node => {
    if (ts.isCallExpression(node) && node.expression.getText(file).endsWith(name)) found = true
    ts.forEachChild(node, visit)
  }
  visit(file)
  return found
}
