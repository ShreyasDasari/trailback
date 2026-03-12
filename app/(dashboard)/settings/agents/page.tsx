"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Bot, 
  Plus, 
  Copy, 
  Check, 
  X,
  AlertTriangle,
  Activity,
  Clock,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { cn, formatRelativeTime } from "@/lib/utils"
import type { Agent, AgentType } from "@/lib/types"

const agentTypeColors: Record<AgentType, string> = {
  claude: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  gpt: "bg-green-500/10 text-green-400 border-green-500/20",
  gemini: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  copilot: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  custom: "bg-gray-500/10 text-gray-400 border-gray-500/20",
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [newAgentName, setNewAgentName] = useState("")
  const [newAgentType, setNewAgentType] = useState<AgentType>("claude")
  const [createdAgent, setCreatedAgent] = useState<{ id: string; key: string } | null>(null)
  const [copiedKey, setCopiedKey] = useState(false)
  const [creating, setCreating] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    async function fetchAgents() {
      const { data } = await supabase
        .from("agents")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })

      setAgents(data || [])
      setLoading(false)
    }

    fetchAgents()
  }, [supabase])

  const handleCreateAgent = async () => {
    if (!newAgentName.trim()) return

    setCreating(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Generate a random agent key
    const agentKey = `tb_${crypto.randomUUID().replace(/-/g, "").slice(0, 32)}`

    const { data, error } = await supabase
      .from("agents")
      .insert({
        user_id: user.id,
        name: newAgentName.trim(),
        type: newAgentType,
        identifier: agentKey,
        is_active: true,
      })
      .select()
      .single()

    if (data && !error) {
      setAgents((prev) => [data, ...prev])
      setCreatedAgent({ id: data.id, key: agentKey })
    }
    setCreating(false)
  }

  const handleCopyKey = async () => {
    if (!createdAgent) return
    await navigator.clipboard.writeText(createdAgent.key)
    setCopiedKey(true)
    setTimeout(() => setCopiedKey(false), 2000)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setNewAgentName("")
    setNewAgentType("claude")
    setCreatedAgent(null)
    setCopiedKey(false)
  }

  const handleDeleteAgent = async (agentId: string) => {
    await supabase
      .from("agents")
      .update({ is_active: false })
      .eq("id", agentId)

    setAgents((prev) => prev.filter((a) => a.id !== agentId))
  }

  // Calculate trust score based on agent type (demo purposes)
  const getTrustScore = (agent: Agent): number => {
    const baseScores: Record<AgentType, number> = {
      claude: 85,
      gpt: 80,
      gemini: 75,
      copilot: 70,
      custom: 50,
    }
    return baseScores[agent.type] || 50
  }

  const getTrustColor = (score: number): string => {
    if (score >= 80) return "bg-green-400"
    if (score >= 60) return "bg-amber-400"
    return "bg-red-400"
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-20">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Agents</h1>
            <p className="text-sm text-muted-foreground">
              Register and manage your AI agents
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-md hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Register Agent
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="p-6">
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 skeleton rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 skeleton rounded" />
                    <div className="h-3 w-48 skeleton rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : agents.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
              <Bot className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">
              No agents registered
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-6">
              Register your AI agents to start tracking their actions. Each agent
              gets a unique key for identification.
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-md hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Register your first agent
            </button>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {agents.map((agent, index) => {
              const trustScore = getTrustScore(agent)
              
              return (
                <motion.div
                  key={agent.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="rounded-lg border border-border bg-card p-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                      <Bot className="h-5 w-5 text-muted-foreground" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-foreground">
                          {agent.name}
                        </h3>
                        <span className={cn(
                          "px-2 py-0.5 text-xs font-mono rounded border",
                          agentTypeColors[agent.type]
                        )}>
                          {agent.type}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="font-mono">
                          {agent.identifier?.slice(0, 16)}...
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatRelativeTime(agent.created_at)}
                        </span>
                      </div>
                    </div>

                    {/* Trust Score */}
                    <div className="hidden sm:flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground mb-1">
                          Trust Score
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${trustScore}%` }}
                              transition={{ duration: 0.5, delay: index * 0.1 }}
                              className={cn("h-full rounded-full", getTrustColor(trustScore))}
                            />
                          </div>
                          <span className="text-sm font-mono text-foreground">
                            {trustScore}%
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteAgent(agent.id)}
                      className="flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      {/* Register Agent Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={handleCloseModal}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-lg border border-border bg-card shadow-xl"
            >
              {!createdAgent ? (
                <>
                  <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                    <h2 className="text-lg font-semibold text-foreground">
                      Register New Agent
                    </h2>
                    <button
                      onClick={handleCloseModal}
                      className="flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="p-6 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Agent Name
                      </label>
                      <input
                        type="text"
                        value={newAgentName}
                        onChange={(e) => setNewAgentName(e.target.value)}
                        placeholder="e.g., My Claude Assistant"
                        className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent placeholder:text-muted-foreground"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Agent Type
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {(["claude", "gpt", "gemini", "copilot", "custom"] as AgentType[]).map((type) => (
                          <button
                            key={type}
                            onClick={() => setNewAgentType(type)}
                            className={cn(
                              "px-3 py-2 text-sm font-medium rounded-md border transition-colors capitalize",
                              newAgentType === type
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
                            )}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 px-6 py-4 border-t border-border">
                    <button
                      onClick={handleCloseModal}
                      className="flex-1 px-4 py-2 text-sm font-medium text-foreground bg-secondary rounded-md hover:bg-secondary/80 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateAgent}
                      disabled={!newAgentName.trim() || creating}
                      className="flex-1 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      {creating ? "Creating..." : "Create Agent"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                    <h2 className="text-lg font-semibold text-foreground">
                      Agent Created
                    </h2>
                    <button
                      onClick={handleCloseModal}
                      className="flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="p-6 space-y-4">
                    <div className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-4">
                      <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <h3 className="text-sm font-medium text-amber-400 mb-1">
                          Save this key now
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          This API key will only be shown once. Copy it and store it securely.
                        </p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Agent Key
                      </label>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 px-3 py-2 text-sm font-mono bg-background border border-border rounded-md overflow-x-auto">
                          {createdAgent.key}
                        </code>
                        <button
                          onClick={handleCopyKey}
                          className="flex items-center justify-center h-9 w-9 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                        >
                          {copiedKey ? (
                            <Check className="h-4 w-4 text-green-400" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="px-6 py-4 border-t border-border">
                    <button
                      onClick={handleCloseModal}
                      className="w-full px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-md hover:bg-primary/90 transition-colors"
                    >
                      Done
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
