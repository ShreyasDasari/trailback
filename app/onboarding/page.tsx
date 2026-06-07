"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Mail, FileText, Hash, ArrowRight, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { TrailbackLogoMark } from "@/components/trailback-logo"

const APPS = [
  { id: "gmail",  name: "Gmail",        icon: Mail,     color: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/20" },
  { id: "gdocs",  name: "Google Docs",  icon: FileText, color: "text-blue-400",   bg: "bg-blue-500/10",   border: "border-blue-500/20" },
  { id: "slack",  name: "Slack",        icon: Hash,     color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20" },
]

export default function OnboardingPage() {
  const [checking, setChecking] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.replace("/login")
      else setChecking(false)
    })
  }, [supabase, router])

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0c]">
        <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-lg"
      >
        <div className="flex justify-center mb-8">
          <TrailbackLogoMark size={48} />
        </div>

        <h1 className="text-3xl font-bold text-white text-center mb-2">
          Welcome to Trailback
        </h1>
        <p className="text-[#7a7a85] text-center mb-10">
          Connect an app so Trailback can record and protect your AI agent&apos;s actions.
        </p>

        <div className="grid gap-3 mb-8">
          {APPS.map((app, i) => {
            const Icon = app.icon
            return (
              <motion.div
                key={app.id}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
                className={`flex items-center gap-4 rounded-xl border ${app.border} ${app.bg} p-4`}
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${app.bg} border ${app.border}`}>
                  <Icon className={`h-5 w-5 ${app.color}`} />
                </div>
                <span className="font-medium text-white">{app.name}</span>
              </motion.div>
            )
          })}
        </div>

        <div className="flex flex-col gap-3">
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            onClick={() => router.push("/settings/connectors")}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl
                       bg-emerald-500 hover:bg-emerald-400 text-[#0a0a0c]
                       font-semibold transition-colors"
          >
            Connect your first app
            <ArrowRight className="h-4 w-4" />
          </motion.button>

          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
            onClick={() => router.push("/timeline")}
            className="w-full py-3 rounded-xl text-sm text-[#7a7a85]
                       hover:text-white transition-colors"
          >
            Skip for now
          </motion.button>
        </div>
      </motion.div>
    </div>
  )
}
