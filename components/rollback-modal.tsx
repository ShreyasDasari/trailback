"use client"

/**
 * RollbackModal — item 6
 *
 * Backdrop blur overlay. Animated warning icon (shake on mount).
 * Spinner during execution. Success checkmark / error X on completion.
 * Cannot close by clicking outside during execution ("processing" step).
 */

import { useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Loader2,
  X,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { Event } from "@/lib/types"

type Step = "confirm" | "processing" | "success" | "failed"

interface RollbackModalProps {
  event: Event
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function RollbackModal({ event, open, onClose, onSuccess }: RollbackModalProps) {
  const [step, setStep] = useState<Step>("confirm")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const supabase = createClient()

  const isProcessing = step === "processing"

  const handleBackdropClick = () => {
    if (!isProcessing) onClose()
  }

  const handleClose = () => {
    if (!isProcessing) {
      setStep("confirm")
      setErrorMsg(null)
      onClose()
    }
  }

  const handleRollback = useCallback(async () => {
    setStep("processing")
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const apiUrl = process.env.NEXT_PUBLIC_API_URL
      if (!apiUrl) throw new Error("API URL not configured")

      const res = await fetch(`${apiUrl}/api/v1/rollback/${event.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ confirmation: true, reason: "User initiated rollback from dashboard" }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.detail?.message ?? `Rollback failed (${res.status})`)
      }

      const data = await res.json()
      const rollbackId: string = data.rollback_id

      // Poll status every 2s, up to 60s
      for (let i = 0; i < 30; i++) {
        await new Promise<void>((resolve) => setTimeout(resolve, 2000))

        const statusRes = await fetch(`${apiUrl}/api/v1/rollback/${rollbackId}/status`, {
          headers: { Authorization: `Bearer ${session?.access_token}` },
        })

        if (statusRes.ok) {
          const s = await statusRes.json()
          if (s.status === "success") {
            setStep("success")
            setTimeout(() => onSuccess(), 1500)
            return
          }
          if (s.status === "failed") {
            throw new Error(s.failure_reason ?? "Rollback failed on server")
          }
        }
      }

      throw new Error("Rollback timed out — check Timeline for final status")
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "An unknown error occurred")
      setStep("failed")
    }
  }, [event.id, supabase, onSuccess])

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleBackdropClick}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 10 }}
            transition={{ type: "spring", bounce: 0.25, duration: 0.35 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50
                       w-full max-w-md bg-[var(--bg-surface)] border border-[var(--border)]
                       rounded-2xl shadow-2xl shadow-black/60 p-6"
          >
            {/* Close button — hidden during processing */}
            {!isProcessing && (
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 p-1 rounded-lg text-[var(--text-muted)]
                           hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}

            <AnimatePresence mode="wait">

              {/* ── Confirm ──────────────────────────────────── */}
              {step === "confirm" && (
                <motion.div
                  key="confirm"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-5"
                >
                  {/* Warning icon — brief shake on mount */}
                  <motion.div
                    className="flex h-14 w-14 items-center justify-center rounded-full
                               bg-amber-500/10 border border-amber-500/20 mx-auto"
                    initial={{ rotate: -8, scale: 0.8 }}
                    animate={{ rotate: [0, -8, 8, -4, 4, 0], scale: 1 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  >
                    <AlertTriangle className="h-7 w-7 text-amber-400" />
                  </motion.div>

                  <div className="text-center">
                    <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
                      Confirm Rollback
                    </h2>
                    <p className="text-sm text-[var(--text-muted)]">
                      This will attempt to reverse:{" "}
                      <strong className="text-[var(--text-primary)]">
                        {event.metadata?.recipient
                          ? `email to ${String(event.metadata.recipient)}`
                          : event.action_type}
                      </strong>
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <motion.button
                      onClick={handleClose}
                      whileTap={{ scale: 0.97 }}
                      className="flex-1 px-4 py-2.5 text-sm font-medium text-[var(--text-primary)]
                                 bg-[var(--bg-elevated)] rounded-lg border border-[var(--border)]
                                 hover:bg-[var(--bg-surface)] transition-colors"
                    >
                      Cancel
                    </motion.button>
                    <motion.button
                      onClick={handleRollback}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5
                                 text-sm font-medium text-white bg-red-600 hover:bg-red-500
                                 rounded-lg shadow-lg shadow-red-500/25 transition-all duration-200"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Confirm Rollback
                    </motion.button>
                  </div>
                </motion.div>
              )}

              {/* ── Processing ───────────────────────────────── */}
              {step === "processing" && (
                <motion.div
                  key="processing"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col items-center py-6 text-center space-y-4"
                >
                  <div className="relative">
                    <div className="h-16 w-16 rounded-full border-2 border-[var(--border)]" />
                    <motion.div
                      className="absolute inset-0 h-16 w-16 rounded-full border-2 border-[var(--accent)] border-t-transparent"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Loader2 className="h-5 w-5 text-[var(--accent)]" />
                    </div>
                  </div>
                  <h3 className="text-base font-medium text-[var(--text-primary)]">
                    Processing rollback…
                  </h3>
                  <p className="text-sm text-[var(--text-muted)]">
                    Please wait — do not close this window.
                  </p>
                </motion.div>
              )}

              {/* ── Success ──────────────────────────────────── */}
              {step === "success" && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: "spring", bounce: 0.4, duration: 0.4 }}
                  className="flex flex-col items-center py-6 text-center space-y-3"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", bounce: 0.5 }}
                    className="flex h-16 w-16 items-center justify-center rounded-full
                               bg-green-500/10 border border-green-500/20"
                  >
                    <CheckCircle2 className="h-8 w-8 text-green-400" />
                  </motion.div>
                  <h3 className="text-base font-medium text-[var(--text-primary)]">
                    Action reversed
                  </h3>
                  <p className="text-sm text-[var(--text-muted)]">
                    The original state has been restored.
                  </p>
                </motion.div>
              )}

              {/* ── Failed ───────────────────────────────────── */}
              {step === "failed" && (
                <motion.div
                  key="failed"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: "spring", bounce: 0.3, duration: 0.35 }}
                  className="flex flex-col items-center py-6 text-center space-y-4"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", bounce: 0.4 }}
                    className="flex h-16 w-16 items-center justify-center rounded-full
                               bg-red-500/10 border border-red-500/20"
                  >
                    <XCircle className="h-8 w-8 text-red-400" />
                  </motion.div>
                  <div>
                    <h3 className="text-base font-medium text-[var(--text-primary)] mb-1">
                      Rollback failed
                    </h3>
                    <p className="text-sm text-[var(--text-muted)] max-w-xs">{errorMsg}</p>
                  </div>
                  <div className="flex gap-3 w-full">
                    <button
                      onClick={handleClose}
                      className="flex-1 px-4 py-2.5 text-sm font-medium text-[var(--text-primary)]
                                 bg-[var(--bg-elevated)] rounded-lg border border-[var(--border)]
                                 hover:bg-[var(--bg-surface)] transition-colors"
                    >
                      Close
                    </button>
                    <button
                      onClick={() => { setStep("confirm"); setErrorMsg(null) }}
                      className="flex-1 px-4 py-2.5 text-sm font-medium text-white
                                 bg-red-600 hover:bg-red-500 rounded-lg transition-colors"
                    >
                      Try again
                    </button>
                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
