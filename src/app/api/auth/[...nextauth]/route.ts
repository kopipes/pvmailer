import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ensureDefaultUser } from '@/lib/auth-helpers'
import { seedSampleTemplates } from '@/lib/templates'
import { resumeCampaignsOnStartup } from '@/lib/campaigns'

// Ensure default admin user and sample templates exist on first boot
ensureDefaultUser()
seedSampleTemplates()

// Resume any campaigns that were running when the server last stopped
resumeCampaignsOnStartup()

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
