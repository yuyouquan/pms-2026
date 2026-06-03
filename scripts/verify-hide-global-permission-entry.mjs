import assert from 'node:assert/strict'
import fs from 'node:fs'

const appShell = fs.readFileSync('src/containers/AppShell.tsx', 'utf8')
const homePage = fs.readFileSync('src/app/page.tsx', 'utf8')

assert.equal(
  appShell.includes("key: 'globalPermission'"),
  false,
  'MainHeader should not expose the outer global permission center menu item',
)

assert.equal(
  homePage.includes('GlobalPermissionContainer'),
  false,
  'Home page should not import or render the outer global permission center',
)

assert.equal(
  homePage.includes("activeModule === 'globalPermission'"),
  false,
  'Home page should not keep a hidden globalPermission render branch',
)

console.log('global permission entry is hidden from home')
