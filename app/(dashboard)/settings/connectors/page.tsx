"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { 
  Mail, 
  FileText, 
  Hash, 
  CheckCircle2, 
  XCircle,
  Plug,
  ExternalLink,
  Loader2,
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
}

const connectorConfigs: ConnectorConfig[] = [
  {
    app: "gmail",
    name: "Gmail",
    description: "Monitor emails sent by AI agents",
    icon: Mail,
    color: "text-red-400",
    bgColor: "bg-red-500/10",
  },
  {
    app: "gdocs",
    name: "Google Docs",
    description: "Track document edits made by AI agents",
    icon: FileText,
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
  },
  {
    app: "slack",
    name: "Slack",
    description: "Monitor messages sent in Slack channels",
    icon: Hash,
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
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
    // Only show as connected if is_active is true (tokens are stored on backend only due to RLS)
    return connectors.find((c) => c.app === app && c.is_active)
  }

  const handleConnect = async (app: AppType) => {
    // For Gmail and Google Docs, the connection happens via the main OAuth login flow
    // Slack would require a separate OAuth flow (not implemented yet)
    if (app === 'slack') {
      // TODO: Implement Slack OAuth flow
      alert('Slack integration requires separate OAuth setup. Please contact support.')
      return
    }
    
    // Gmail and Google Docs are connected via the main Google OAuth flow
    // If not connected, redirect to login to re-authenticate with proper scopes
    setConnectingApp(app)
    window.location.href = '/login'
  }

  const handleDisconnect = async (connector: Connector) => {
    await supabase
      .from("connectors")
      .update({ 
        is_connected: false, 
        is_active: false,
        oauth_token: null,
        refresh_token: null,
      })
      .eq("id", connector.id)

    setConnectors((prev) =>
      prev.map((c) =>
        c.id === connector.id 
          ? { ...c, is_connected: false, is_active: false, oauth_token: null, refresh_token: null } 
          : c
      )
    )
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-20">
        <div className="px-6 py-4">
          <h1 className="text-xl font-semibold text-foreground">Connectors</h1>
          <p className="text-sm text-muted-foreground">
            Connect your apps to start recording AI agent actions
          </p>
        </div>
      </header>

      {/* Content */}
      <div className="p-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {connectorConfigs.map((config, index) => {
            const connector = getConnectorStatus(config.app)
            const isConnected = !!connector
            const isConnecting = connectingApp === config.app
            const Icon = config.icon

            return (
              <motion.div
                key={config.app}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="rounded-lg border border-border bg-card p-5"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-lg",
                    config.bgColor
                  )}>
                    <Icon className={cn("h-6 w-6", config.color)} />
                  </div>
                  
                  {isConnected ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                      <CheckCircle2 className="h-3 w-3" />
                      Connected
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-full bg-muted text-muted-foreground">
                      <XCircle className="h-3 w-3" />
                      Not connected
                    </span>
                  )}
                </div>

                <h3 className="text-lg font-medium text-foreground mb-1">
                  {config.name}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {config.description}
                </p>

                {isConnected && connector && (
                  <p className="text-xs text-muted-foreground mb-4">
                    Connected {formatDate(connector.connected_at || connector.created_at)}
                  </p>
                )}

                {isConnected ? (
                  <button
                    onClick={() => handleDisconnect(connector!)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground bg-secondary rounded-md hover:bg-secondary/80 hover:text-foreground transition-colors"
                  >
                    Disconnect
                  </button>
                ) : (
                  <button
                    onClick={() => handleConnect(config.app)}
                    disabled={isConnecting}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {isConnecting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <Plug className="h-4 w-4" />
                        Connect
                      </>
                    )}
                  </button>
                )}
              </motion.div>
            )
          })}
        </div>

        {/* Info section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-8 rounded-lg border border-border bg-card/50 p-6"
        >
          <h3 className="text-sm font-medium text-foreground mb-2">
            How connectors work
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Connectors use OAuth to securely access your accounts. Trailback only
            reads action metadata and content for diff comparison — we never modify
            your data except when you explicitly request a rollback.
          </p>
          <a
            href="#"
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            Learn more about security
            <ExternalLink className="h-3 w-3" />
          </a>
        </motion.div>
      </div>
    </div>
  )
}
