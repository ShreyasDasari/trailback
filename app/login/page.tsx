"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Shield, RotateCcw, Eye, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

// ─── All original auth logic preserved unchanged ──────────────
export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        router.replace('/timeline')
      } else {
        setCheckingAuth(false)
      }
    }
    checkUser()
  }, [supabase, router])

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)] bg-grid">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <span className="font-mono text-2xl text-[var(--accent)]">trailback</span>
          <Loader2 className="h-5 w-5 animate-spin text-[var(--accent)]" />
        </motion.div>
      </div>
    )
  }

  const handleGoogleSignIn = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: [
          "openid",
          "email",
          "profile",
          "https://www.googleapis.com/auth/gmail.modify",
          "https://www.googleapis.com/auth/drive.file",
          "https://www.googleapis.com/auth/documents",
        ].join(" "),
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    })
    if (error) {
      console.error("[v0] OAuth error:", error)
      setLoading(false)
    }
  }

  const trustSignals = [
    { icon: Shield,    label: "SOC 2 Type II",       desc: "Enterprise-grade security" },
    { icon: Eye,       label: "Zero data retention", desc: "We never store your content" },
    { icon: RotateCcw, label: "One-click undo",      desc: "Reverse any action instantly" },
  ]

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)] bg-grid relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[var(--accent)] opacity-[0.03] rounded-full blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-sm px-6 flex flex-col items-center"
      >
        {/* Wordmark */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mb-3"
        >
          <span className="font-mono text-4xl font-bold tracking-tight text-[var(--accent)]">
            trailback
          </span>
        </motion.div>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-sm text-[var(--text-muted)] text-center mb-10 font-mono"
        >
          Every agent action, recorded and reversible.
        </motion.p>

        {/* Google sign-in button */}
        <motion.button
          onClick={handleGoogleSignIn}
          disabled={loading}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          whileHover={{ scale: 1.02, y: -1 }}
          whileTap={{ scale: 0.97 }}
          className="w-full flex items-center justify-center gap-3 px-4 py-3.5 text-sm font-medium
                     text-[var(--text-primary)] bg-[var(--bg-elevated)] border border-[var(--border)]
                     rounded-xl hover:border-[var(--accent)]/30 hover:bg-[var(--bg-surface)]
                     transition-all duration-200 disabled:opacity-50 shadow-xl shadow-black/30 mb-8"
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-[var(--accent)]" />
          ) : (
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path fill="#EA4335" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#4285F4" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
          )}
          {loading ? "Signing in…" : "Continue with Google"}
        </motion.button>

        {/* Trust signals */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="w-full grid grid-cols-3 gap-3"
        >
          {trustSignals.map((signal, i) => (
            <motion.div
              key={signal.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 + i * 0.07 }}
              className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-[var(--bg-surface)]
                         border border-[var(--border)] text-center"
            >
              <signal.icon className="h-4 w-4 text-[var(--accent)]" />
              <span className="text-[10px] font-medium text-[var(--text-primary)] leading-tight">{signal.label}</span>
              <span className="text-[9px] text-[var(--text-muted)] leading-tight">{signal.desc}</span>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </div>
  )
}
