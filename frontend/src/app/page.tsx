import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowRight, CheckCircle2, Compass, FileText, Mail, ShieldCheck, Sparkles, Target, Users } from 'lucide-react'
import { auth, sessionWorkspaceId } from '@/auth'
import styles from './public-home.module.css'

const features = [
  { title: 'Find the right companies', detail: 'Search saved leads and research companies with cited web sources.', icon: Compass },
  { title: 'Understand the opportunity', detail: 'Review intent, sourced contacts, and evidence-based qualification.', icon: Target },
  { title: 'Keep a human in control', detail: 'Draft outreach, edit it, and approve each message before delivery.', icon: ShieldCheck },
  { title: 'Move the deal forward', detail: 'Track follow-ups, meetings, notes, pipeline, and next best actions.', icon: CheckCircle2 },
]

export default async function HomePage() {
  if (process.env.GOOGLE_WORKSPACES_ENABLED !== 'true') redirect('/dashboard')
  const signedIn = Boolean(sessionWorkspaceId(await auth()))
  return <div className={styles.page}>
    <header className={styles.header}>
      <Link href="/" className={styles.brand}><span className={styles.mark}>S</span> SalesSetu</Link>
      <Link className={styles.headerLink} href={signedIn ? '/dashboard' : '/signin'}>{signedIn ? 'Open workspace' : 'Continue with Google'} <ArrowRight size={16}/></Link>
    </header>
    <main>
      <section className={styles.hero}>
        <div className={styles.glow} aria-hidden="true" />
        <div className={styles.heroContent}>
          <span className={styles.eyebrow}><Sparkles size={15} /> Your sales workflow, connected</span>
          <h1>From lead discovery to your next sales action.</h1>
          <p>Research companies, find sourced contacts, qualify opportunities, and prepare outreach in one private workspace. You review every message before it goes out.</p>
          <div className={styles.actions}>
            <Link className={styles.primary} href={signedIn ? '/dashboard' : '/signin'}>{signedIn ? 'Open your workspace' : 'Continue with Google'} <ArrowRight size={18}/></Link>
            <a className={styles.secondary} href="#workflow">Explore the workflow</a>
          </div>
          <span className={styles.note}>Google sign-in uses your basic identity. Gmail sending requires separate consent.</span>
        </div>
        <div className={styles.preview} aria-label="SalesSetu workflow overview">
          <div className={styles.previewHead}><span className={styles.previewDot}/><span className={styles.previewDot}/><span className={styles.previewDot}/><span className={styles.previewTitle}>SalesSetu workflow</span></div>
          <div className={styles.previewRows}>
            <div><Users size={20}/><span><strong>Discover</strong><small>Leads and sourced contacts</small></span><ArrowRight size={17}/></div>
            <div><FileText size={20}/><span><strong>Qualify</strong><small>Reasons and evidence</small></span><ArrowRight size={17}/></div>
            <div><Mail size={20}/><span><strong>Prepare</strong><small>Draft, review, approve</small></span><ArrowRight size={17}/></div>
          </div>
        </div>
      </section>
      <section id="workflow" className={styles.workflow}><div className={styles.sectionHead}><span>BUILT FOR THE FULL JOURNEY</span><h2>One path from research to follow-through.</h2><p>Each stage builds on the records and evidence in your workspace.</p></div><div className={styles.grid}>{features.map(({ title, detail, icon: Icon }) => <article key={title} className={styles.card}><div className={styles.icon}><Icon size={22}/></div><h3>{title}</h3><p>{detail}</p></article>)}</div></section>
    </main>
    <footer className={styles.footer}><span>SalesSetu</span><span>Research and outreach stay under your review. · <Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link></span></footer>
  </div>
}
