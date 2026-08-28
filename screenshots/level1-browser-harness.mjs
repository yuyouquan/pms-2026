import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import vm from 'node:vm'

const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

const fetchTextWithinDeadline = async ({
  url,
  label,
  deadline,
  requestTimeoutMs,
  fetchImpl,
}) => {
  const remainingMs = deadline - Date.now()
  if (remainingMs <= 0) throw new Error(`${label} request timed out: overall preflight deadline expired before request`)
  const timeoutMs = Math.max(1, Math.min(requestTimeoutMs, remainingMs))
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetchImpl(url, { signal: controller.signal })
    const text = await response.text()
    return { response, text }
  } catch (error) {
    if (controller.signal.aborted || error?.name === 'AbortError') {
      throw new Error(`${label} request timed out after ${timeoutMs}ms`, { cause: error })
    }
    throw new Error(`${label} request failed: ${error?.message || error}`, { cause: error })
  } finally {
    clearTimeout(timer)
  }
}

export const waitForApplicationBundles = async ({
  baseUrl,
  timeoutMs = 60_000,
  requestTimeoutMs = 30_000,
  retryDelayMs = 500,
  fetchImpl = fetch,
}) => {
  const deadline = Date.now() + timeoutMs
  let lastError = null
  while (Date.now() < deadline) {
    try {
      const root = await fetchTextWithinDeadline({
        url: baseUrl,
        label: 'root page',
        deadline,
        requestTimeoutMs,
        fetchImpl,
      })
      if (!root.response.ok) throw new Error(`root preflight returned HTTP ${root.response.status}`)
      const html = root.text
      const scriptUrls = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)]
        .map(match => new URL(match[1].replaceAll('&amp;', '&'), baseUrl).href)
      if (!scriptUrls.length) throw new Error('root preflight found no client scripts')
      for (const scriptUrl of scriptUrls) {
        const bundle = await fetchTextWithinDeadline({
          url: scriptUrl,
          label: `client bundle ${scriptUrl}`,
          deadline,
          requestTimeoutMs,
          fetchImpl,
        })
        if (!bundle.response.ok) throw new Error(`${scriptUrl} returned HTTP ${bundle.response.status}`)
        const source = bundle.text
        if (!source.trim()) throw new Error(`${scriptUrl} returned an empty client script`)
        new vm.Script(source, { filename: scriptUrl })
      }
      return { scriptCount: scriptUrls.length }
    } catch (error) {
      lastError = error
      const remainingMs = deadline - Date.now()
      if (remainingMs > 0) await wait(Math.min(retryDelayMs, remainingMs))
    }
  }
  throw new Error(`client bundles did not become ready within ${timeoutMs}ms: ${lastError?.message || lastError}`, { cause: lastError })
}

export const createEvidenceSession = ({
  trackedOutput,
  updateScreenshots = false,
  keepArtifacts = false,
  tempRoot = os.tmpdir(),
}) => {
  const outputPath = updateScreenshots
    ? trackedOutput
    : fs.mkdtempSync(path.join(tempRoot, 'pms-level1-playwright-'))
  fs.mkdirSync(outputPath, { recursive: true })
  let cleaned = false
  return {
    outputPath,
    cleanup({ success }) {
      if (cleaned) return { kept: fs.existsSync(outputPath), path: outputPath }
      cleaned = true
      const kept = updateScreenshots || keepArtifacts || !success
      if (!kept) fs.rmSync(outputPath, { recursive: true, force: true })
      return { kept, path: outputPath }
    },
  }
}
