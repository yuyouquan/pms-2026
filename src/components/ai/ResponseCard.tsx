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
import { VersionListCard } from './cards/VersionListCard'
import { VersionCompareCard } from './cards/VersionCompareCard'
import { ProductInfoCardV2 } from './cards/ProductInfoCardV2'
import { MilestonesCard } from './cards/MilestonesCard'
import { PlansByCategoryCard } from './cards/PlansByCategoryCard'
import { PlansByDepartmentCard } from './cards/PlansByDepartmentCard'

export function ResponseCard({ card }: { card: ResponseCardType }) {
  switch (card.type) {
    case 'project-info':           return <ProjectInfoCard data={card.data} />
    case 'risk-plans':             return <RiskPlansCard data={card.data} />
    case 'plans-table':            return <PlansTableCard data={card.data} />
    case 'requirement-dist':       return <RequirementDistCard data={card.data} />
    case 'transfer-flow':          return <TransferFlowCard data={card.data} />
    case 'next-action':            return <NextActionCard data={card.data} />
    case 'link':                   return <LinkCard data={card.data} />
    case 'permission-notice':      return <PermissionNoticeCard data={card.data} />
    case 'version-list':           return <VersionListCard data={card.data} />
    case 'version-compare':        return <VersionCompareCard data={card.data} />
    case 'product-info-v2':        return <ProductInfoCardV2 data={card.data} />
    case 'milestones':             return <MilestonesCard data={card.data} />
    case 'plans-by-category':      return <PlansByCategoryCard data={card.data} />
    case 'plans-by-department':    return <PlansByDepartmentCard data={card.data} />
  }
}
