// ─── Database row types ───────────────────────────────────────────────────────

export interface User {
  id: string
  email: string
  password_hash: string
  name: string
  created_at: string
}

export interface Contact {
  id: string
  email: string
  name: string | null
  extra_data: string | null // JSON blob of extra columns
  group_tags: string | null // comma-separated
  is_suppressed: number // 0 | 1
  suppression_reason: string | null
  created_at: string
  updated_at: string
}

export interface Template {
  id: string
  name: string
  subject: string
  body_html: string
  variables: string | null // JSON array of variable names
  from_name: string
  from_email: string
  created_at: string
  updated_at: string
}

export interface Campaign {
  id: string
  name: string
  template_id: string
  status: CampaignStatus
  total_count: number
  sent_count: number
  failed_count: number
  opened_count: number
  bounced_count: number
  created_at: string
  started_at: string | null
  finished_at: string | null
  paused_at: string | null
}

export type CampaignStatus =
  | 'draft'
  | 'running'
  | 'paused'
  | 'completed'
  | 'cancelled'

export interface CampaignVariable {
  id: string
  campaign_id: string
  variable_name: string
  variable_value: string
}

export type RecipientStatus =
  | 'pending'
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'opened'
  | 'failed'
  | 'bounced'
  | 'complained'

export interface Recipient {
  id: string
  campaign_id: string
  contact_id: string
  email: string
  name: string | null
  extra_data: string | null
  status: RecipientStatus
  resend_message_id: string | null
  idempotency_key: string
  attempt_count: number
  last_error: string | null
  sent_at: string | null
  delivered_at: string | null
  opened_at: string | null
  bounced_at: string | null
  rsvp_token: string | null
  rsvp_response: 'yes' | 'no' | null
  rsvp_at: string | null
  created_at: string
  updated_at: string
}

export interface SendAttemptLog {
  id: string
  recipient_id: string
  campaign_id: string
  attempt_number: number
  status: 'success' | 'failed'
  resend_message_id: string | null
  error_message: string | null
  created_at: string
}

export interface WebhookEventLog {
  id: string
  resend_event_id: string | null
  event_type: string
  email: string | null
  resend_message_id: string | null
  raw_payload: string
  processed: number // 0 | 1
  created_at: string
}

// ─── API / UI types ────────────────────────────────────────────────────────────

export interface ContactRow extends Contact {
  extra: Record<string, string>
  tags: string[]
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
}

export interface CampaignWithTemplate extends Campaign {
  template_name: string
  template_subject: string
  from_name: string
  from_email: string
}

export interface RecipientWithContact extends Recipient {
  contact_email: string
  contact_name: string | null
}

export interface DashboardStats {
  totalContacts: number
  activeContacts: number
  suppressedContacts: number
  totalTemplates: number
  totalCampaigns: number
  runningCampaigns: number
  emailsSentTotal: number
  emailsOpenedTotal: number
}
