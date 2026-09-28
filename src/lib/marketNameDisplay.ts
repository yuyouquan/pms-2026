const KNOWN_BRANDS = ['TECNO', 'Infinix', 'itel'] as const

/** Remove a leading brand label only for display; callers retain the original value. */
export function formatMarketName(value: unknown, brand?: unknown): string {
  const marketName = typeof value === 'string' ? value.trim() : String(value ?? '').trim()
  if (!marketName) return ''
  const candidates = [brand, ...KNOWN_BRANDS]
    .filter((candidate): candidate is string => typeof candidate === 'string' && !!candidate.trim())
    .map(candidate => candidate.trim())
    .sort((left, right) => right.length - left.length)
  for (const candidate of candidates) {
    if (marketName.slice(0, candidate.length).toLocaleLowerCase('en-US') !== candidate.toLocaleLowerCase('en-US')) continue
    const suffix = marketName.slice(candidate.length)
    if (!/^[\s:：\-–—_/]+\S/.test(suffix)) continue
    return suffix.replace(/^[\s:：\-–—_/]+/, '')
  }
  return marketName
}
