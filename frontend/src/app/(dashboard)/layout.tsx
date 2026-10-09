import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { auth, sessionWorkspaceId } from '@/auth'
import { redirect } from 'next/navigation'
import { QueryProvider } from '@/lib/query-provider'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = process.env.GOOGLE_WORKSPACES_ENABLED === 'true' ? await auth() : null
  const workspace = sessionWorkspaceId(session)
  if (process.env.GOOGLE_WORKSPACES_ENABLED === 'true' && !workspace) redirect('/signin')
  return (
    <QueryProvider key={workspace || 'legacy'}>
    <div
      className="dashboard-shell"
      style={{
        display: 'flex',
        height: '100vh',
        overflow: 'hidden',
        background: 'var(--bg-canvas)',
      }}
    >
      <Sidebar displayName={session?.user?.name || undefined} email={session?.user?.email || undefined} />
      <div className="dashboard-content" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minWidth: 0 }}>
        <TopBar displayName={session?.user?.name || undefined} />
        <main
          className="dashboard-main"
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: '36px 36px',
          }}
        >
          <div style={{ maxWidth: '1500px', margin: '0 auto' }}>
            {children}
          </div>
        </main>
      </div>
    </div>
    </QueryProvider>
  )
}
