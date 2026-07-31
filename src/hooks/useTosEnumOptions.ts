'use client'

import { useEffect, useMemo } from 'react'
import { buildTosEnumOptions, getCurrentTosEnumValues } from '@/lib/tosEnumOptions'
import { ensureEnumHydrated, useEnumStore } from '@/stores/enums'
import type { EnumTypeKey } from '@/types/enums'

export function useTosEnumOptions(type: EnumTypeKey, historicalValues: readonly unknown[] = []) {
  const configuredValues = useEnumStore(state => state.valuesByType[type])
  const hasHydrated = useEnumStore(state => state.hasHydrated)
  const hydrationError = useEnumStore(state => state.hydrationError)

  useEffect(() => {
    if (!hasHydrated) void ensureEnumHydrated()
  }, [hasHydrated])

  const currentValues = useMemo(
    () => hasHydrated && !hydrationError ? getCurrentTosEnumValues(type, configuredValues) : [],
    [configuredValues, hasHydrated, hydrationError, type],
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
