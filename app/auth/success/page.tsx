"use client"

/**
 * /auth/success — Extension Session Bridge
 *
 * Only shown when the user signed in from the Chrome extension
 * (?from=extension → callback appends ?ext=1 → redirected here).
 *
 * This page:
 *  1. Reads the current Supabase session (already set in cookies by the callback)
 *  2. Writes the session tokens to localStorage under 'trailback_ext_handoff'
 *  3. Fires a 'trailback_session_ready' event so the extension-bridge content
 *     script can pick it up immediately
 *  4. Displays a "You can close this tab" success screen
 *
 * Falls back to /timeline if not coming from extension context.
 */

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { CheckCircle2, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

type Status = "loading" | "success" | "error"

export default function AuthSuccessPage() {
  const [status, setStatus] = useState<Status>("loading")
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function bridgeSession() {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()

        if (error || !session) {
          // No session — may have arrived here directly without extension context
          router.replace("/timeline")
          return
        }

        // Write handoff data for the extension-bridge content script
        const handoff = {
          access_token:  session.access_token,
          refresh_token: session.refresh_token,
          expires_at:    session.expires_at,  // epoch seconds
        }

        localStorage.setItem("trailback_ext_handoff", JSON.stringify(handoff))

        // Signal the content script (in case it's already listening)
        window.dispatchEvent(new Event("trailback_session_ready"))

        setStatus("success")
      } catch {
        setStatus("error")
      }
    }

    bridgeSession()
  }, [supabase, router])

  return (
    <div className="min-h-screen flex items-center justify-center"
      style={{ background: "var(--bg-base, #09090b)" }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", bounce: 0.3, duration: 0.5 }}
        className="flex flex-col items-center gap-5 text-center max-w-sm px-6"
      >
        {status === "loading" && (
          <>
            <div className="flex h-14 w-14 items-center justify-center rounded-full
                            bg-[var(--accent-dim,rgba(110,231,183,0.1))]
                            border border-[rgba(110,231,183,0.2)]">
              <Loader2 className="h-6 w-6 animate-spin text-[#6ee7b7]" />
            </div>
            <p className="text-sm text-[#71717a]">Connecting extension…</p>
          </>
        )}

        {status === "success" && (
          <>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", bounce: 0.5, delay: 0.1 }}
              className="flex h-14 w-14 items-center justify-center rounded-full
                          bg-[rgba(34,197,94,0.1)] border border-[rgba(34,197,94,0.25)]"
            >
              <CheckCircle2 className="h-7 w-7 text-[#22c55e]" />
            </motion.div>

            <div>
              <h1 className="text-lg font-semibold text-[#fafafa] mb-1">
                Extension connected!
              </h1>
              <p className="text-sm text-[#71717a] leading-relaxed">
                Trailback is now recording AI agent actions.<br />
                You can close this tab.
              </p>
            </div>

            <motion.a
              href="/timeline"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-sm text-[#6ee7b7] hover:underline"
            >
              Open Dashboard →
            </motion.a>
          </>
        )}

        {status === "error" && (
          <>
            <div className="flex h-14 w-14 items-center justify-center rounded-full
                            bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)]">
              <span className="text-2xl">⚠️</span>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-[#fafafa] mb-1">Something went wrong</h1>
              <p className="text-sm text-[#71717a]">
                Could not relay your session to the extension.
              </p>
            </div>
            <a href="/login" className="text-sm text-[#6ee7b7] hover:underline">Try again</a>
          </>
        )}
      </motion.div>
    </div>
  )
}
