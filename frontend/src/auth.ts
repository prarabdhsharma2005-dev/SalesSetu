import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import type { Session } from 'next-auth'

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google({ authorization: { params: { scope: 'openid email profile' } }, checks: ['pkce', 'state', 'nonce'] })],
  session: { strategy: 'jwt', maxAge: 24 * 60 * 60 },
  callbacks: {
    async signIn({ account, profile }) {
      return account?.provider === 'google' && profile?.email_verified === true
    },
    async jwt({ token, account }) {
      if (account?.provider === 'google') {
        token.workspaceId = account.providerAccountId
        token.reauthAt = Date.now()
      }
      return token
    },
    async session({ session, token }) {
      if (typeof token.workspaceId === 'string') (session.user as typeof session.user & { workspaceId: string }).workspaceId = token.workspaceId
      if (typeof token.reauthAt === 'number') (session as typeof session & { reauthAt: number }).reauthAt = token.reauthAt
      return session
    },
  },
})

export function sessionWorkspaceId(session: Session | null): string | null {
  const id = (session?.user as ({ workspaceId?: unknown }) | undefined)?.workspaceId
  return typeof id === 'string' && /^\d{10,32}$/.test(id) ? id : null
}
