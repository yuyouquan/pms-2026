import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const BRAND_HEX_LITERALS = ['#5d49f6', '#7562ff', '#ad98ee', '#f5f3ff', '#dcd6ff']
const BRAND_HEX_PATTERN = new RegExp(`(?:${BRAND_HEX_LITERALS.join('|')})\\b`, 'gi')
const LEGACY_BRAND_HEX = new Set(['1e1b4b', '312e81', '3730a3', '4338ca', '4f46e5', '5558e6', '5b5cf6', '6366f1', '818cf8'])
const LEGACY_BRAND_RGB = new Set([
  '30,27,75',
  '49,46,129',
  '55,48,163',
  '67,56,202',
  '79,70,229',
  '85,88,230',
  '91,92,246',
  '99,102,241',
  '129,140,248',
])
const LEGACY_BRAND_LITERAL_PATTERN = /#(?:[\da-f]{6})\b|\brgba?\([^)]*\)/gi
const THEME_SOURCE = 'src/theme/pmsTheme.ts'
const CSS_SOURCE = 'src/styles/globals.css'

const groups = {
  shell: [
    'src/app/page.tsx',
    'src/containers/AppShell.tsx',
  ],
  workbench: [
    'src/containers/WorkbenchContainer.tsx',
    'src/containers/ProjectListContainer.tsx',
    'src/components/work-tracker/WorkTracker.tsx',
    'src/components/workspace/TodoCenter.tsx',
    'src/components/workspace/WorkspaceModule.tsx',
    'src/components/workspace/AddProjectModal.tsx',
    'src/components/project-summary/ProjectSummaryTable.tsx',
    'src/components/project-list/ProjectListCalendar.tsx',
  ],
}

// Task 4 removes these migration-baseline exceptions when the roadmap is migrated.
const ROADMAP_BASELINE_EXCEPTIONS = {
  'src/components/roadmap/MilestoneView.tsx': { literal: '#f5f3ff', count: 1 },
  'src/components/roadmap/ProjectPlanSummaryBoard.tsx': { literal: '#f5f3ff', count: 2 },
}

function read(file, root) {
  const target = path.join(root, file)
  return fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : ''
}

function normalizeRepoPath(file) {
  return file.replaceAll('\\', '/')
}

function sourceFiles(dir, root) {
  const target = path.join(root, dir)
  if (!fs.existsSync(target)) return []

  return fs.readdirSync(target, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      const relativePath = path.posix.join(normalizeRepoPath(dir), entry.name)
      if (entry.isDirectory()) return sourceFiles(relativePath, root)
      return /\.tsx?$/.test(entry.name) ? [relativePath] : []
    })
}

function rawBrandFailures(root) {
  const failures = []

  for (const file of sourceFiles('src', root)) {
    const normalizedFile = normalizeRepoPath(file)
    if (normalizedFile === THEME_SOURCE) continue

    const literals = [...read(normalizedFile, root).matchAll(BRAND_HEX_PATTERN)]
      .map((match) => match[0].toLowerCase())
    if (literals.length === 0) continue

    const uniqueLiterals = [...new Set(literals)]
    const exception = ROADMAP_BASELINE_EXCEPTIONS[normalizedFile]
    if (!exception) {
      failures.push(`${normalizedFile}: forbidden raw PMS brand literal(s): ${uniqueLiterals.join(', ')}`)
      continue
    }

    const invalidLiteral = uniqueLiterals.some((literal) => literal !== exception.literal)
    if (invalidLiteral || literals.length !== exception.count) {
      failures.push(
        `${normalizedFile}: baseline allows exactly ${exception.count} ${exception.literal}; found ${literals.length} (${uniqueLiterals.join(', ')})`,
      )
    }
  }

  return failures
}

function expectContentPatterns(failures, file, contents, expectations) {
  for (const { label, pattern } of expectations) {
    if (!pattern.test(contents)) {
      failures.push(`${file} is missing ${label}`)
    }
  }
}

function expectPatterns(failures, root, file, expectations) {
  expectContentPatterns(failures, file, read(file, root), expectations)
}

function expectNoMatches(failures, root, file, expectations) {
  const contents = read(file, root)
  for (const { label, pattern } of expectations) {
    if (pattern.test(contents)) {
      failures.push(`${file} must not include ${label}`)
    }
  }
}

function expectNoLegacyBrand(failures, root, file) {
  const matches = legacyBrandMatches(read(file, root))
  if (matches.length === 0) return

  failures.push(`${file}: legacy brand literal(s): ${[...new Set(matches)].join(', ')}`)
}

function legacyBrandMatches(contents) {
  return [...contents.matchAll(LEGACY_BRAND_LITERAL_PATTERN)]
    .filter((match) => {
      const sourceLiteral = match[0]
      if (sourceLiteral.startsWith('#')) {
        return LEGACY_BRAND_HEX.has(sourceLiteral.slice(1).toLowerCase())
      }

      const inner = sourceLiteral.slice(sourceLiteral.indexOf('(') + 1, -1).trim()
      const commaSyntax = inner.includes(',')
      const colorSource = commaSyntax ? inner.split(',').slice(0, 3) : inner.split('/')[0].trim().split(/\s+/)
      if (colorSource.length !== 3) return false

      const components = colorSource.map((component) => Number(component.trim()))
      if (components.some((component) => !Number.isFinite(component) || component < 0 || component > 255)) return false
      return LEGACY_BRAND_RGB.has(components.join(','))
    })
    .map((match) => match[0])
}

function legacyBrandScannerSelfTestFailures() {
  const failures = []
  const legacyFixtures = [
    '#6366F1',
    'rgb(99, 102, 241)',
    'RGB(99 102 241)',
    'rgba(99,102,241,.04)',
    'rgba(99 102 241 / 4%)',
    'rgb(67 56 202 / .3)',
  ]
  const safeFixtures = [
    'rgb(98 102 241)',
    'rgba(99 101 241 / .3)',
    'rgb(255 77 79)',
  ]

  for (const fixture of legacyFixtures) {
    const matches = legacyBrandMatches(`const fixture = '${fixture}'`)
    if (!matches.includes(fixture)) {
      failures.push(`legacy brand scanner self-test did not detect source literal ${fixture}`)
    }
  }
  for (const fixture of safeFixtures) {
    if (legacyBrandMatches(`const fixture = '${fixture}'`).length > 0) {
      failures.push(`legacy brand scanner self-test incorrectly detected ${fixture}`)
    }
  }

  return failures
}

