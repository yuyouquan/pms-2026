#!/usr/bin/env node
import assert from 'node:assert/strict'
import { loadTypeScriptModule, projectRoot } from './lib/source-contract.mjs'

const root = projectRoot(import.meta.url)
const React = loadTypeScriptModule(root, 'node_modules/react/index.js')
const { renderToStaticMarkup } = loadTypeScriptModule(root, 'node_modules/react-dom/server.node.js')
const { ProjectCard } = loadTypeScriptModule(root, 'src/components/workspace/WorkspaceModule.tsx')
const rawMarketName = 'TECNO CAMON 40'
const project = {
  id: 'machine-1', name: 'CAMON project', type: '整机产品项目', status: '进行中',
  progress: 0, leader: '张三', markets: [], androidVersion: '', chipPlatform: '', spm: '张三',
  updatedAt: '', productLine: 'CAMON', tosVersion: '', marketName: rawMarketName, brand: 'TECNO',
}
const html = renderToStaticMarkup(React.createElement(ProjectCard, {
  project,
  setSelectedProject: () => {},
  setProjectSpaceModule: () => {},
  setActiveModule: () => {},
  PROJECT_STATUS_CONFIG: {},
}))

assert.match(html, /市场名: CAMON 40/, 'project card shows the brand-free market label')
assert.match(html, /title="CAMON 40"/, 'project card tooltip uses the same display label')
assert.doesNotMatch(html, /市场名: TECNO CAMON 40/, 'raw brand prefix is hidden in the card')
assert.equal(project.marketName, rawMarketName, 'display rendering does not mutate project data')

console.log('project-view market display: passed')
