"use client"

import { useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import { AlertCircle, ArrowLeft, RefreshCw, HelpCircle } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { TrailbackLogoMark } from "@/components/trailback-logo"
import { Suspense } from "react"

function AuthErrorContent() {
  const searchParams = useSearchParams()
  const errorCode = searchParams.get("error")
  const errorDescription = searchParams.get("error_description")
  
  const supabase = createClient()

  const handleBackToLogin = async () => {
    await supabase.auth.signOut({ scope: 'global' })
    window.location.href = "/login"
  }

  const handleRetry = async () => {
    await supabase.auth.signOut({ scope: 'global' })
    // Redirect to login to try again
    window.location.href = "/login"
  }

  const getErrorMessage = () => {
    if (errorDescription) {
      return errorDescription
    }
    switch (errorCode) {
      case "access_denied":
        return "You denied access to your account. Please try again and grant the required permissions."
      case "invalid_request":
        return "The authentication request was invalid. Please try signing in again."
      case "server_error":
        return "Our authentication server encountered an error. Please try again in a moment."
      default:
        return "There was a problem signing you in. This could be due to an expired link or a configuration issue."
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative">
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 via-transparent to-transparent pointer-events-none" />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full text-center relative z-10"
      >
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex justify-center mb-8"
        >
          <TrailbackLogoMark size={40} />
        </motion.div>

        {/* Error icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", bounce: 0.5, delay: 0.2 }}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20 mx-auto mb-6"
        >
          <AlertCircle className="h-8 w-8 text-red-400" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h1 className="text-2xl font-bold text-foreground mb-3">
            Authentication Error
          </h1>
          <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
            {getErrorMessage()}
          </p>
        </motion.div>

        {/* Action buttons */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-3"
        >
          <motion.button
            onClick={handleRetry}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium text-primary-foreground bg-primary rounded-xl hover:bg-primary/90 transition-all duration-200"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </motion.button>
          
          <motion.button
            onClick={handleBackToLogin}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium text-foreground bg-secondary border border-border rounded-xl hover:bg-secondary/80 transition-all duration-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Login
          </motion.button>
        </motion.div>

        {/* Help section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-10 p-4 rounded-xl bg-card/50 border border-border"
        >
          <div className="flex items-start gap-3 text-left">
            <HelpCircle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Still having trouble?</span> Make sure you&apos;re granting all requested permissions during the Google sign-in process. Trailback needs access to Gmail and Google Docs to monitor AI agent actions.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Error code display */}
        {errorCode && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-6 text-xs font-mono text-muted-foreground/50"
          >
            Error code: {errorCode}
          </motion.p>
        )}
      </motion.div>
    </div>
  )
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <TrailbackLogoMark size={40} />
      </div>
    }>
      <AuthErrorContent />
    </Suspense>
  )
}
