"use client"

import { useEffect, useState, use, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { 
  ArrowLeft, 
  RotateCcw, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  Loader2,
  Clock,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { AppIcon } from "@/components/app-icon"
import { RiskBadge } from "@/components/risk-badge"
import { formatRelativeTime } from "@/lib/utils"
import type { Event, Rollback, Agent } from "@/lib/types"
import { ACTION_LABELS } from "@/lib/types"

interface PageProps {
  params: Promise<{ id: string }>
}

type RollbackStep = "confirm" | "processing" | "success" | "failed"

export default function RollbackPage({ params }: PageProps) {
  const { id } = use(params)
  const router = useRouter()
  const [event, setEvent] = useState<Event | null>(null)
  const [agent, setAgent] = useState<Agent | null>(null)
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState<RollbackStep>("confirm")
  const [rollback, setRollback] = useState<Rollback | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    async function fetchData() {
      const { data: eventData } = await supabase
        .from("events")
        .select("*")
        .eq("id", id)
        .single()

      if (eventData) {
        setEvent(eventData)

        if (eventData.agent_id) {
          const { data: agentData } = await supabase
            .from("agents")
            .select("*")
            .eq("id", eventData.agent_id)
            .single()
          setAgent(agentData)
        }
      }
      setLoading(false)
    }

    fetchData()
  }, [id, supabase])

  // Poll for rollback status
  const pollRollbackStatus = useCallback(async (rollbackId: string) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL
    
    try {
      if (apiUrl) {
        // Try backend API first
        const session = await supabase.auth.getSession()
        const statusResponse = await fetch(
          `${apiUrl}/api/v1/rollback/${rollbackId}/status`,
          {
            headers: {
              Authorization: `Bearer ${session.data.session?.access_token}`,
            },
          }
        )

        if (statusResponse.ok) {
          const statusData = await statusResponse.json()
          
          // Map backend status to local state
          const result = statusData.status === "success" ? "success" : 
                        statusData.status === "failed" ? "failed" : null
          
          if (result) {
            await supabase
              .from("rollbacks")
              .update({
                result,
                failure_reason: result === "failed" ? statusData.error : null,
                executed_at: new Date().toISOString(),
              })
              .eq("id", rollbackId)

            setRollback(prev => prev ? { ...prev, result } : null)
            return result
          }
          return null
        }
      }
    } catch (error) {
      console.error("[v0] Backend status poll error:", error)
    }

    // Fallback to Supabase polling
    const { data } = await supabase
      .from("rollbacks")
      .select("*")
      .eq("id", rollbackId)
      .single()

    if (data) {
      setRollback(data)
      if (data.result === "success") {
        setStep("success")
      } else if (data.result === "failed") {
        setStep("failed")
        setErrorMessage(data.failure_reason || "An unknown error occurred")
      }
      return data.result
    }
    return null
  }, [supabase])

  useEffect(() => {
    if (step === "processing" && rollback?.id) {
      const interval = setInterval(async () => {
        const result = await pollRollbackStatus(rollback.id)
        if (result === "success" || result === "failed") {
          clearInterval(interval)
        }
      }, 2000)

      return () => clearInterval(interval)
    }
  }, [step, rollback?.id, pollRollbackStatus])

  const initiateRollback = async () => {
    if (!event) return

    setStep("processing")

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error("Not authenticated")
      }

      // Create rollback record
      const { data: rollbackData, error: rollbackError } = await supabase
        .from("rollbacks")
        .insert({
          event_id: event.id,
          user_id: user.id,
          initiated_by: "user",
          result: "pending",
        })
        .select()
        .single()

      if (rollbackError) throw rollbackError

      setRollback(rollbackData)

      // Update event status
      await supabase
        .from("events")
        .update({ rollback_status: "in_progress" })
        .eq("id", event.id)

      // Call backend rollback API
      const apiUrl = process.env.NEXT_PUBLIC_API_URL
      if (!apiUrl) {
        throw new Error("API URL not configured")
      }

      const rollbackResponse = await fetch(`${apiUrl}/api/v1/rollback/${event.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          confirmation: true,
          reason: "User initiated rollback from dashboard"
        }),
      })

      if (!rollbackResponse.ok) {
        throw new Error("Failed to initiate rollback on backend")
      }

      // Poll backend for status with 2-second intervals
      const statusInterval = setInterval(async () => {
        try {
          const statusResponse = await fetch(
            `${apiUrl}/api/v1/rollback/${rollbackData.id}/status`,
            {
              headers: {
                Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
              },
            }
          )

          if (statusResponse.ok) {
            const statusData = await statusResponse.json()
            
            if (statusData.status === "success") {
              clearInterval(statusInterval)
              await supabase
                .from("rollbacks")
                .update({
                  result: "success",
                  executed_at: new Date().toISOString(),
                })
                .eq("id", rollbackData.id)

              await supabase
                .from("events")
                .update({ 
                  status: "rolled_back",
                  rollback_status: "completed" 
                })
                .eq("id", event.id)

              setStep("success")
            } else if (statusData.status === "failed") {
              clearInterval(statusInterval)
              await supabase
                .from("rollbacks")
                .update({
                  result: "failed",
                  failure_reason: statusData.error || "Rollback failed",
                  executed_at: new Date().toISOString(),
                })
                .eq("id", rollbackData.id)

              await supabase
                .from("events")
                .update({ rollback_status: "failed" })
                .eq("id", event.id)

              setStep("failed")
              setErrorMessage(statusData.error || "Failed to reverse the action")
            }
          }
        } catch (error) {
          console.error("[v0] Status poll error:", error)
        }
      }, 2000)

      // Cleanup interval on unmount
      return () => clearInterval(statusInterval)

    } catch (error) {
      setStep("failed")
      setErrorMessage(error instanceof Error ? error.message : "Failed to initiate rollback")
    }
  }

  const getActionDescription = () => {
    if (!event) return ""
    
    const action = ACTION_LABELS[event.action_type] || event.action_type
    const target = event.metadata?.recipient || 
      event.metadata?.subject || 
      event.metadata?.channel ||
      event.metadata?.title ||
      ""

    return target ? `${action} "${target}"` : action
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-medium text-foreground mb-2">
            Event not found
          </h2>
          <Link href="/timeline" className="text-sm text-primary hover:underline">
            Back to Timeline
          </Link>
        </div>
      </div>
    )
  }

  if (event.status === "rolled_back") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full text-center"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mx-auto mb-4">
            <CheckCircle2 className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-medium text-foreground mb-2">
            Already rolled back
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            This action has already been reversed.
          </p>
          <Link
            href="/timeline"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-foreground bg-secondary rounded-md hover:bg-secondary/80 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Timeline
          </Link>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-20">
        <div className="flex items-center gap-4 px-6 py-4">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              Rollback Action
            </h1>
            <p className="text-sm text-muted-foreground">
              Reverse the selected action
            </p>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-xl mx-auto p-6">
        <AnimatePresence mode="wait">
          {step === "confirm" && (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Event Summary Card */}
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-start gap-3">
                  <AppIcon app={event.app} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-foreground">
                        {ACTION_LABELS[event.action_type]}
                      </span>
                      <RiskBadge level={event.risk_level} />
                    </div>
                    {event.intent && (
                      <p className="text-sm text-muted-foreground truncate">
                        {event.intent}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatRelativeTime(event.created_at)}
                      {agent && (
                        <span className="font-mono">via {agent.name}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Warning */}
              <div className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-4">
                <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-medium text-amber-400 mb-1">
                    Are you sure you want to rollback this action?
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    This will attempt to reverse: <strong className="text-foreground">{getActionDescription()}</strong>
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3">
                <Link
                  href={`/event/${event.id}/diff`}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-foreground bg-secondary rounded-md hover:bg-secondary/80 transition-colors"
                >
                  Cancel
                </Link>
                <button
                  onClick={initiateRollback}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-primary-foreground bg-primary rounded-md hover:bg-primary/90 transition-colors"
                >
                  <RotateCcw className="h-4 w-4" />
                  Confirm Rollback
                </button>
              </div>
            </motion.div>
          )}

          {step === "processing" && (
            <motion.div
              key="processing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center justify-center py-12 text-center"
            >
              <div className="relative mb-6">
                <div className="h-16 w-16 rounded-full border-2 border-primary/20" />
                <motion.div
                  className="absolute inset-0 h-16 w-16 rounded-full border-2 border-primary border-t-transparent"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">
                Processing rollback...
              </h3>
              <p className="text-sm text-muted-foreground">
                Please wait while we reverse the action.
              </p>

              {/* Status tracker */}
              <div className="mt-8 space-y-3 text-left w-full max-w-xs">
                <StatusStep label="Initiating rollback" status="complete" />
                <StatusStep label="Contacting service" status="active" />
                <StatusStep label="Verifying reversal" status="pending" />
              </div>
            </motion.div>
          )}

          {step === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-12 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", bounce: 0.5 }}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10 mb-6"
              >
                <CheckCircle2 className="h-8 w-8 text-green-400" />
              </motion.div>
              <h3 className="text-lg font-medium text-foreground mb-2">
                Action reversed successfully
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                The action has been rolled back. The original state has been restored.
              </p>
              <Link
                href="/timeline"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-foreground bg-secondary rounded-md hover:bg-secondary/80 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Timeline
              </Link>
            </motion.div>
          )}

          {step === "failed" && (
            <motion.div
              key="failed"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-12 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", bounce: 0.5 }}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 mb-6"
              >
                <XCircle className="h-8 w-8 text-red-400" />
              </motion.div>
              <h3 className="text-lg font-medium text-foreground mb-2">
                Rollback failed
              </h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm">
                {errorMessage || "Unable to reverse this action. The content may have been modified externally."}
              </p>
              <div className="flex items-center gap-3">
                <Link
                  href="/timeline"
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-foreground bg-secondary rounded-md hover:bg-secondary/80 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Timeline
                </Link>
                <button
                  onClick={() => setStep("confirm")}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-md hover:bg-primary/90 transition-colors"
                >
                  <RotateCcw className="h-4 w-4" />
                  Try Again
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function StatusStep({ 
  label, 
  status 
}: { 
  label: string
  status: "pending" | "active" | "complete" 
}) {
  return (
    <div className="flex items-center gap-3">
      {status === "complete" && (
        <CheckCircle2 className="h-4 w-4 text-green-400" />
      )}
      {status === "active" && (
        <Loader2 className="h-4 w-4 text-primary animate-spin" />
      )}
      {status === "pending" && (
        <div className="h-4 w-4 rounded-full border border-muted-foreground/30" />
      )}
      <span className={status === "pending" ? "text-muted-foreground" : "text-foreground"}>
        {label}
      </span>
    </div>
  )
}
