"use client"

import { useEffect, useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { createClient } from "@/lib/supabase/client"
import { EventCard, EventCardSkeleton } from "@/components/event-card"
import { FilterBar } from "@/components/filter-bar"
import type { Event, TimelineFilters, Agent } from "@/lib/types"
import { RefreshCw, Activity, Zap } from "lucide-react"
import { TrailbackLogoMark } from "@/components/trailback-logo"

export default function TimelinePage() {
  const [events, setEvents] = useState<Event[]>([])
  const [agents, setAgents] = useState<Record<string, Agent>>({})
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [filters, setFilters] = useState<TimelineFilters>({
    app: "all",
    riskLevel: "all",
    dateRange: { from: null, to: null },
  })

  const supabase = createClient()

  const fetchEvents = useCallback(async () => {
    setFetchError(null)
    let query = supabase
      .from("events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50)

    if (filters.app !== "all") {
      query = query.eq("app", filters.app)
    }

    if (filters.riskLevel !== "all") {
      query = query.eq("risk_level", filters.riskLevel)
    }

    const { data, error } = await query

    if (error) {
      console.error("Error fetching events:", error)
      setFetchError("Failed to load events. Check your connection and try again.")
      setLoading(false)
      setIsRefreshing(false)
      return
    }

    setEvents(data || [])
    setLoading(false)
    setIsRefreshing(false)
  }, [supabase, filters])

  const fetchAgents = useCallback(async () => {
    const { data } = await supabase.from("agents").select("*")
    if (data) {
      const agentMap: Record<string, Agent> = {}
      data.forEach((agent) => {
        agentMap[agent.id] = agent
      })
      setAgents(agentMap)
    }
  }, [supabase])

  useEffect(() => {
    fetchEvents()
    fetchAgents()
  }, [fetchEvents, fetchAgents])

  // Realtime subscription — filtered per user to respect RLS
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel>

    async function setupRealtime() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return // Never subscribe without a known user_id

      channel = supabase
        .channel(`events-realtime-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "events",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const newEvent = payload.new as Event
            const matchesApp = filters.app === "all" || newEvent.app === filters.app
            const matchesRisk = filters.riskLevel === "all" || newEvent.risk_level === filters.riskLevel
            if (matchesApp && matchesRisk) {
              setEvents((prev) => [newEvent, ...prev])
            }
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "events",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const updatedEvent = payload.new as Event
            setEvents((prev) =>
              prev.map((e) => (e.id === updatedEvent.id ? updatedEvent : e))
            )
          }
        )
        .subscribe()
    }

    setupRealtime()

    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [supabase, filters])

  const handleRefresh = () => {
    setIsRefreshing(true)
    fetchEvents()
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
              <Activity className="h-5 w-5 text-primary" />
            </motion.div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Timeline</h1>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
                Real-time feed of AI agent actions
              </p>
            </div>
          </div>
          <motion.button
            onClick={handleRefresh}
            disabled={isRefreshing}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground bg-secondary/50 hover:bg-secondary border border-border rounded-lg transition-all duration-200 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </motion.button>
        </div>
      </motion.header>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <FilterBar filters={filters} onFiltersChange={setFilters} />
      </motion.div>

      {/* Inline error banner */}
      {fetchError && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-6 mt-4 flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400"
        >
          <span className="shrink-0">⚠</span>
          <span className="flex-1">{fetchError}</span>
          <button
            onClick={handleRefresh}
            className="shrink-0 underline hover:no-underline"
          >
            Retry
          </button>
        </motion.div>
      )}

      {/* Event Feed */}
      <div className="p-6 space-y-3">
        <AnimatePresence mode="popLayout">
          {loading ? (
            // Skeleton loaders with stagger animation
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {[...Array(5)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <EventCardSkeleton />
                </motion.div>
              ))}
            </motion.div>
          ) : events.length === 0 && (filters.app !== "all" || filters.riskLevel !== "all") ? (
            // Filtered empty state
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-20 text-center"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted border border-border mb-5">
                <RefreshCw className="h-7 w-7 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                No actions match your filters.
              </h3>
              <p className="text-sm text-muted-foreground mb-5">
                Try adjusting or clearing your filters to see more results.
              </p>
              <button
                onClick={() => setFilters({ app: "all", riskLevel: "all", dateRange: { from: null, to: null } })}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-foreground bg-secondary rounded-lg hover:bg-secondary/80 transition-colors border border-border"
              >
                Clear filters
              </button>
            </motion.div>
          ) : events.length === 0 ? (
            // True empty state — no events at all
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", bounce: 0.3 }}
              className="flex flex-col items-center justify-center py-20 text-center"
            >
              <motion.div 
                className="mb-6 relative"
                animate={{ 
                  rotate: [0, 5, -5, 0],
                }}
                transition={{ 
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                <div className="absolute inset-0 blur-2xl bg-primary/20 rounded-full" />
                <TrailbackLogoMark size={80} />
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <h3 className="text-xl font-semibold text-foreground mb-3">
                  No agent activity yet.
                </h3>
                <p className="text-sm text-muted-foreground max-w-sm mb-6">
                  Install the extension to start recording.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="flex items-center gap-3"
              >
                <a
                  href="/settings/connectors"
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-all duration-200"
                >
                  <Zap className="h-4 w-4" />
                  Connect Apps
                </a>
              </motion.div>
            </motion.div>
          ) : (
            // Event list with stagger
            events.map((event, index) => (
              <EventCard
                key={event.id}
                event={event}
                index={index}
                agentName={event.agent_id ? agents[event.agent_id]?.name : undefined}
              />
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Stats footer */}
      {events.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="fixed bottom-0 md:bottom-auto md:top-auto left-0 right-0 md:left-60 p-4 flex justify-center pointer-events-none"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-mono text-muted-foreground bg-card/80 backdrop-blur-sm border border-border rounded-full pointer-events-auto">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
            {events.length} events loaded
          </div>
        </motion.div>
      )}
    </div>
  )
}
