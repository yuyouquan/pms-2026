/** Source workflow simulation: a failed check remains editable and blocks role submission. */
export function getTransferAiCheckResult(sample: number = Math.random()) {
  const passed = sample > 0.1
  return {
    aiCheckStatus: passed ? 'passed' as const : 'failed' as const,
    aiCheckResult: passed ? 'AI检查通过，内容符合要求。' : 'AI检查不通过，请检查内容是否完整或链接是否有效。',
  }
}
