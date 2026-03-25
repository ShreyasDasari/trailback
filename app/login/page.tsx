"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
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
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0c]">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <TrailbackLogoMark size={48} />
          <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
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
    { icon: Eye, title: "Full Visibility", description: "See every action in real-time" },
    { icon: Shield, title: "Risk Scoring", description: "Automatic threat detection" },
    { icon: RotateCcw, title: "One-Click Undo", description: "Reverse any action instantly" },
  ]

  return (
    <div className="min-h-screen flex bg-[#0a0a0c]">
      {/* Left side - Features */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 border-r border-[#1a1a1f]">
        <div>
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 mb-4">
            <TrailbackLogoMark size={40} />
            <span className="font-mono text-xl font-semibold tracking-tight text-white">
              Trailback
            </span>
          </Link>
        </div>

        <div className="space-y-8">
          {/* Hero text */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <h1 className="text-4xl font-bold text-white leading-tight">
              Every agent action,
            </h1>
            <h1 className="text-4xl font-bold text-emerald-400 leading-tight">
              recorded and reversible.
            </h1>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-[#7a7a85] text-lg max-w-md"
          >
            Full visibility and recoverability over every action your AI agents take across Gmail, Docs, Slack, and more.
          </motion.p>
        </div>

        {/* Features grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex gap-8"
        >
          {features.map((feature, index) => (
            <div key={index} className="flex flex-col items-start gap-2">
              <div className="p-2.5 rounded-lg bg-[#1a1a1f] border border-[#2a2a30]">
                <feature.icon className="w-5 h-5 text-[#7a7a85]" />
              </div>
              <h3 className="font-medium text-white text-sm">{feature.title}</h3>
              <p className="text-xs text-[#7a7a85]">{feature.description}</p>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Right side - Login form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <TrailbackLogoMark size={40} />
            <span className="font-mono text-xl font-semibold tracking-tight text-white">
              Trailback
            </span>
          </div>

          {/* Welcome text */}
          <div className="text-center mb-8">
            <h2 className="text-2xl font-semibold text-white mb-2">Welcome back</h2>
            <p className="text-[#7a7a85] text-sm">Sign in to your account to continue</p>
          </div>

          {/* Google sign-in button */}
          <motion.button
            onClick={handleGoogleSignIn}
            disabled={loading}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className="w-full flex items-center justify-center gap-3 px-4 py-3.5 text-sm font-medium
                       text-[#0a0a0c] bg-white rounded-lg hover:bg-gray-100
                       transition-all duration-200 disabled:opacity-50 shadow-lg"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
            {loading ? "Signing in..." : "Continue with Google"}
          </motion.button>

          {/* Terms */}
          <p className="text-center text-xs text-[#7a7a85] mt-6">
            By continuing, you agree to our{" "}
            <Link href="/terms" className="text-emerald-400 hover:underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-emerald-400 hover:underline">
              Privacy Policy
            </Link>
          </p>

          {/* Security note */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-8 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10"
          >
            <div className="flex items-start gap-3">
              <Sparkles className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-[#7a7a85]">
                <span className="font-medium text-white">Secure access:</span> Your data is protected with enterprise-grade security and row-level access controls.
              </p>
            </div>
          </motion.div>

          {/* Back to home */}
          <div className="mt-8 text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm text-[#7a7a85] hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to home
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
