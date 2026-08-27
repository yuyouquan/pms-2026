'use client'

import { useEffect, useMemo } from 'react'
import { buildTosEnumOptions, getCurrentTosEnumValues } from '@/lib/tosEnumOptions'
import { ensureEnumHydrated, useEnumStore } from '@/stores/enums'
import type { LegacyTosEnumTypeKey } from '@/types/enums'

const EMPTY_HISTORY: readonly unknown[] = []

const flatTosType = (type: LegacyTosEnumTypeKey) =>
  type === 'tos-2-part' ? 'roadmap-tos' as const : 'first-sale-tos' as const

/** @deprecated Use useSingleEnumOptions with roadmap-tos or first-sale-tos. */
export function useTosEnumOptions(type: LegacyTosEnumTypeKey, historicalValues: readonly unknown[] = EMPTY_HISTORY) {
  const flatType = flatTosType(type)
  const configuredRows = useEnumStore(state => state.rowsByType[flatType])
  const hasHydrated = useEnumStore(state => state.hasHydrated)
  const hydrationError = useEnumStore(state => state.hydrationError)

  useEffect(() => {
    if (!hasHydrated) void ensureEnumHydrated()
  }, [hasHydrated])

  const currentValues = useMemo(
    () => hasHydrated && !hydrationError
      ? getCurrentTosEnumValues(type, configuredRows.map(row => row.value))
      : [],
    [configuredRows, hasHydrated, hydrationError, type],
  )
  const options = useMemo(
    () => buildTosEnumOptions(type, currentValues, historicalValues),
    [currentValues, historicalValues, type],
  )

  return {
    currentValues,
    options,
    hasHydrated,
    hydrationError,
    retryHydration: ensureEnumHydrated,
  }
}
