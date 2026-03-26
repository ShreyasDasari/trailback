import Link from "next/link"
import { TrailbackLogoMark } from "@/components/trailback-logo"

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <TrailbackLogoMark size={80} />
      <h1 className="mt-8 text-4xl font-bold text-foreground">404</h1>
      <p className="mt-2 text-muted-foreground text-center">
        Page not found. The page you&apos;re looking for doesn&apos;t exist.
      </p>
      <Link
        href="/"
        className="mt-8 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
      >
        Go back home
      </Link>
    </div>
  )
}
