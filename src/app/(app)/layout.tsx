import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import SessionProvider from '@/components/layout/SessionProvider'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  return (
    <SessionProvider session={session}>
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <main className="lg:ml-60 flex-1 min-h-screen pt-14 lg:pt-0">
          {children}
        </main>
      </div>
    </SessionProvider>
  )
}
