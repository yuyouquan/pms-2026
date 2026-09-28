/** Run every independent Node verification; browser acceptance is performed separately. */
import { spawn } from 'node:child_process'
import { mkdtemp, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const exclusions = new Map([
  ['verify-full-regression.mjs', 'this runner'],
  ['verify-project-resource-regression.mjs', 'aggregate; its individual checks run here'],
  ['verify-legacy-template-routes.mjs', 'browser scenario; verify through the browser tool'],
])
const scripts = (await readdir(path.join(root, 'scripts')))
  .filter(name => /^verify-.*\.[cm]js$/.test(name) && !exclusions.has(name)).sort()
const directory = await mkdtemp(path.join(tmpdir(), 'pms-full-regression-'))
const results = []
let next = 0
console.log(`Running ${scripts.length} independent checks; evidence: ${directory}`)
async function worker() {
  while (next < scripts.length) {
    const name = scripts[next++]
    const started = Date.now()
    const result = await new Promise(resolve => {
      let output = ''
      const child = spawn(process.execPath, [path.join(root, 'scripts', name)], {
        cwd: root, stdio: ['ignore', 'pipe', 'pipe'],
      })
      child.stdout.on('data', chunk => { output += chunk })
      child.stderr.on('data', chunk => { output += chunk })
      const timeout = setTimeout(() => child.kill('SIGTERM'), 180_000)
      child.on('error', error => { output += error.stack })
      child.on('close', (code, signal) => {
        clearTimeout(timeout)
        resolve({ name, code: code ?? 1, signal, durationMs: Date.now() - started, output })
      })
    })
    await writeFile(path.join(directory, `${name}.log`), result.output)
    const { output, ...entry } = result
    results.push(entry)
    console.log(`${entry.code === 0 ? 'PASS' : 'FAIL'} ${name}`)
    if (entry.code !== 0) console.error(output.slice(-4000))
  }
}
await Promise.all(Array.from({ length: 2 }, worker))
results.sort((a, b) => a.name.localeCompare(b.name))
await writeFile(path.join(directory, 'summary.json'), JSON.stringify({
  results, exclusions: Object.fromEntries(exclusions),
}, null, 2))
const failures = results.filter(result => result.code !== 0)
console.log(`${results.length - failures.length}/${results.length} passed; evidence: ${directory}`)
process.exitCode = failures.length ? 1 : 0