function groupedLegacyBrandFailures(root) {
  const failures = []
  for (const files of Object.values(groups)) {
    for (const file of files) expectNoLegacyBrand(failures, root, file)
  }
  return failures
}

function extractRootBlock(css) {
  let rootStart = -1
  let openingBrace = -1
  let quote = null
  let inComment = false

  for (let index = 0; index < css.length; index += 1) {
    const character = css[index]
    const nextCharacter = css[index + 1]

    if (inComment) {
      if (character === '*' && nextCharacter === '/') {
        inComment = false
        index += 1
      }
      continue
    }

    if (quote) {
      if (character === '\\') {
        index += 1
      } else if (character === quote) {
        quote = null
      }
      continue
    }

    if (character === '/' && nextCharacter === '*') {
      inComment = true
      index += 1
    } else if (character === '"' || character === "'") {
      quote = character
    } else if (css.startsWith(':root', index)) {
      const rootDeclaration = /^:root\s*\{/.exec(css.slice(index))
      if (rootDeclaration) {
        rootStart = index
        openingBrace = index + rootDeclaration[0].lastIndexOf('{')
        break
      }
    }
  }

  if (rootStart === -1) {
    return { error: 'is missing a :root block' }
  }

  let depth = 0
  quote = null
  inComment = false

  for (let index = openingBrace; index < css.length; index += 1) {
    const character = css[index]
    const nextCharacter = css[index + 1]

    if (inComment) {
      if (character === '*' && nextCharacter === '/') {
        inComment = false
        index += 1
      }
      continue
    }

    if (quote) {
      if (character === '\\') {
        index += 1
      } else if (character === quote) {
        quote = null
      }
      continue
    }

    if (character === '/' && nextCharacter === '*') {
      inComment = true
      index += 1
    } else if (character === '"' || character === "'") {
      quote = character
    } else if (character === '{') {
      depth += 1
    } else if (character === '}') {
      depth -= 1
      if (depth === 0) {
        return {
          rootBlock: css.slice(rootStart, index + 1),
          outsideRoot: `${css.slice(0, rootStart)}${css.slice(index + 1)}`,
        }
      }
    }
  }

  return { error: 'has an unclosed :root block' }
}

function stripCssComments(css) {
  let output = ''
  let quote = null
  let inComment = false

  for (let index = 0; index < css.length; index += 1) {
    const character = css[index]
    const nextCharacter = css[index + 1]

    if (inComment) {
      if (character === '*' && nextCharacter === '/') {
        inComment = false
        index += 1
      }
      continue
    }

    if (quote) {
      output += character
      if (character === '\\' && nextCharacter) {
        output += nextCharacter
        index += 1
      } else if (character === quote) {
        quote = null
      }
      continue
    }

    if (character === '/' && nextCharacter === '*') {
      inComment = true
      index += 1
    } else {
      output += character
      if (character === '"' || character === "'") quote = character
    }
  }

  return output
}

const CSS_ROOT_EXPECTATIONS = [
  { label: '--pms-brand-strong token', pattern: /^\s*--pms-brand-strong:\s*#5d49f6;$/im },
  { label: '--pms-brand token', pattern: /^\s*--pms-brand:\s*#7562ff;$/im },
  { label: '--pms-brand-soft token', pattern: /^\s*--pms-brand-soft:\s*#ad98ee;$/im },
  { label: '--pms-brand-surface token', pattern: /^\s*--pms-brand-surface:\s*#f5f3ff;$/im },
  { label: '--pms-brand-border token', pattern: /^\s*--pms-brand-border:\s*#dcd6ff;$/im },
  { label: 'approved brand gradient', pattern: /^\s*--pms-gradient-brand:\s*linear-gradient\(106deg,\s*#5d49f6\s+0%,\s*#7562ff\s+50%,\s*#ad98ee\s+100%\);$/im },
  { label: '--pms-page token', pattern: /^\s*--pms-page:\s*#f4f6fb;$/im },
  { label: '--pms-surface-solid token', pattern: /^\s*--pms-surface-solid:\s*#fff;$/im },
  { label: '--pms-surface-glass token', pattern: /^\s*--pms-surface-glass:\s*rgb\(255\s+255\s+255\s*\/\s*76%\);$/im },
  { label: '--pms-text-primary token', pattern: /^\s*--pms-text-primary:\s*#27243a;$/im },
  { label: '--pms-text-secondary token', pattern: /^\s*--pms-text-secondary:\s*#625d70;$/im },
  { label: '--pms-text-tertiary token', pattern: /^\s*--pms-text-tertiary:\s*#817b90;$/im },
  { label: '--pms-border token', pattern: /^\s*--pms-border:\s*#e6e3ef;$/im },
  { label: '--pms-radius-control token', pattern: /^\s*--pms-radius-control:\s*8px;$/im },
  { label: '--pms-radius-surface token', pattern: /^\s*--pms-radius-surface:\s*12px;$/im },
  { label: '--pms-glass-filter token', pattern: /^\s*--pms-glass-filter:\s*blur\(14px\)\s+saturate\(145%\);$/im },
  { label: '--pms-shadow-glass token', pattern: /^\s*--pms-shadow-glass:\s*0\s+12px\s+32px\s+rgb\(75\s+59\s+148\s*\/\s*8%\);$/im },
  { label: '--pms-shadow-floating token', pattern: /^\s*--pms-shadow-floating:\s*0\s+22px\s+60px\s+rgb\(79\s+62\s+158\s*\/\s*12%\);$/im },
  { label: '--primary compatibility mapping', pattern: /^\s*--primary:\s*var\(--pms-brand-strong\);$/m },
  { label: '--accent compatibility mapping', pattern: /^\s*--accent:\s*var\(--pms-brand\);$/m },
  { label: '--text-primary compatibility mapping', pattern: /^\s*--text-primary:\s*var\(--pms-text-primary\);$/m },
  { label: '--bg-primary compatibility mapping', pattern: /^\s*--bg-primary:\s*var\(--pms-page\);$/m },
  { label: '--border compatibility mapping', pattern: /^\s*--border:\s*var\(--pms-border\);$/m },
  { label: '--radius-md compatibility mapping', pattern: /^\s*--radius-md:\s*var\(--pms-radius-control\);$/m },
  { label: '--shadow-md compatibility mapping', pattern: /^\s*--shadow-md:\s*var\(--pms-shadow-glass\);$/m },
]

function findCssCharacter(css, target, start = 0) {
  let quote = null
  let inComment = false

  for (let index = start; index < css.length; index += 1) {
    const character = css[index]
    const nextCharacter = css[index + 1]

    if (inComment) {
      if (character === '*' && nextCharacter === '/') {
        inComment = false
        index += 1
      }
      continue
    }

    if (quote) {
      if (character === '\\') index += 1
      else if (character === quote) quote = null
      continue
    }

    if (character === '/' && nextCharacter === '*') {
      inComment = true
      index += 1
    } else if (character === '"' || character === "'") {
      quote = character
    } else if (character === target) {
      return index
    }
  }

  return -1
}

function findCssBlockEnd(css, openingBrace) {
  let depth = 0
  let quote = null
  let inComment = false

  for (let index = openingBrace; index < css.length; index += 1) {
    const character = css[index]
    const nextCharacter = css[index + 1]

    if (inComment) {
      if (character === '*' && nextCharacter === '/') {
        inComment = false
        index += 1
      }
      continue
    }

    if (quote) {
      if (character === '\\') index += 1
      else if (character === quote) quote = null
      continue
    }

    if (character === '/' && nextCharacter === '*') {
      inComment = true
      index += 1
    } else if (character === '"' || character === "'") {
      quote = character
    } else if (character === '{') {
      depth += 1
    } else if (character === '}') {
      depth -= 1
      if (depth === 0) return index
    }
  }

  return -1
}

function extractBalancedCssBlock(css, openingBrace) {
  const closingBrace = findCssBlockEnd(css, openingBrace)
  return closingBrace === -1 ? null : css.slice(openingBrace + 1, closingBrace)
}

function extractCssBlocks(css, headerPattern) {
  const source = stripCssComments(css)
  const flags = headerPattern.flags.includes('g')
    ? headerPattern.flags
    : `${headerPattern.flags}g`
  const matcher = new RegExp(headerPattern.source, flags)
  const blocks = []
  let match

  while ((match = matcher.exec(source)) !== null) {
    const openingBrace = findCssCharacter(source, '{', match.index + match[0].length)
    const block = openingBrace === -1 ? null : extractBalancedCssBlock(source, openingBrace)
    if (block !== null) blocks.push(block)
  }

  return blocks
}

function normalizeCssValue(value) {
  return value.trim().replace(/\s+/g, ' ')
}

function normalizeSelector(selector) {
  return selector.trim().replace(/\s+/g, ' ')
}

function splitCssList(value) {
  const entries = []
  let start = 0
  let depth = 0
  let quote = null

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]
    if (quote) {
      if (character === '\\') index += 1
      else if (character === quote) quote = null
      continue
    }

    if (character === '"' || character === "'") quote = character
    else if (character === '(' || character === '[') depth += 1
    else if (character === ')' || character === ']') depth -= 1
    else if (character === ',' && depth === 0) {
      entries.push(value.slice(start, index))
      start = index + 1
    }
  }

  entries.push(value.slice(start))
  return entries.map(normalizeSelector).filter(Boolean)
}

function parseDeclarations(body) {
  const declarations = new Map()
  let start = 0
  let depth = 0
  let quote = null

  function addDeclaration(entry) {
    const separator = entry.indexOf(':')
    if (separator === -1) return
    const property = entry.slice(0, separator).trim().toLowerCase()
    const value = normalizeCssValue(entry.slice(separator + 1))
    if (property) declarations.set(property, value)
  }

  for (let index = 0; index < body.length; index += 1) {
    const character = body[index]
    if (quote) {
      if (character === '\\') index += 1
      else if (character === quote) quote = null
      continue
    }

    if (character === '"' || character === "'") quote = character
    else if (character === '(') depth += 1
    else if (character === ')') depth -= 1
    else if (character === ';' && depth === 0) {
      addDeclaration(body.slice(start, index))
      start = index + 1
    }
  }

  addDeclaration(body.slice(start))
  return declarations
}

function parseCssRules(css, rules = [], inMedia = false) {
  const source = stripCssComments(css)
  let cursor = 0

  while (cursor < source.length) {
    const openingBrace = findCssCharacter(source, '{', cursor)
    if (openingBrace === -1) break
    const selectorText = source.slice(cursor, openingBrace).trim()
    const closingBrace = findCssBlockEnd(source, openingBrace)
    const body = closingBrace === -1 ? null : source.slice(openingBrace + 1, closingBrace)
    if (body === null) break

    if (selectorText.startsWith('@media')) {
      parseCssRules(body, rules, true)
    } else if (selectorText && !selectorText.startsWith('@')) {
      rules.push({
        order: rules.length,
        inMedia,
        selectorText,
        selectors: new Set(splitCssList(selectorText)),
        declarations: parseDeclarations(body),
      })
    }

    cursor = closingBrace + 1
  }

  return rules
}

function selectorSetMatches(selectors, expectedSelectors) {
  return selectors.size === expectedSelectors.length
    && expectedSelectors.every((selector) => selectors.has(normalizeSelector(selector)))
}

function declarationMapMatches(declarations, expectedDeclarations) {
  return expectedDeclarations.every(({ property, value }) => {
    const actualValue = declarations.get(property)
    return actualValue !== undefined && new RegExp(`^${value}$`).test(actualValue)
  })
}

function matchingRules(rules, contract) {
  return contract.selectors
    ? rules.filter((rule) => selectorSetMatches(rule.selectors, contract.selectors))
    : rules.filter((rule) => rule.selectors.has(normalizeSelector(contract.selector)))
}

function effectiveDeclarations(rules) {
  const effective = new Map()
  for (const rule of rules) {
    for (const [property, value] of rule.declarations) effective.set(property, value)
  }
  return effective
}

function expectRuleContract(failures, rules, contract) {
  const candidates = matchingRules(rules, contract)
  const hasBaseline = candidates.length > 0
  const declarationsMatch = contract.selectors
    ? contract.selectors.every((selector) => declarationMapMatches(
      effectiveDeclarations(rules.filter((rule) => rule.selectors.has(normalizeSelector(selector)))),
      contract.declarations,
    ))
    : declarationMapMatches(effectiveDeclarations(candidates), contract.declarations)

  if (!hasBaseline || !declarationsMatch) {
    failures.push(`${CSS_SOURCE} is missing ${contract.label}`)
  }
}

function ruleContractFailures(rules, contracts) {
  const failures = []
  for (const contract of contracts) expectRuleContract(failures, rules, contract)
  return failures
}

function mediaRules(css, mediaPattern) {
  const rules = []
  for (const block of extractCssBlocks(css, mediaPattern)) parseCssRules(block, rules)
  return rules
}

function expectNoGlobalFocusHiding(failures, css) {
  const globalFocusHiding = /(?:^|})\s*(?:\*|html|body|\*:focus(?:-visible)?|:focus(?:-visible)?)\s*\{[^}]*\boutline\s*:\s*(?:none|0)\b/i
  if (globalFocusHiding.test(css)) {
    failures.push(`${CSS_SOURCE} must not hide focus with a global outline: none rule`)
  }
}

const CSS_PRIMITIVE_RULES = [
  { label: '.pms-page-shell primitive', selector: '.pms-page-shell', declarations: [
    { property: 'min-height', value: '100dvh' },
    { property: 'background', value: 'var\\(--pms-page\\)' },
    { property: 'color', value: 'var\\(--pms-text-primary\\)' },
  ] },
  { label: '.pms-topbar primitive', selector: '.pms-topbar', declarations: [
    { property: 'background', value: 'var\\(--pms-gradient-brand\\)' },
    { property: 'border-bottom', value: '1px\\s+solid\\s+rgb\\(255\\s+255\\s+255\\s*\\/\\s*24%\\)' },
    { property: 'box-shadow', value: '0\\s+10px\\s+28px\\s+rgb\\(92\\s+73\\s+214\\s*\\/\\s*24%\\)' },
  ] },
  { label: '.pms-glass-surface primitive', selector: '.pms-glass-surface', declarations: [
    { property: 'background', value: 'var\\(--pms-surface-glass\\)' },
    { property: 'border', value: '1px\\s+solid\\s+rgb\\(255\\s+255\\s+255\\s*\\/\\s*96%\\)' },
    { property: 'backdrop-filter', value: 'var\\(--pms-glass-filter\\)' },
    { property: '-webkit-backdrop-filter', value: 'var\\(--pms-glass-filter\\)' },
    { property: 'box-shadow', value: 'inset\\s+0\\s+1px\\s+0\\s+#fff,\\s*var\\(--pms-shadow-glass\\)' },
  ] },
  { label: '.pms-solid-surface primitive', selector: '.pms-solid-surface', declarations: [
    { property: 'background', value: 'var\\(--pms-surface-solid\\)' },
    { property: 'border', value: '1px\\s+solid\\s+var\\(--pms-border\\)' },
    { property: 'box-shadow', value: '0\\s+10px\\s+30px\\s+rgb\\(58\\s+45\\s+115\\s*\\/\\s*6%\\)' },
  ] },
  { label: '.pms-toolbar primitive', selector: '.pms-toolbar', declarations: [
    { property: 'background', value: 'var\\(--pms-surface-glass\\)' },
    { property: 'border', value: '1px\\s+solid\\s+rgb\\(255\\s+255\\s+255\\s*\\/\\s*96%\\)' },
    { property: 'backdrop-filter', value: 'var\\(--pms-glass-filter\\)' },
    { property: '-webkit-backdrop-filter', value: 'var\\(--pms-glass-filter\\)' },
    { property: 'box-shadow', value: 'inset\\s+0\\s+1px\\s+0\\s+#fff,\\s*var\\(--pms-shadow-glass\\)' },
  ] },
  { label: 'calendar header cascade-resilient glass material', selector: '.pms-project-list-calendar .pms-project-calendar-header.pms-toolbar', declarations: [
    { property: 'background', value: 'var\\(--pms-surface-glass\\)' },
    { property: 'border', value: '1px\\s+solid\\s+rgb\\(255\\s+255\\s+255\\s*\\/\\s*96%\\)' },
    { property: 'backdrop-filter', value: 'var\\(--pms-glass-filter\\)' },
    { property: '-webkit-backdrop-filter', value: 'var\\(--pms-glass-filter\\)' },
    { property: 'box-shadow', value: 'inset\\s+0\\s+1px\\s+0\\s+#fff,\\s*var\\(--pms-shadow-glass\\)' },
  ] },
  { label: 'calendar cell opaque material', selector: '.pms-project-list-calendar .pms-project-calendar-cell', declarations: [
    { property: 'background', value: 'var\\(--pms-surface-solid\\)' },
  ] },
  { label: '.pms-interactive-surface primitive', selector: '.pms-interactive-surface', declarations: [
    { property: 'transition', value: 'transform\\s+160ms\\s+cubic-bezier\\(\\.16,\\s*1,\\s*\\.3,\\s*1\\),\\s*box-shadow\\s+180ms\\s+cubic-bezier\\(\\.16,\\s*1,\\s*\\.3,\\s*1\\),\\s*border-color\\s+160ms\\s+ease' },
  ] },
  { label: '.pms-interactive-surface hover state', selector: '.pms-interactive-surface:hover', declarations: [
    { property: 'transform', value: 'translateY\\(-1px\\)' },
  ] },
  { label: '.pms-interactive-surface active state', selector: '.pms-interactive-surface:active', declarations: [
    { property: 'transform', value: 'scale\\(\\.98\\)' },
  ] },
]

const REDUCED_MOTION_MEDIA = /@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/
const REDUCED_TRANSPARENCY_MEDIA = /@media\s*\(\s*prefers-reduced-transparency\s*:\s*reduce\s*\)/
const COMPACT_MEDIA = /@media\s*\(\s*max-width\s*:\s*1024px\s*\)/

const REDUCED_MOTION_RULE = {
  label: 'reduced-motion global accessibility rule',
  selectors: ['*', '*::before', '*::after'],
  declarations: [
    { property: 'animation-duration', value: '\\.01ms\\s*!important' },
    { property: 'animation-iteration-count', value: '1\\s*!important' },
    { property: 'scroll-behavior', value: 'auto\\s*!important' },
    { property: 'transition-duration', value: '\\.01ms\\s*!important' },
  ],
}

const REDUCED_TRANSPARENCY_RULE = {
  label: 'reduced-transparency surface rule',
  selectors: ['.pms-glass-surface', '.pms-toolbar', '.ant-modal-content', '.ant-popover-inner', '.ant-dropdown-menu'],
  declarations: [
    { property: 'background', value: 'rgb\\(255\\s+255\\s+255\\s*\\/\\s*98%\\)\\s*!important' },
    { property: 'backdrop-filter', value: 'none\\s*!important' },
    { property: '-webkit-backdrop-filter', value: 'none\\s*!important' },
  ],
}

const FOCUS_TARGETS = ['a', 'button', 'input', 'select', 'textarea', 'summary', "[role='button']", "[tabindex]:not([tabindex^='-'])"]
const FOCUS_VISIBLE_RULE = {
  label: 'visible keyboard focus rule',
  declarations: [
    { property: 'outline', value: '2px\\s+solid\\s+var\\(--pms-brand-strong\\)' },
    { property: 'box-shadow', value: '0\\s+0\\s+0\\s+3px\\s+rgb\\(117\\s+98\\s+255\\s*\\/\\s*24%\\)' },
  ],
}

const ONE_LINE_LABEL_RULE = {
  label: 'one-line button and navigation label rule',
  selectors: ['.pms-topbar .ant-btn', '.pms-topbar .ant-menu-item', '.pms-toolbar .ant-btn', '.pms-toolbar .ant-menu-item'],
  declarations: [{ property: 'white-space', value: 'nowrap' }],
}

const COMPACT_TOOLBAR_RULE = {
  label: '1024px compact toolbar spacing rule',
  selector: '.pms-toolbar',
  declarations: [
    { property: 'gap', value: '8px' },
    { property: 'padding', value: '8px\\s+12px' },
  ],
}

function primitiveRuleFailures(css) {
  return ruleContractFailures(parseCssRules(css).filter((rule) => !rule.inMedia), CSS_PRIMITIVE_RULES)
}

function focusTargetsForRule(rule) {
  const whereMatch = /^:where\(([\s\S]+)\):focus-visible$/.exec(rule.selectorText)
  if (whereMatch) {
    const targets = new Set(splitCssList(whereMatch[1]))
    return targets.has('*') ? new Set(FOCUS_TARGETS) : targets
  }

  const targets = new Set()
  for (const selector of rule.selectors) {
    if (selector === ':focus-visible' || selector === '*:focus-visible') {
      for (const target of FOCUS_TARGETS) targets.add(target)
    }
    for (const target of FOCUS_TARGETS) {
      if (selector === `${target}:focus-visible`) targets.add(target)
    }
  }
  return targets
}

function focusRuleFailures(rules) {
  const failures = []
  const sharedCandidates = rules.filter((rule) => {
    const match = /^:where\(([\s\S]+)\):focus-visible$/.exec(rule.selectorText)
    return match && selectorSetMatches(new Set(splitCssList(match[1])), FOCUS_TARGETS)
  })

  if (sharedCandidates.length === 0) {
    failures.push(`${CSS_SOURCE} is missing ${FOCUS_VISIBLE_RULE.label}`)
    return failures
  }

  for (const target of FOCUS_TARGETS) {
    const effective = effectiveDeclarations(rules.filter((rule) => focusTargetsForRule(rule).has(target)))
    if (!declarationMapMatches(effective, FOCUS_VISIBLE_RULE.declarations)) {
      failures.push(`${CSS_SOURCE} is missing ${FOCUS_VISIBLE_RULE.label} for ${target}`)
    }
  }

  return failures
}

function compactSpacingFailures(css) {
  const failures = []
  const compactRules = mediaRules(css, COMPACT_MEDIA)
  const pageShellRules = compactRules.filter((rule) => rule.selectors.has('.pms-page-shell'))
  if (pageShellRules.length > 0) {
    failures.push(`${CSS_SOURCE} 1024px rules must not change .pms-page-shell geometry`)
  }

  const contracts = [COMPACT_TOOLBAR_RULE]
  const protectedRules = compactRules.filter((rule) => contracts.some(
    (contract) => rule.selectors.has(contract.selector),
  ))

  if (protectedRules.length === 0) {
    failures.push(`${CSS_SOURCE} is missing 1024px compact spacing rules`)
    return failures
  }

  const allowedProperties = new Set(['gap', 'padding'])
  for (const rule of protectedRules) {
    const unsupportedProperty = [...rule.declarations.keys()].find((property) => !allowedProperties.has(property))
    if (unsupportedProperty) {
      failures.push(`${CSS_SOURCE} 1024px compact spacing block allows only spacing properties; found ${unsupportedProperty}`)
    }
  }

  for (const contract of contracts) {
    const effective = effectiveDeclarations(compactRules.filter(
      (rule) => rule.selectors.has(contract.selector),
    ))
    if (!declarationMapMatches(effective, contract.declarations)) {
      failures.push(`${CSS_SOURCE} is missing ${contract.label}`)
    }
  }

  return failures
}

function accessibilityAndCompactFailures(css) {
  const failures = []
  const rules = parseCssRules(css).filter((rule) => !rule.inMedia)

  failures.push(...ruleContractFailures(mediaRules(css, REDUCED_MOTION_MEDIA), [REDUCED_MOTION_RULE]))
  failures.push(...ruleContractFailures(mediaRules(css, REDUCED_TRANSPARENCY_MEDIA), [REDUCED_TRANSPARENCY_RULE]))
  failures.push(...focusRuleFailures(rules))
  failures.push(...ruleContractFailures(rules, [ONE_LINE_LABEL_RULE]))
  expectNoGlobalFocusHiding(failures, css)
  failures.push(...compactSpacingFailures(css))

  return failures
}

function focusRuleFor(targets) {
  return `:where(${targets.join(', ')}):focus-visible {
  outline: 2px solid var(--pms-brand-strong);
  box-shadow: 0 0 0 3px rgb(117 98 255 / 24%);
}`
}

function primitiveContractSelfTestFailures() {
  const focusRule = focusRuleFor(FOCUS_TARGETS)
  const oneLineRule = `.pms-topbar .ant-btn,
.pms-topbar .ant-menu-item,
.pms-toolbar .ant-btn,
.pms-toolbar .ant-menu-item {
  white-space: nowrap;
}`
  const compactRule = `@media (max-width: 1024px) {
  .pms-toolbar { gap: 8px; padding: 8px 12px; }
}`
  const reducedMotionRule = `@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: .01ms !important;
  }
}`
  const reducedTransparencyRule = `@media (prefers-reduced-transparency: reduce) {
  .pms-glass-surface,
  .pms-toolbar,
  .ant-modal-content,
  .ant-popover-inner,
  .ant-dropdown-menu {
    background: rgb(255 255 255 / 98%) !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
  }
}`
  const primitiveRules = `.pms-page-shell { min-height: 100dvh; background: var(--pms-page); color: var(--pms-text-primary); }
.pms-topbar { background: var(--pms-gradient-brand); border-bottom: 1px solid rgb(255 255 255 / 24%); box-shadow: 0 10px 28px rgb(92 73 214 / 24%); }
.pms-glass-surface, .pms-toolbar { background: var(--pms-surface-glass); border: 1px solid rgb(255 255 255 / 96%); backdrop-filter: var(--pms-glass-filter); -webkit-backdrop-filter: var(--pms-glass-filter); box-shadow: inset 0 1px 0 #fff, var(--pms-shadow-glass); }
.pms-project-list-calendar .pms-project-calendar-header.pms-toolbar { background: var(--pms-surface-glass); border: 1px solid rgb(255 255 255 / 96%); backdrop-filter: var(--pms-glass-filter); -webkit-backdrop-filter: var(--pms-glass-filter); box-shadow: inset 0 1px 0 #fff, var(--pms-shadow-glass); }
.pms-project-list-calendar .pms-project-calendar-cell { background: var(--pms-surface-solid); }
.pms-solid-surface { background: var(--pms-surface-solid); border: 1px solid var(--pms-border); box-shadow: 0 10px 30px rgb(58 45 115 / 6%); }
.pms-interactive-surface { transition: transform 160ms cubic-bezier(.16, 1, .3, 1), box-shadow 180ms cubic-bezier(.16, 1, .3, 1), border-color 160ms ease; }
.pms-interactive-surface:hover { transform: translateY(-1px); }
.pms-interactive-surface:active { transform: scale(.98); }`
  const validCss = [primitiveRules, focusRule, oneLineRule, compactRule, reducedMotionRule, reducedTransparencyRule].join('\n')
  const cases = [
    {
      label: 'empty reduced-motion media query',
      css: validCss.replace(reducedMotionRule, '@media (prefers-reduced-motion: reduce) {}'),
      expectedFailure: REDUCED_MOTION_RULE.label,
    },
    {
      label: 'empty reduced-transparency media query',
      css: validCss.replace(reducedTransparencyRule, '@media (prefers-reduced-transparency: reduce) {}'),
      expectedFailure: REDUCED_TRANSPARENCY_RULE.label,
    },
    {
      label: 'removed standard backdrop-filter declaration',
      css: validCss.replace(' backdrop-filter: var(--pms-glass-filter);', ''),
      expectedFailure: '.pms-glass-surface primitive',
    },
    {
      label: 'comment-only standard backdrop-filter declaration',
      css: validCss.replace(' backdrop-filter: var(--pms-glass-filter);', ' /* backdrop-filter: var(--pms-glass-filter); */'),
      expectedFailure: '.pms-glass-surface primitive',
    },
    {
      label: 'removed WebKit backdrop-filter declaration',
      css: validCss.replace(' -webkit-backdrop-filter: var(--pms-glass-filter);', ''),
      expectedFailure: '.pms-glass-surface primitive',
    },
    {
      label: 'removed topbar brand gradient declaration',
      css: validCss.replace(' background: var(--pms-gradient-brand);', ''),
      expectedFailure: '.pms-topbar primitive',
    },
    {
      label: 'later interactive transition override',
      css: `${validCss}\n.pms-interactive-surface { transition: all 2s linear; }`,
      expectedFailure: '.pms-interactive-surface primitive',
    },
    {
      label: 'later glass backdrop override',
      css: `${validCss}\n.pms-glass-surface { backdrop-filter: none; }`,
      expectedFailure: '.pms-glass-surface primitive',
    },
    {
      label: 'later focus ring override',
      css: `${validCss}\nbutton:focus-visible { outline: none; box-shadow: none; }`,
      expectedFailure: 'visible keyboard focus rule for button',
    },
    {
      label: 'later global focus ring override',
      css: `${validCss}\n:focus-visible { outline: 1px solid transparent; box-shadow: none; }`,
      expectedFailure: 'visible keyboard focus rule for button',
    },
  ]
  const focusCases = FOCUS_TARGETS.map((target) => ({
    label: `removed focus target ${target}`,
    css: validCss.replace(focusRule, focusRuleFor(FOCUS_TARGETS.filter((candidate) => candidate !== target))),
    expectedFailure: FOCUS_VISIBLE_RULE.label,
  }))
  const compactCases = [
    {
      label: 'removed compact spacing rule',
      css: validCss.replace(compactRule, '@media (max-width: 1024px) {}'),
      expectedFailure: '1024px compact spacing rules',
    },
    {
      label: 'compact page-shell padding mutation',
      css: validCss.replace('.pms-toolbar { gap: 8px;', '.pms-page-shell { padding-inline: 12px; }\n  .pms-toolbar { gap: 8px;'),
      expectedFailure: 'must not change .pms-page-shell geometry',
    },
    {
      label: 'compact width mutation',
      css: validCss.replace('gap: 8px;', 'gap: 8px; width: 100%;'),
      expectedFailure: '1024px compact spacing block allows only spacing properties',
    },
    {
      label: 'compact transform mutation',
      css: validCss.replace('padding: 8px 12px;', 'padding: 8px 12px; transform: translateY(1px);'),
      expectedFailure: '1024px compact spacing block allows only spacing properties',
    },
    {
      label: 'later compact position override',
      css: `${validCss}\n@media (max-width: 1024px) { .pms-page-shell { position: fixed; } }`,
      expectedFailure: 'must not change .pms-page-shell geometry',
    },
  ]
  const failures = []

  const commentedValidCss = validCss.replace('.pms-topbar {', '/* normal formatting comment */\n.pms-topbar {')
  const commentedValidFailures = [
    ...primitiveRuleFailures(stripCssComments(commentedValidCss)),
    ...accessibilityAndCompactFailures(stripCssComments(commentedValidCss)),
  ]
  if (commentedValidFailures.length > 0) {
    failures.push(`${CSS_SOURCE} verifier self-test does not tolerate normal CSS comments`)
  }

  const quotedBraceCss = `.fixture { content: "}"; }\n${validCss}`
  const quotedBraceFailures = [
    ...primitiveRuleFailures(stripCssComments(quotedBraceCss)),
    ...accessibilityAndCompactFailures(stripCssComments(quotedBraceCss)),
  ]
  if (quotedBraceFailures.length > 0) {
    failures.push(`${CSS_SOURCE} verifier self-test does not tolerate quoted braces`)
  }

  const reorderedTransparencyRule = `@media (prefers-reduced-transparency: reduce) {
  .ant-dropdown-menu,
  .ant-popover-inner,
  .ant-modal-content,
  .pms-toolbar,
  .pms-glass-surface {
    background: rgb(255 255 255 / 98%) !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
  }
}`
  const reorderedCss = validCss
    .replace(focusRule, focusRuleFor([...FOCUS_TARGETS].reverse()))
    .replace(reducedTransparencyRule, reorderedTransparencyRule)
  const reorderedFailures = [
    ...primitiveRuleFailures(stripCssComments(reorderedCss)),
    ...accessibilityAndCompactFailures(stripCssComments(reorderedCss)),
  ]
  if (reorderedFailures.length > 0) {
    failures.push(`${CSS_SOURCE} verifier self-test does not tolerate selector-list reordering`)
  }

  for (const testCase of [...cases, ...focusCases, ...compactCases]) {
    const testCss = stripCssComments(testCase.css)
    const mutationFailures = [
      ...primitiveRuleFailures(testCss),
      ...accessibilityAndCompactFailures(testCss),
    ]
    if (!mutationFailures.some((failure) => failure.includes(testCase.expectedFailure))) {
      failures.push(`${CSS_SOURCE} verifier self-test did not reject ${testCase.label}`)
    }
  }

  return failures
}

function cssContractFailures(root) {
  const failures = []
  const extracted = extractRootBlock(read(CSS_SOURCE, root))

  if (extracted.error) {
    failures.push(`${CSS_SOURCE} ${extracted.error}`)
    return failures
  }

  expectContentPatterns(failures, CSS_SOURCE, stripCssComments(extracted.rootBlock), CSS_ROOT_EXPECTATIONS)

  const outsideRoot = stripCssComments(extracted.outsideRoot)

  failures.push(...primitiveRuleFailures(outsideRoot))
  failures.push(...accessibilityAndCompactFailures(outsideRoot))
  failures.push(...primitiveContractSelfTestFailures())
  failures.push(...legacyBrandScannerSelfTestFailures())

  const outsideLiterals = [...extracted.outsideRoot.matchAll(BRAND_HEX_PATTERN)]
    .map((match) => match[0].toLowerCase())
  if (outsideLiterals.length > 0) {
    failures.push(
      `${CSS_SOURCE}: raw PMS brand literal(s) outside :root: ${[...new Set(outsideLiterals)].join(', ')}`,
    )
  }

  return failures
}

function verifyContract(root) {
  const failures = [
    ...rawBrandFailures(root),
    ...groupedLegacyBrandFailures(root),
    ...cssContractFailures(root),
  ]

  expectPatterns(failures, root, 'src/theme/pmsTheme.ts', [
    { label: 'PMS_COLORS export', pattern: /^export const PMS_COLORS\s*=\s*{/m },
    { label: "brandStrong: '#5D49F6'", pattern: /^\s*brandStrong:\s*'#5D49F6',$/m },
    { label: "brandMain: '#7562FF'", pattern: /^\s*brandMain:\s*'#7562FF',$/m },
    { label: "brandSoft: '#AD98EE'", pattern: /^\s*brandSoft:\s*'#AD98EE',$/m },
    { label: "brandSurface: '#F5F3FF'", pattern: /^\s*brandSurface:\s*'#F5F3FF',$/m },
    { label: "brandBorder: '#DCD6FF'", pattern: /^\s*brandBorder:\s*'#DCD6FF',$/m },
    { label: "page: '#F4F6FB'", pattern: /^\s*page:\s*'#F4F6FB',$/m },
    { label: "textPrimary: '#27243A'", pattern: /^\s*textPrimary:\s*'#27243A',$/m },
    { label: "textSecondary: '#625D70'", pattern: /^\s*textSecondary:\s*'#625D70',$/m },
    { label: "textTertiary: '#817B90'", pattern: /^\s*textTertiary:\s*'#817B90',$/m },
    { label: "border: '#E6E3EF'", pattern: /^\s*border:\s*'#E6E3EF',$/m },
    { label: 'pmsTheme export', pattern: /^export const pmsTheme:\s*ThemeConfig\s*=\s*{/m },
    { label: 'colorPrimary brand mapping', pattern: /^\s*colorPrimary:\s*PMS_COLORS\.brandMain,$/m },
    { label: 'colorInfo brand mapping', pattern: /^\s*colorInfo:\s*PMS_COLORS\.brandMain,$/m },
    { label: "colorBgBase: '#FFFFFF'", pattern: /^\s*colorBgBase:\s*'#FFFFFF',$/m },
    { label: 'colorBgLayout page mapping', pattern: /^\s*colorBgLayout:\s*PMS_COLORS\.page,$/m },
    { label: 'colorText primary mapping', pattern: /^\s*colorText:\s*PMS_COLORS\.textPrimary,$/m },
    { label: 'colorTextSecondary mapping', pattern: /^\s*colorTextSecondary:\s*PMS_COLORS\.textSecondary,$/m },
    { label: 'colorTextTertiary mapping', pattern: /^\s*colorTextTertiary:\s*PMS_COLORS\.textTertiary,$/m },
    { label: 'colorBorder mapping', pattern: /^\s*colorBorder:\s*PMS_COLORS\.border,$/m },
    { label: "colorBorderSecondary: '#EFEDF4'", pattern: /^\s*colorBorderSecondary:\s*'#EFEDF4',$/m },
    { label: 'borderRadius: 8', pattern: /^\s*borderRadius:\s*8,$/m },
    { label: 'borderRadiusLG: 12', pattern: /^\s*borderRadiusLG:\s*12,$/m },
    { label: 'controlHeight: 32', pattern: /^\s*controlHeight:\s*32,$/m },
    { label: 'approved Chinese font stack', pattern: /^\s*fontFamily:\s*'-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',$/m },
    { label: 'Button component mapping', pattern: /Button:\s*{\s*borderRadius:\s*8,\s*primaryShadow:\s*'0 5px 14px rgba\(96, 76, 226, \.22\)',\s*}/ },
    { label: 'Card component mapping', pattern: /Card:\s*{\s*borderRadiusLG:\s*12,\s*}/ },
    { label: 'Modal component mapping', pattern: /Modal:\s*{\s*borderRadiusLG:\s*16,\s*}/ },
    { label: 'Table component mapping', pattern: /Table:\s*{\s*headerBg:\s*PMS_COLORS\.brandSurface,\s*headerColor:\s*'#514A70',\s*rowHoverBg:\s*'#FAF9FF',\s*}/ },
    { label: 'Tabs component mapping', pattern: /Tabs:\s*{\s*inkBarColor:\s*PMS_COLORS\.brandMain,\s*itemSelectedColor:\s*PMS_COLORS\.brandStrong,\s*}/ },
  ])

  expectPatterns(failures, root, 'src/components/shared/PmsThemeProvider.tsx', [
    { label: "'use client'", pattern: /^'use client'$/m },
    { label: 'ConfigProvider import', pattern: /^import\s*{\s*ConfigProvider\s*}\s*from\s*'antd'$/m },
    { label: 'pmsTheme import', pattern: /^import\s*{\s*pmsTheme\s*}\s*from\s*'@\/theme\/pmsTheme'$/m },
    { label: 'ConfigProvider theme binding', pattern: /<ConfigProvider\s+theme=\{pmsTheme\}\s+button=\{\{\s*autoInsertSpace:\s*false\s*}}/ },
  ])

  expectPatterns(failures, root, 'src/app/layout.tsx', [
    { label: 'PmsThemeProvider import', pattern: /^import\s+PmsThemeProvider\s+from\s+'@\/components\/shared\/PmsThemeProvider'$/m },
    { label: 'Chinese document language', pattern: /<html\s+lang="zh-CN">/ },
    { label: 'root PmsThemeProvider wrapper', pattern: /<PmsThemeProvider>\{children\}<\/PmsThemeProvider>/ },
  ])

  expectNoMatches(failures, root, 'src/app/page.tsx', [
    { label: 'an Ant Design ConfigProvider import', pattern: /^\s*import[\s\S]{0,200}\bConfigProvider\b[\s\S]{0,200}\sfrom\s*['"]antd['"]/m },
    { label: 'a nested ConfigProvider render', pattern: /<ConfigProvider(?:\s|>)/ },
  ])

  return failures
}

function finish(failures, successMessage) {
  if (failures.length > 0) {
    console.error(failures.join('\n'))
    process.exit(1)
  }

  console.log(successMessage)
}

function argumentValue(flag) {
  const index = process.argv.indexOf(flag)
  return index === -1 ? null : process.argv[index + 1]
}

const cssRoot = argumentValue('--css-root')
const scanRoot = argumentValue('--scan-root')

if (cssRoot !== null) {
  if (!cssRoot) {
    console.error('--css-root requires a directory')
    process.exit(1)
  }

  finish(cssContractFailures(path.resolve(cssRoot)), 'Liquid glass CSS contract passed')
} else if (scanRoot !== null) {
  if (!scanRoot) {
    console.error('--scan-root requires a directory')
    process.exit(1)
  }

  finish(rawBrandFailures(path.resolve(scanRoot)), 'Liquid glass raw-brand scanner passed')
} else {
  finish(verifyContract(process.cwd()), 'Liquid glass core theme contract passed')
}
