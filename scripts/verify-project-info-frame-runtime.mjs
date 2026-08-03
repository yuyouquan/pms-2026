import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

const loadTsxModule = filename => {
  const output = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText
  const module = { exports: {} }
  const evaluate = new Function('module', 'exports', 'require', output)
  evaluate(module, module.exports, require)
  return module.exports
}

const countMarkup = (markup, value) => markup.split(value).length - 1

const { default: ProjectInformationFrame } = loadTsxModule('src/components/project-info/ProjectInformationFrame.tsx')
const frameProps = {
  projectName: '运行时框架验证',
  coreFields: [
    { label: '普通字段', value: '普通值', accent: '#4f46e5' },
    { label: '项目价值', value: '价值内容', accent: '#0f766e', fullWidth: true },
  ],
  actions: null,
  planInformation: React.createElement(
    React.Fragment,
    null,
    React.createElement('article', { id: 'caller-plan-content' }, '计划内容'),
  ),
  informationSections: React.createElement(
    React.Fragment,
    null,
    React.createElement('article', { id: 'caller-information-content' }, '项目信息内容'),
  ),
  anchorItems: [
    { id: 'section-header', label: '项目名称', icon: null },
    { id: 'section-plan', label: '计划信息', icon: null },
    { id: 'section-basic', label: '项目信息', icon: null },
  ],
}
const frameMarkup = renderToStaticMarkup(React.createElement(ProjectInformationFrame, frameProps))

assert.equal(countMarkup(frameMarkup, 'id="section-plan"'), 1, 'a Fragment plan slot receives one real section-plan DOM anchor')
assert.equal(countMarkup(frameMarkup, 'id="section-basic"'), 1, 'a Fragment information slot receives one real section-basic DOM anchor')
assert.equal(countMarkup(frameMarkup, 'id="caller-plan-content"'), 1, 'the frame preserves caller-owned IDs inside the plan slot')
assert.equal(countMarkup(frameMarkup, 'id="caller-information-content"'), 1, 'the frame preserves caller-owned IDs inside the information slot')
assert.match(frameMarkup, /aria-label="项目信息导航"/, 'the complete frame renders its anchor navigation by default')
assert.match(frameMarkup, /pms-project-info-core-item--full-width[^>]*style="[^"]*grid-column:1 \/ -1/, 'full-width core fields expose a stable DOM class and span style')

const embeddedMarkup = renderToStaticMarkup(React.createElement(ProjectInformationFrame, {
  ...frameProps,
  embedded: true,
}))
assert.equal(countMarkup(embeddedMarkup, 'id="section-plan"'), 0, 'embedded frames leave the plan anchor to their existing host')
assert.equal(countMarkup(embeddedMarkup, 'id="section-basic"'), 0, 'embedded frames leave the information anchor to their existing host')
assert.doesNotMatch(embeddedMarkup, /aria-label="项目信息导航"/, 'embedded frames do not render their own anchor navigation')

const { default: CollapsibleInformationSection } = loadTsxModule('src/components/project-info/CollapsibleInformationSection.tsx')
const collapsedMarkup = renderToStaticMarkup(React.createElement(CollapsibleInformationSection, {
  title: '交付物',
}))
assert.match(collapsedMarkup, /aria-expanded="false"/, 'collapsible information sections are closed by default at runtime')
const openEmptyMarkup = renderToStaticMarkup(React.createElement(CollapsibleInformationSection, {
  title: '交付物',
  defaultActive: true,
}))
assert.match(openEmptyMarkup, /暂无数据/, 'a section without children or a custom empty state renders the default empty copy when opened')

console.log('Project information frame runtime verification passed.')
