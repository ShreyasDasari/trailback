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
  Clock,
  Sparkles,
  Shield,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { cn, formatRelativeTime } from "@/lib/utils"
import type { Agent, AgentType } from "@/lib/types"

const agentTypeColors: Record<AgentType, { bg: string; text: string; border: string }> = {
  claude: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" },
  gpt: { bg: "bg-green-500/10", text: "text-green-400", border: "border-green-500/20" },
  gemini: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20" },
  copilot: { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/20" },
  custom: { bg: "bg-gray-500/10", text: "text-gray-400", border: "border-gray-500/20" },
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
              <Bot className="h-5 w-5 text-primary" />
            </motion.div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Agents</h1>
              <p className="text-sm text-muted-foreground">
                Register and manage your AI agents
              </p>
            </div>
          </div>
          <motion.button
            onClick={() => setShowModal(true)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-primary-foreground bg-primary rounded-xl hover:bg-primary/90 transition-all duration-200 shadow-lg shadow-primary/20"
          >
            <Plus className="h-4 w-4" />
            Register Agent
          </motion.button>
        </div>
      </motion.header>

      {/* Content */}
      <div className="p-6">
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <motion.div 
                key={i} 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="rounded-xl border border-border bg-card p-5"
              >
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 skeleton rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <div className="h-5 w-36 skeleton rounded-md" />
                    <div className="h-4 w-52 skeleton rounded-md" />
                  </div>
                  <div className="h-8 w-24 skeleton rounded-lg" />
                </div>
              </motion.div>
            ))}
          </div>
        ) : agents.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", bounce: 0.3 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <motion.div 
              className="relative mb-6"
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity }}
            >
              <div className="absolute inset-0 blur-2xl bg-primary/20 rounded-full" />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-card border border-border">
                <Bot className="h-10 w-10 text-muted-foreground" />
              </div>
            </motion.div>
            <h3 className="text-xl font-semibold text-foreground mb-3">
              No agents registered
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-6">
              Register your AI agents to start tracking their actions. Each agent
              gets a unique key for identification.
            </p>
            <motion.button
              onClick={() => setShowModal(true)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-primary-foreground bg-primary rounded-xl hover:bg-primary/90 transition-all duration-200"
            >
              <Sparkles className="h-4 w-4" />
              Register your first agent
            </motion.button>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {agents.map((agent, index) => {
              const trustScore = getTrustScore(agent)
              const colors = agentTypeColors[agent.type]
              
              return (
                <motion.div
                  key={agent.id}
                  initial={{ opacity: 0, y: 20, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ y: -2, transition: { duration: 0.2 } }}
                  className="rounded-xl border border-border bg-card p-5 hover:border-primary/20 transition-all duration-300"
                >
                  <div className="flex items-center gap-4">
                    <motion.div 
                      className={cn(
                        "flex h-12 w-12 items-center justify-center rounded-xl border",
                        colors.bg, colors.border
                      )}
                      whileHover={{ rotate: [0, -5, 5, 0] }}
                      transition={{ duration: 0.3 }}
                    >
                      <Bot className={cn("h-6 w-6", colors.text)} />
                    </motion.div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <h3 className="font-semibold text-foreground">
                          {agent.name}
                        </h3>
                        <span className={cn(
                          "px-2 py-0.5 text-xs font-mono rounded-lg border capitalize",
                          colors.bg, colors.text, colors.border
                        )}>
                          {agent.type}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="font-mono px-1.5 py-0.5 rounded bg-muted/50">
                          {agent.identifier?.slice(0, 16)}...
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatRelativeTime(agent.created_at)}
                        </span>
                      </div>
                    </div>

                    {/* Trust Score */}
                    <div className="hidden sm:flex items-center gap-4">
                      <div className="text-right">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
                          <Shield className="h-3 w-3" />
                          Trust Score
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${trustScore}%` }}
                              transition={{ duration: 0.8, delay: index * 0.1, ease: "easeOut" }}
                              className={cn("h-full rounded-full", getTrustColor(trustScore))}
                            />
                          </div>
                          <span className="text-sm font-mono font-medium text-foreground">
                            {trustScore}%
                          </span>
                        </div>
                      </div>
                    </div>

                    <motion.button
                      onClick={() => handleDeleteAgent(agent.id)}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className="flex items-center justify-center h-9 w-9 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all duration-200"
                    >
                      <X className="h-4 w-4" />
                    </motion.button>
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
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl"
            >
              {!createdAgent ? (
                <>
                  <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
                        <Bot className="h-5 w-5 text-primary" />
                      </div>
                      <h2 className="text-lg font-semibold text-foreground">
                        Register New Agent
                      </h2>
                    </div>
                    <motion.button
                      onClick={handleCloseModal}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className="flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </motion.button>
                  </div>

                  <div className="p-6 space-y-5">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Agent Name
                      </label>
                      <input
                        type="text"
                        value={newAgentName}
                        onChange={(e) => setNewAgentName(e.target.value)}
                        placeholder="e.g., My Claude Assistant"
                        className="w-full px-4 py-2.5 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent placeholder:text-muted-foreground transition-all duration-200"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Agent Type
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {(["claude", "gpt", "gemini", "copilot", "custom"] as AgentType[]).map((type) => (
                          <motion.button
                            key={type}
                            onClick={() => setNewAgentType(type)}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className={cn(
                              "px-3 py-2.5 text-sm font-medium rounded-xl border transition-all duration-200 capitalize",
                              newAgentType === type
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
                            )}
                          >
                            {type}
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 px-6 py-4 border-t border-border">
                    <motion.button
                      onClick={handleCloseModal}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="flex-1 px-4 py-2.5 text-sm font-medium text-foreground bg-secondary rounded-xl hover:bg-secondary/80 transition-colors"
                    >
                      Cancel
                    </motion.button>
                    <motion.button
                      onClick={handleCreateAgent}
                      disabled={!newAgentName.trim() || creating}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="flex-1 px-4 py-2.5 text-sm font-medium text-primary-foreground bg-primary rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      {creating ? "Creating..." : "Create Agent"}
                    </motion.button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                    <div className="flex items-center gap-3">
                      <motion.div 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", bounce: 0.5 }}
                        className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500/10 border border-green-500/20"
                      >
                        <Check className="h-5 w-5 text-green-400" />
                      </motion.div>
                      <h2 className="text-lg font-semibold text-foreground">
                        Agent Created
                      </h2>
                    </div>
                    <motion.button
                      onClick={handleCloseModal}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className="flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </motion.button>
                  </div>

                  <div className="p-6 space-y-5">
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4"
                    >
                      <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <h3 className="text-sm font-medium text-amber-400 mb-1">
                          Save this key now
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          This API key will only be shown once. Copy it and store it securely.
                        </p>
                      </div>
                    </motion.div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Agent Key
                      </label>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 px-4 py-2.5 text-sm font-mono bg-background border border-border rounded-xl overflow-x-auto">
                          {createdAgent.key}
                        </code>
                        <motion.button
                          onClick={handleCopyKey}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="flex items-center justify-center h-10 w-10 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                        >
                          {copiedKey ? (
                            <Check className="h-4 w-4 text-green-400" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </motion.button>
                      </div>
                    </div>
                  </div>

                  <div className="px-6 py-4 border-t border-border">
                    <motion.button
                      onClick={handleCloseModal}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full px-4 py-2.5 text-sm font-medium text-primary-foreground bg-primary rounded-xl hover:bg-primary/90 transition-colors"
                    >
                      Done
                    </motion.button>
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
