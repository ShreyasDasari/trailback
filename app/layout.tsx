import type { Metadata } from "next"
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google"
import "./globals.css"

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
})

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  title: "Trailback - AI Agent Oversight Dashboard",
  description: "Every agent action, recorded and reversible. Full visibility and recoverability over every action an AI agent takes.",
  keywords: ["AI", "agent", "oversight", "rollback", "audit", "security"],
}



export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${ibmPlexSans.variable} ${ibmPlexMono.variable} font-sans min-h-screen bg-background`}
      >
        {children}
      </body>
    </html>
  )
}
