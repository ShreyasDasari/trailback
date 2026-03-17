import { Sidebar } from "@/components/sidebar"

export const dynamic = 'force-dynamic'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="md:pl-56 pb-20 md:pb-0">
        {children}
      </main>
    </div>
  )
}
