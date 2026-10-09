import Link from 'next/link'
import { redirect } from 'next/navigation'
import { signIn, auth, sessionWorkspaceId } from '@/auth'
import styles from '../public-home.module.css'

export default async function SignInPage() {
  if (process.env.GOOGLE_WORKSPACES_ENABLED !== 'true') redirect('/dashboard')
  if (sessionWorkspaceId(await auth())) redirect('/dashboard')
  return <main className={styles.signInPage}><div className={styles.signInCard}>
    <Link href="/" className={styles.brand}><span className={styles.mark}>S</span> SalesSetu</Link>
    <h1>Welcome to your workspace.</h1>
    <p>Sign in with your Google account. We use your basic profile to keep your sales records private. Gmail sending is connected separately.</p>
    <form action={async () => { 'use server'; await signIn('google', { redirectTo: '/dashboard' }) }}>
      <button className={styles.primary} type="submit">Continue with Google</button>
    </form>
    <Link href="/" className={styles.back}>← Back to home</Link>
  </div></main>
}
