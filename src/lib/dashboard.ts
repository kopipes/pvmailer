import { getDb } from './db'
import type { DashboardStats } from '@/types'

export function getDashboardStats(): DashboardStats {
  const db = getDb()

  const totalContacts = (db.prepare('SELECT COUNT(*) as c FROM contacts').get() as { c: number }).c
  const suppressedContacts = (
    db.prepare('SELECT COUNT(*) as c FROM contacts WHERE is_suppressed = 1').get() as { c: number }
  ).c
  const activeContacts = totalContacts - suppressedContacts

  const totalTemplates = (db.prepare('SELECT COUNT(*) as c FROM templates').get() as { c: number }).c

  const totalCampaigns = (db.prepare('SELECT COUNT(*) as c FROM campaigns').get() as { c: number }).c
  const runningCampaigns = (
    db.prepare(`SELECT COUNT(*) as c FROM campaigns WHERE status = 'running'`).get() as { c: number }
  ).c

  const emailsSentTotal = (
    db
      .prepare(`SELECT COALESCE(SUM(sent_count), 0) as c FROM campaigns`)
      .get() as { c: number }
  ).c

  const emailsOpenedTotal = (
    db
      .prepare(`SELECT COALESCE(SUM(opened_count), 0) as c FROM campaigns`)
      .get() as { c: number }
  ).c

  return {
    totalContacts,
    activeContacts,
    suppressedContacts,
    totalTemplates,
    totalCampaigns,
    runningCampaigns,
    emailsSentTotal,
    emailsOpenedTotal,
  }
}
