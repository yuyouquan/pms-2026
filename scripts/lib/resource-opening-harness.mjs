import fs from 'node:fs'
import ts from 'typescript'
// Execute the production context against each component harness's registry.
export function resourceOpeningHarness(projectState) {
  const module = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync('src/lib/resourceMutationContext.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  new Function('require', 'module', 'exports', code)(id => {
    if (id === '@/stores/project') return { useProjectStore: { getState: projectState } }
    if (id === '@/lib/projectTeamMutationGuard') return { projectTeamScopeToken: scope => scope }
    throw new Error(`Unexpected context dependency: ${id}`)
  }, module, module.exports)
  return module.exports
}
