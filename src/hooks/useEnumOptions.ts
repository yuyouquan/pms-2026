'use client'

import { useEffect, useMemo } from 'react'
import {
  buildChipOptions,
  buildEnumOptions,
  findProjectCategoryMapping,
  getTmgDomains,
  getTmgSubdomainState,
  type ChipOption,
  type EnumOption,
  type ProjectChipSnapshot,
  type ProjectCategorySnapshot,
  type SingleEnumTypeKey,
} from '@/lib/enumConsumers'
import { ensureEnumHydrated, useEnumStore } from '@/stores/enums'

const EMPTY_STRINGS: readonly string[] = []
const EMPTY_CHIP_SNAPSHOTS: readonly ProjectChipSnapshot[] = []

export function useEnumHydration(enabled = true) {
  const hasHydrated = useEnumStore(state => state.hasHydrated)
  const hydrationError = useEnumStore(state => state.hydrationError)

  useEffect(() => {
    if (enabled && !hasHydrated) void ensureEnumHydrated()
  }, [enabled, hasHydrated])

  return {
    hasHydrated,
    hydrationError,
    isReady: hasHydrated && !hydrationError,
    retryHydration: ensureEnumHydrated,
  }
}

export function useSingleEnumOptions(
  type: SingleEnumTypeKey,
  historicalValues: readonly string[] = EMPTY_STRINGS,
  enabled = true,
): EnumOption[] {
  const rowsByType = useEnumStore(state => state.rowsByType)
  const { isReady } = useEnumHydration(enabled)
  return useMemo(
    () => {
      if (!isReady) return []
      return buildEnumOptions(rowsByType, type, historicalValues)
    },
    [historicalValues, isReady, rowsByType, type],
  )
}

export function useChipOptions(
  historical: readonly ProjectChipSnapshot[] = EMPTY_CHIP_SNAPSHOTS,
): ChipOption[] {
  const rowsByType = useEnumStore(state => state.rowsByType)
  const { isReady } = useEnumHydration()
  return useMemo(
    () => isReady ? buildChipOptions(rowsByType, historical) : [],
    [historical, isReady, rowsByType],
  )
}

export function useProjectCategoryMapping(ipmCategory?: string): ProjectCategorySnapshot | undefined {
  const rowsByType = useEnumStore(state => state.rowsByType)
  const { isReady } = useEnumHydration()
  return useMemo(
    () => isReady && ipmCategory ? findProjectCategoryMapping(rowsByType, ipmCategory) : undefined,
    [ipmCategory, isReady, rowsByType],
  )
}

export function useTmgOptions(
  domain = '',
  historicalSubdomain?: string,
  historicalDomain?: string,
): { domainOptions: EnumOption[]; subdomainOptions: EnumOption[]; autoValue?: string; disabled: boolean } {
  const rowsByType = useEnumStore(state => state.rowsByType)
  const { isReady } = useEnumHydration()
  return useMemo(() => {
    if (!isReady) {
      return { domainOptions: [], subdomainOptions: [], disabled: false }
    }
    const subdomainState = getTmgSubdomainState(
      rowsByType,
      domain,
      historicalSubdomain,
      historicalDomain,
    )
    return {
      domainOptions: getTmgDomains(rowsByType, historicalDomain),
      subdomainOptions: subdomainState.options,
      autoValue: subdomainState.autoValue,
      disabled: subdomainState.disabled,
    }
  }, [domain, historicalSubdomain, historicalDomain, isReady, rowsByType])
}
