"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Shield, RotateCcw, Eye, Loader2, ArrowLeft, Sparkles } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { TrailbackLogoMark } from "@/components/trailback-logo"

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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <TrailbackLogoMark size={48} />
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
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

  const features = [
    { icon: Eye, label: "Full Visibility", desc: "See every action in real-time" },
    { icon: Shield, label: "Risk Scoring", desc: "Automatic threat detection" },
    { icon: RotateCcw, label: "One-Click Undo", desc: "Reverse any action instantly" },
  ]

  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:flex-1 flex-col justify-between p-12 bg-card/50 border-r border-border relative overflow-hidden">
        {/* Background gradient effects */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-3 mb-16 w-fit group">
            <motion.div
              whileHover={{ rotate: [0, -10, 10, 0] }}
              transition={{ duration: 0.4 }}
            >
              <TrailbackLogoMark size={48} />
            </motion.div>
            <span className="font-mono text-xl tracking-tight">
              <span className="text-foreground">trail</span>
              <span className="text-primary">back</span>
            </span>
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.6 }}
          >
            <h1 className="text-4xl lg:text-5xl font-bold text-foreground leading-tight mb-6">
              Every agent action,
              <br />
              <span className="text-gradient">recorded and reversible.</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-md">
              Full visibility and recoverability over every action your AI agents 
              take across Gmail, Docs, Slack, and more.
            </p>
          </motion.div>
        </div>

        <div className="grid grid-cols-3 gap-6 relative z-10">
          {features.map((feature, index) => (
            <motion.div
              key={feature.label}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + index * 0.1, duration: 0.5 }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="space-y-3 p-4 rounded-xl bg-card/50 border border-border hover:border-primary/20 transition-all duration-300"
            >
              <motion.div 
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 border border-primary/20"
                whileHover={{ rotate: [0, -5, 5, 0] }}
                transition={{ duration: 0.3 }}
              >
                <feature.icon className="h-5 w-5 text-primary" />
              </motion.div>
              <h3 className="font-semibold text-foreground">{feature.label}</h3>
              <p className="text-sm text-muted-foreground">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Right side - Login form */}
      <div className="flex-1 flex items-center justify-center p-8 relative">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-sm relative z-10"
        >
          {/* Mobile logo */}
          <Link href="/" className="lg:hidden flex items-center justify-center gap-3 mb-10">
            <TrailbackLogoMark size={40} />
            <span className="font-mono text-xl tracking-tight">
              <span className="text-foreground">trail</span>
              <span className="text-primary">back</span>
            </span>
          </Link>

          <div className="text-center mb-8">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h2 className="text-2xl font-bold text-foreground mb-2">
                Welcome back
              </h2>
              <p className="text-sm text-muted-foreground">
                Sign in to your account to continue
              </p>
            </motion.div>
          </div>

          <motion.button
            onClick={handleGoogleSignIn}
            disabled={loading}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            className="w-full flex items-center justify-center gap-3 px-4 py-3.5 text-sm font-medium text-foreground bg-card border border-border rounded-xl hover:bg-secondary hover:border-primary/20 transition-all duration-300 disabled:opacity-50 shadow-lg shadow-black/10"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
            )}
            {loading ? "Signing in..." : "Continue with Google"}
          </motion.button>

          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-6 text-center text-xs text-muted-foreground"
          >
            By continuing, you agree to our{" "}
            <a href="#" className="text-primary hover:underline">
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="#" className="text-primary hover:underline">
              Privacy Policy
            </a>
          </motion.p>

          {/* Security note */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-8 p-4 rounded-xl bg-primary/5 border border-primary/10"
          >
            <div className="flex items-start gap-3">
              <Sparkles className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Secure access:</span> Your data is protected with enterprise-grade security and row-level access controls.
              </p>
            </div>
          </motion.div>

          {/* Back to landing */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            <Link 
              href="/" 
              className="mt-8 flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
            >
              <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
              Back to home
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
