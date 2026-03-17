"use client"

import { useEffect, useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { createClient } from "@/lib/supabase/client"
import { EventCard, EventCardSkeleton } from "@/components/event-card"
import { FilterBar } from "@/components/filter-bar"
import type { Event, TimelineFilters, Agent } from "@/lib/types"
import { Layers, RefreshCw } from "lucide-react"

export default function TimelinePage() {
  const [events, setEvents] = useState<Event[]>([])
  const [agents, setAgents] = useState<Record<string, Agent>>({})
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<TimelineFilters>({
    app: "all",
    riskLevel: "all",
    dateRange: { from: null, to: null },
  })

  const supabase = createClient()

  const fetchEvents = useCallback(async () => {
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
      return
    }

    setEvents(data || [])
    setLoading(false)
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

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("events-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "events",
        },
        (payload) => {
          const newEvent = payload.new as Event
          // Only add if it matches current filters
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
        },
        (payload) => {
          const updatedEvent = payload.new as Event
          setEvents((prev) =>
            prev.map((e) => (e.id === updatedEvent.id ? updatedEvent : e))
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, filters])

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-20">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Timeline</h1>
            <p className="text-sm text-muted-foreground">
              Real-time feed of AI agent actions
            </p>
          </div>
          <button
            onClick={() => {
              setLoading(true)
              fetchEvents()
            }}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground bg-secondary/50 hover:bg-secondary rounded-md transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </header>

      {/* Filters */}
      <FilterBar filters={filters} onFiltersChange={setFilters} />

      {/* Event Feed */}
      <div className="p-6 space-y-3">
        <AnimatePresence mode="popLayout">
          {loading ? (
            // Skeleton loaders
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {[...Array(5)].map((_, i) => (
                <EventCardSkeleton key={i} />
              ))}
            </motion.div>
          ) : events.length === 0 ? (
            // Empty state
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-20 text-center"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                <Layers className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">
                No events recorded yet
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Install the Trailback browser extension and connect your apps to
                start recording AI agent actions.
              </p>
            </motion.div>
          ) : (
            // Event list
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
    </div>
  )
}
