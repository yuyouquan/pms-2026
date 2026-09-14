'use client'
import { createHrViewHook } from '@/components/project-resources/HrResourceScope'
import { useHrMachineStore as machine } from '@/stores/hrMachine'
import { useHrTosStore as tos } from '@/stores/hrTos'
import { useHrTechnicalStore as technical } from '@/stores/hrTechnical'
import { useHrCapabilityStore as capability } from '@/stores/hrCapability'
export const useHrMachineStore = createHrViewHook(machine)
export const useHrTosStore = createHrViewHook(tos)
export const useHrTechnicalStore = createHrViewHook(technical)
export const useHrCapabilityStore = createHrViewHook(capability)
