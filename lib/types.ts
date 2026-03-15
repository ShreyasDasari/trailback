// Database types for Trailback

export type AppType = 'gmail' | 'google_docs' | 'slack' | 'notion' | 'github'

export type ActionType = 
  | 'send_email' 
  | 'edit_document' 
  | 'send_message' 
  | 'create_page' 
  | 'create_issue' 
  | 'comment' 
  | 'delete' 
  | 'archive' 
  | 'move' 
  | 'custom'

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

export type EventStatus = 'pending' | 'completed' | 'failed' | 'rolled_back'

export type RollbackStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'partial'

export type AgentType = 'claude' | 'gpt' | 'gemini' | 'copilot' | 'custom'

export type SnapshotType = 'before' | 'after'

// Database table types
export interface Agent {
  id: string
  user_id: string
  name: string
  type: AgentType
  identifier: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Connector {
  id: string
  user_id: string
  app: AppType
  oauth_token: string | null
  refresh_token: string | null
  auth_token_encrypted: string | null
  refresh_token_encrypted: string | null
  token_expires_at: string | null
  scopes: string[] | null
  is_connected: boolean
  is_active: boolean
  connected_at: string | null
  last_sync_at: string | null
  last_used_at: string | null
  created_at: string
  updated_at: string
}

export interface Event {
  id: string
  user_id: string
  agent_id: string | null
  app: AppType
  action_type: ActionType
  intent: string | null
  risk_level: RiskLevel
  risk_score: number | null
  risk_reasons: string[] | null
  status: EventStatus
  rollback_status: RollbackStatus | null
  metadata: Record<string, unknown>
  idempotency_key: string | null
  created_at: string
  updated_at: string
}

export interface Snapshot {
  id: string
  event_id: string
  snapshot_type: SnapshotType
  content: Record<string, unknown>
  content_hash: string | null
  captured_at: string
}

export interface Rollback {
  id: string
  event_id: string
  user_id: string
  initiated_by: string | null
  result: string | null
  failure_reason: string | null
  api_response: Record<string, unknown> | null
  executed_at: string | null
}

// UI helper types
export interface EventWithDetails extends Event {
  agent?: Agent | null
  snapshots?: Snapshot[]
  rollback?: Rollback | null
}

// Filter types for timeline
export interface TimelineFilters {
  app: AppType | 'all'
  riskLevel: RiskLevel | 'all'
  dateRange: {
    from: Date | null
    to: Date | null
  }
}

// App metadata for UI
export const APP_METADATA: Record<AppType, { name: string; color: string; icon: string }> = {
  gmail: { name: 'Gmail', color: '#ef4444', icon: 'mail' },
  google_docs: { name: 'Google Docs', color: '#3b82f6', icon: 'file-text' },
  slack: { name: 'Slack', color: '#a855f7', icon: 'hash' },
  notion: { name: 'Notion', color: '#000000', icon: 'book-open' },
  github: { name: 'GitHub', color: '#6b7280', icon: 'github' },
}

export const RISK_METADATA: Record<RiskLevel, { label: string; color: string; bgColor: string }> = {
  low: { label: 'Low', color: '#6b7280', bgColor: 'bg-gray-500/10' },
  medium: { label: 'Medium', color: '#f59e0b', bgColor: 'bg-amber-500/10' },
  high: { label: 'High', color: '#f97316', bgColor: 'bg-orange-500/10' },
  critical: { label: 'Critical', color: '#dc2626', bgColor: 'bg-red-500/10' },
}

export const ACTION_LABELS: Record<ActionType, string> = {
  send_email: 'Sent email',
  edit_document: 'Edited document',
  send_message: 'Sent message',
  create_page: 'Created page',
  create_issue: 'Created issue',
  comment: 'Added comment',
  delete: 'Deleted',
  archive: 'Archived',
  move: 'Moved',
  custom: 'Custom action',
}
