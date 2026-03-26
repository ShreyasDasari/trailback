"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Mail, 
  FileText, 
  Hash, 
  CheckCircle2, 
  XCircle,
  Plug,
  ExternalLink,
  Loader2,
  Sparkles,
  Shield,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { cn, formatDate } from "@/lib/utils"
import type { Connector, AppType } from "@/lib/types"

interface ConnectorConfig {
  app: AppType
  name: string
  description: string
  icon: typeof Mail
  color: string
  bgColor: string
  borderColor: string
}

const connectorConfigs: ConnectorConfig[] = [
  {
    app: "gmail",
    name: "Gmail",
    description: "Monitor emails sent by AI agents",
    icon: Mail,
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/20",
  },
  {
    app: "gdocs",
    name: "Google Docs",
    description: "Track document edits made by AI agents",
    icon: FileText,
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/20",
  },
  {
    app: "slack",
    name: "Slack",
    description: "Monitor messages sent in Slack channels",
    icon: Hash,
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/20",
  },
]

export default function ConnectorsPage() {
  const [connectors, setConnectors] = useState<Connector[]>([])
  const [loading, setLoading] = useState(true)
  const [connectingApp, setConnectingApp] = useState<AppType | null>(null)

  const supabase = createClient()

  useEffect(() => {
    async function fetchConnectors() {
      const { data } = await supabase
        .from("connectors")
        .select("*")
        .order("created_at", { ascending: false })

      setConnectors(data || [])
      setLoading(false)
    }

    fetchConnectors()
  }, [supabase])

  const getConnectorStatus = (app: AppType): Connector | undefined => {
    return connectors.find((c) => c.app === app && c.is_active)
  }

  const handleConnect = async (app: AppType) => {
    setConnectingApp(app)
    try {
      if (app === 'slack') {
        // Slack OAuth goes through the backend (requires Slack App credentials)
        const apiBase = process.env.NEXT_PUBLIC_API_URL
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { window.location.href = '/login'; return }
        window.location.href = `${apiBase}/api/v1/connectors/slack/install?token=${session.access_token}`
        return
      }

      // Google apps (gmail, gdocs) — use Supabase Google OAuth with appropriate scopes
      const scopes: Record<string, string> = {
        gmail: 'openid email profile https://www.googleapis.com/auth/gmail.modify',
        gdocs: 'openid email profile https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/drive.file',
      }

      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/settings/connectors`,
          scopes: scopes[app] ?? 'openid email profile',
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })
    } catch {
      setConnectingApp(null)
    }
  }

  const handleDisconnect = async (connector: Connector) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/v1/connectors/${connector.app}`,
          { method: 'DELETE', headers: { Authorization: `Bearer ${session.access_token}` } }
        )
      }
    } catch { /* fallback to local update */ }

    // Optimistic update
    setConnectors((prev) =>
      prev.map((c) =>
        c.id === connector.id
          ? { ...c, is_active: false, oauth_token: null, refresh_token: null }
          : c
      )
    )
  }

  const connectedCount = connectorConfigs.filter(c => getConnectorStatus(c.app)).length

  return (
    <div className="min-h-screen">
      {/* Header */}
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-20"
      >
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", bounce: 0.5, delay: 0.1 }}
              className="flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10 border border-primary/20"
            >
              <Plug className="h-5 w-5 text-primary" />
            </motion.div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Connectors</h1>
              <p className="text-sm text-muted-foreground">
                Connect your apps to start recording AI agent actions
              </p>
            </div>
          </div>
          
          {/* Status indicator */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/50 border border-border"
          >
            <span className={cn(
              "h-2 w-2 rounded-full",
              connectedCount > 0 ? "bg-green-500" : "bg-muted-foreground"
            )} />
            <span className="text-xs font-medium text-muted-foreground">
              {connectedCount}/{connectorConfigs.length} connected
            </span>
          </motion.div>
        </div>
      </motion.header>

      {/* Content */}
      <div className="p-6">
        {/* Connector Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence>
            {connectorConfigs.map((config, index) => {
              const connector = getConnectorStatus(config.app)
              const isConnected = !!connector
              const isConnecting = connectingApp === config.app
              const Icon = config.icon

              return (
                <motion.div
                  key={config.app}
                  initial={{ opacity: 0, y: 30, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{
                    delay: index * 0.1,
                    type: "spring",
                    stiffness: 100,
                    damping: 15
                  }}
                  whileHover={{ y: -4, transition: { duration: 0.2 } }}
                  whileTap={{ scale: 0.97 }}
                  className="relative rounded-xl border bg-[var(--bg-surface)] p-5 transition-all duration-300"
                  style={{
                    borderColor: isConnected ? "rgba(52,211,153,0.35)" : "var(--border)",
                    boxShadow: isConnected
                      ? "0 0 0 1px rgba(52,211,153,0.15), 0 4px 24px -4px rgba(52,211,153,0.12)"
                      : undefined,
                  }}
                >
                  {/* Connected emerald glow */}
                  {isConnected && (
                    <div
                      className="absolute inset-0 rounded-xl -z-10 opacity-30 blur-xl"
                      style={{ background: "radial-gradient(ellipse at top left, rgba(52,211,153,0.3), transparent 70%)" }}
                    />
                  )}

                  <div className="flex items-start justify-between mb-4">
                    <motion.div 
                      className={cn(
                        "flex h-12 w-12 items-center justify-center rounded-xl border",
                        config.bgColor,
                        config.borderColor
                      )}
                      whileHover={{ rotate: [0, -5, 5, 0] }}
                      transition={{ duration: 0.3 }}
                    >
                      <Icon className={cn("h-6 w-6", config.color)} />
                    </motion.div>
                    
                    <AnimatePresence mode="wait">
                      {isConnected ? (
                        <motion.span 
                          key="connected"
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-green-500/10 text-green-400 border border-green-500/20"
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          Connected
                        </motion.span>
                      ) : (
                        <motion.span 
                          key="disconnected"
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-muted text-muted-foreground border border-border"
                        >
                          <XCircle className="h-3 w-3" />
                          Not connected
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>

                  <h3 className="text-lg font-semibold text-foreground mb-1">
                    {config.name}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {config.description}
                  </p>

                  {isConnected && connector && (
                    <motion.p 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-xs text-muted-foreground mb-4 flex items-center gap-1.5"
                    >
                      <Sparkles className="h-3 w-3 text-primary" />
                      Connected {formatDate(connector.connected_at || connector.created_at)}
                    </motion.p>
                  )}

                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    {isConnected ? (
                      <button
                        onClick={() => handleDisconnect(connector!)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5
                                   text-sm font-medium text-[var(--text-muted)]
                                   bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg
                                   hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]
                                   transition-all duration-200"
                      >
                        Disconnect
                      </button>
                    ) : (
                      <button
                        onClick={() => handleConnect(config.app)}
                        disabled={isConnecting}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5
                                   text-sm font-medium rounded-lg transition-all duration-200
                                   disabled:opacity-50 text-[var(--bg-base)]
                                   bg-[var(--accent)] hover:bg-[var(--accent)]/90"
                      >
                        {isConnecting ? (
                          <><Loader2 className="h-4 w-4 animate-spin" /> Connecting…</>
                        ) : (
                          <><Plug className="h-4 w-4" /> Connect</>
                        )}
                      </button>
                    )}
                  </motion.div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>

        {/* Info section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-8 rounded-xl border border-border bg-card/50 p-6"
        >
          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 flex-shrink-0">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">
                How connectors work
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Connectors use OAuth to securely access your accounts. Trailback only
                reads action metadata and content for diff comparison — we never modify
                your data except when you explicitly request a rollback.
              </p>
              <a
                href="#"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline group"
              >
                Learn more about security
                <ExternalLink className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
