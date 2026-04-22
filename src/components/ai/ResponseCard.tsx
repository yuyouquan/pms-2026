'use client'
import type { ResponseCard as ResponseCardType } from '@/types/ai'
import { ProjectInfoCard } from './cards/ProjectInfoCard'
import { RiskPlansCard } from './cards/RiskPlansCard'
import { PlansTableCard } from './cards/PlansTableCard'
import { RequirementDistCard } from './cards/RequirementDistCard'
import { TransferFlowCard } from './cards/TransferFlowCard'
import { NextActionCard } from './cards/NextActionCard'
import { LinkCard } from './cards/LinkCard'
import { PermissionNoticeCard } from './cards/PermissionNoticeCard'

export function ResponseCard({ card }: { card: ResponseCardType }) {
  switch (card.type) {
    case 'project-info':      return <ProjectInfoCard data={card.data} />
    case 'risk-plans':        return <RiskPlansCard data={card.data} />
    case 'plans-table':       return <PlansTableCard data={card.data} />
    case 'requirement-dist':  return <RequirementDistCard data={card.data} />
    case 'transfer-flow':     return <TransferFlowCard data={card.data} />
    case 'next-action':       return <NextActionCard data={card.data} />
    case 'link':              return <LinkCard data={card.data} />
    case 'permission-notice': return <PermissionNoticeCard data={card.data} />
  }
}
