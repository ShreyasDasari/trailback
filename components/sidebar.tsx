"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Clock, 
  LogOut,
  Plug,
  Bot,
  ChevronRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { TrailbackLogoMark } from "@/components/trailback-logo"

const navItems = [
  { href: "/timeline", label: "Timeline", icon: Clock, description: "Real-time event feed" },
  { href: "/settings/connectors", label: "Connectors", icon: Plug, description: "Manage app integrations" },
  { href: "/settings/agents", label: "Agents", icon: Bot, description: "Configure AI agents" },
]

export function Sidebar() {
  const pathname = usePathname()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut({ scope: 'global' })
    window.location.href = "/login"
  }

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 h-screen w-60 flex-col border-r border-border bg-card/50 backdrop-blur-xl z-40">
        {/* Logo */}
        <Link 
          href="/" 
          className="flex items-center gap-3 px-5 py-5 border-b border-border group"
        >
          <motion.div
            whileHover={{ rotate: [0, -10, 10, 0] }}
            transition={{ duration: 0.4 }}
          >
            <TrailbackLogoMark size={36} />
          </motion.div>
          <span className="font-mono text-lg tracking-tight">
            <span className="text-foreground">trail</span>
            <span className="text-primary">back</span>
          </span>
        </Link>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item, index) => {
            const isActive = pathname.startsWith(item.href)
            return (
              <motion.div
                key={item.href}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Link
                  href={item.href}
                  className={cn(
                    "relative flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 group",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {/* Active background indicator */}
                  <AnimatePresence>
                    {isActive && (
                      <motion.div
                        layoutId="sidebar-active"
                        className="absolute inset-0 bg-primary/10 rounded-lg border border-primary/20"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                      />
                    )}
                  </AnimatePresence>

                  {/* Hover background */}
                  {!isActive && (
                    <div className="absolute inset-0 bg-secondary/50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                  )}
                  
                  <motion.div
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    className="relative z-10"
                  >
                    <item.icon className={cn(
                      "h-4 w-4 transition-colors duration-200",
                      isActive ? "text-primary" : "group-hover:text-foreground"
                    )} />
                  </motion.div>
                  
                  <span className="relative z-10 flex-1">{item.label}</span>
                  
                  {/* Arrow indicator */}
                  <motion.div
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: isActive ? 1 : 0, x: isActive ? 0 : -5 }}
                    className="relative z-10"
                  >
                    <ChevronRight className="h-3.5 w-3.5 text-primary" />
                  </motion.div>
                </Link>
              </motion.div>
            )
          })}
        </nav>

        {/* Sign out */}
        <div className="px-3 py-4 border-t border-border">
          <motion.button
            onClick={handleSignOut}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex w-full items-center gap-3 px-3 py-2.5 text-sm font-medium text-muted-foreground rounded-lg hover:text-foreground hover:bg-secondary/50 transition-all duration-200"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </motion.button>
        </div>

        {/* Version indicator */}
        <div className="px-5 py-3 border-t border-border">
          <p className="text-[10px] text-muted-foreground/50 font-mono">
            v1.0.0 beta
          </p>
        </div>
      </aside>

      {/* Mobile Bottom Tab Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-border bg-card/95 backdrop-blur-xl py-2 px-4 safe-area-inset-bottom">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex flex-col items-center gap-1 px-4 py-2 text-xs font-medium transition-all duration-200",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="mobile-nav-active"
                  className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                />
              )}
              <motion.div
                whileTap={{ scale: 0.9 }}
              >
                <item.icon className="h-5 w-5" />
              </motion.div>
              <span>{item.label}</span>
            </Link>
          )
        })}
        <button
          onClick={handleSignOut}
          className="flex flex-col items-center gap-1 px-4 py-2 text-xs font-medium text-muted-foreground"
        >
          <motion.div whileTap={{ scale: 0.9 }}>
            <LogOut className="h-5 w-5" />
          </motion.div>
          <span>Sign Out</span>
        </button>
      </nav>
    </>
  )
}
