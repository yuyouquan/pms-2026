'use client'

import { useMemo } from 'react'
import {
  buildChipOptions,
  buildEnumOptions,
  findProjectCategoryMapping,
  getTmgDomains,
  getTmgSubdomainState,
  type ProjectChipSnapshot,
  type SingleEnumTypeKey,
} from '@/lib/enumConsumers'
import { useEnumStore } from '@/stores/enums'

const EMPTY_STRINGS: readonly string[] = []
const EMPTY_CHIP_SNAPSHOTS: readonly ProjectChipSnapshot[] = []

export function useSingleEnumOptions(
  type: SingleEnumTypeKey,
  historicalValues: readonly string[] = EMPTY_STRINGS,
) {
  const rowsByType = useEnumStore(state => state.rowsByType)
  return useMemo(
    () => buildEnumOptions(rowsByType, type, historicalValues),
    [historicalValues, rowsByType, type],
  )
}

export function useChipOptions(
  historical: readonly ProjectChipSnapshot[] = EMPTY_CHIP_SNAPSHOTS,
) {
  const rowsByType = useEnumStore(state => state.rowsByType)
  return useMemo(
    () => buildChipOptions(rowsByType, historical),
    [historical, rowsByType],
  )
}

export function useProjectCategoryMapping(ipmCategory?: string) {
  const rowsByType = useEnumStore(state => state.rowsByType)
  return useMemo(
    () => ipmCategory ? findProjectCategoryMapping(rowsByType, ipmCategory) : undefined,
    [ipmCategory, rowsByType],
  )
}

export function useTmgOptions(
  domain = '',
  historicalSubdomain?: string,
  historicalDomain?: string,
) {
  const rowsByType = useEnumStore(state => state.rowsByType)
  return useMemo(() => {
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
  }, [domain, historicalSubdomain, historicalDomain, rowsByType])
}
