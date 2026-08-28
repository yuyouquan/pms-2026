#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import {
  createEvidenceSession,
  waitForApplicationBundles,
} from '../screenshots/level1-browser-harness.mjs'

const assertBoundedHang = async ({ onSocket, description }) => {
  const sockets = new Set()
  const hangingServer = net.createServer(socket => {
    sockets.add(socket)
    socket.on('close', () => sockets.delete(socket))
    onSocket(socket)
  })
  await new Promise((resolve, reject) => {
    hangingServer.once('error', reject)
    hangingServer.listen(0, '127.0.0.1', resolve)
  })
  const address = hangingServer.address()
  assert.ok(address && typeof address === 'object', `${description} server exposes a local port`)
  const startedAt = Date.now()
  try {
    await assert.rejects(
      waitForApplicationBundles({
        baseUrl: `http://127.0.0.1:${address.port}`,
        timeoutMs: 1_000,
        requestTimeoutMs: 250,
        retryDelayMs: 25,
      }),
      error => /client bundles did not become ready within 1000ms/.test(error.message)
        && /request timed out/.test(error.message)
        && /root page/.test(error.message),
      `${description} fails with a clear bounded root-request timeout`,
    )
    const elapsed = Date.now() - startedAt
    assert.ok(elapsed >= 900 && elapsed < 1_800, `${description} exits near its 1000ms deadline, actual=${elapsed}ms`)
  } finally {
    for (const socket of sockets) socket.destroy()
    await new Promise(resolve => hangingServer.close(resolve))
  }
}

await assertBoundedHang({
  description: 'accepted-but-unresponsive socket',
  onSocket: () => {},
})
await assertBoundedHang({
  description: 'headers-only response with a hanging body',
  onSocket: socket => socket.write('HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: 100\r\nConnection: keep-alive\r\n\r\npartial'),
})

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pms-level1-harness-contract-'))
try {
  const success = createEvidenceSession({
    trackedOutput: path.join(tempRoot, 'tracked'),
    tempRoot,
  })
  fs.writeFileSync(path.join(success.outputPath, 'success.png'), 'evidence')
  const successResult = success.cleanup({ success: true })
  assert.equal(successResult.kept, false, 'successful temporary evidence is marked removed')
  assert.equal(fs.existsSync(success.outputPath), false, 'successful temporary evidence directory is deleted')

  const failure = createEvidenceSession({
    trackedOutput: path.join(tempRoot, 'tracked'),
    tempRoot,
  })
  fs.writeFileSync(path.join(failure.outputPath, 'failure.png'), 'evidence')
  const failureResult = failure.cleanup({ success: false })
  assert.equal(failureResult.kept, true, 'failed temporary evidence is retained')
  assert.equal(failureResult.path, failure.outputPath, 'failed evidence reports its exact retained path')
  assert.equal(fs.existsSync(failure.outputPath), true, 'failed evidence remains available for diagnosis')

  const explicitKeep = createEvidenceSession({
    trackedOutput: path.join(tempRoot, 'tracked'),
    tempRoot,
    keepArtifacts: true,
  })
  fs.writeFileSync(path.join(explicitKeep.outputPath, 'kept.png'), 'evidence')
  const keepResult = explicitKeep.cleanup({ success: true })
  assert.equal(keepResult.kept, true, 'explicit keep retains successful evidence')
  assert.equal(fs.existsSync(explicitKeep.outputPath), true, 'explicitly retained evidence remains on disk')
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true })
}

console.log('PASS bounded level1 browser preflight and evidence cleanup contracts')
