import { ALL_USERS } from '@/constants/permissions'
import { PROJECT_REGISTRY_MANAGERS } from '@/lib/projectRegistryPermissions'

/** Creation and subsequent project/team editing use the same selectable identities. */
export const PROJECT_USER_CHOICES = [...new Set([...ALL_USERS, ...PROJECT_REGISTRY_MANAGERS])]
