import { Sidebar } from "@/components/sidebar"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="md:pl-56 pb-20 md:pb-0">
        {children}
      </main>
    </div>
  )
}
