/**
 * lib/api.ts — Typed API client for the Trailback backend
 *
 * All requests include the Supabase JWT as Bearer token.
 * Each function throws a typed ApiError on non-2xx responses.
 */

import { createClient } from '@/lib/supabase/client'
import type { AppType } from '@/lib/types'

const API_BASE = process.env.NEXT_PUBLIC_API_URL

// ─────────────────────────────────────────────────────────────
// Error type
// ─────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// ─────────────────────────────────────────────────────────────
// Auth header helper
// ─────────────────────────────────────────────────────────────

async function getHeaders(): Promise<Record<string, string>> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session?.access_token) {
    throw new ApiError(401, 'NO_SESSION', 'No active session — please sign in')
  }

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
  }
}

// ─────────────────────────────────────────────────────────────
// Core fetch wrapper
// ─────────────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  if (!API_BASE) {
    throw new ApiError(0, 'NO_API_URL', 'NEXT_PUBLIC_API_URL is not configured')
  }

  const headers = await getHeaders()
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers as Record<string, string> || {}) },
  })

  // 204 No Content — no body to parse
  if (response.status === 204) {
    return undefined as T
  }

  const json = await response.json().catch(() => ({}))

  if (!response.ok) {
    const detail = json?.detail
    const code = typeof detail === 'object' ? detail?.code : 'API_ERROR'
    const message =
      typeof detail === 'string'
        ? detail
        : detail?.message ?? `HTTP ${response.status}`
    throw new ApiError(response.status, code ?? 'API_ERROR', message)
  }

  return json as T
}

// ─────────────────────────────────────────────────────────────
// Response types
// ─────────────────────────────────────────────────────────────

export interface TimelineParams {
  limit?: number
  offset?: number
  app?: string
  risk_level?: string
}

export interface TimelineItem {
  id: string
  app: string
  action_type: string
  risk_level: string
  risk_score: number
  risk_reasons: string[]
  rollback_status: string
  status: string
  metadata: Record<string, unknown>
  created_at: string
  agent_id: string | null
}

export interface TimelineResponse {
  events: TimelineItem[]
  total: number
  limit: number
  offset: number
}

export interface EventDetail extends TimelineItem {
  intent: string | null
  idempotency_key: string | null
  updated_at: string
}

export interface DiffResponse {
  event_id: string
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  diff_lines: string[]
}

export interface RollbackResponse {
  rollback_id: string
  event_id: string
  status: 'pending' | 'success' | 'failed'
  message?: string
}

export interface RollbackStatusResponse {
  rollback_id: string
  event_id: string
  status: 'pending' | 'success' | 'failed'
  result: string | null
  failure_reason: string | null
  executed_at: string | null
}

export interface ConnectorStatus {
  app: AppType
  connected: boolean
  last_sync_at: string | null
  scopes: string[] | null
}

export interface ConnectorsResponse {
  connectors: ConnectorStatus[]
}

// ─────────────────────────────────────────────────────────────
// API functions
// ─────────────────────────────────────────────────────────────

/** GET /api/v1/timeline — paginated event feed */
export async function fetchTimeline(params: TimelineParams = {}): Promise<TimelineResponse> {
  const qs = new URLSearchParams()
  if (params.limit)      qs.set('limit', String(params.limit))
  if (params.offset)     qs.set('offset', String(params.offset))
  if (params.app)        qs.set('app', params.app)
  if (params.risk_level) qs.set('risk_level', params.risk_level)

  const query = qs.toString() ? `?${qs.toString()}` : ''
  return apiFetch<TimelineResponse>(`/api/v1/timeline${query}`)
}

/** GET /api/v1/events/{id} — single event detail */
export async function fetchEvent(id: string): Promise<EventDetail> {
  return apiFetch<EventDetail>(`/api/v1/events/${id}`)
}

/** GET /api/v1/events/{id}/diff — before/after diff */
export async function fetchDiff(id: string): Promise<DiffResponse> {
  return apiFetch<DiffResponse>(`/api/v1/events/${id}/diff`)
}

/** POST /api/v1/rollback/{id} — initiate rollback (returns 202) */
export async function initiateRollback(
  eventId: string,
  reason = 'User initiated rollback from dashboard',
): Promise<RollbackResponse> {
  return apiFetch<RollbackResponse>(`/api/v1/rollback/${eventId}`, {
    method: 'POST',
    body: JSON.stringify({ confirmation: true, reason }),
  })
}

/** GET /api/v1/rollback/{id}/status — poll rollback result */
export async function fetchRollbackStatus(rollbackId: string): Promise<RollbackStatusResponse> {
  return apiFetch<RollbackStatusResponse>(`/api/v1/rollback/${rollbackId}/status`)
}

/** GET /api/v1/connectors — all connector statuses for current user */
export async function fetchConnectors(): Promise<ConnectorsResponse> {
  return apiFetch<ConnectorsResponse>('/api/v1/connectors')
}

/** DELETE /api/v1/connectors/{app} — disconnect a connector */
export async function disconnectConnector(app: AppType): Promise<void> {
  return apiFetch<void>(`/api/v1/connectors/${app}`, { method: 'DELETE' })
}
