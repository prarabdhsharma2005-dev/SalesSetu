import Link from 'next/link'

export const metadata = { title: 'Terms of Use | SalesSetu' }

export default function TermsPage() {
  const operator = process.env.SALESSETU_PUBLIC_OPERATOR_NAME?.trim() || 'Prarabdh Sharma'
  const support = process.env.SALESSETU_PUBLIC_SUPPORT_EMAIL?.trim() || 'prarabdhsharma2005@gmail.com'
  return <main style={{ maxWidth: 760, margin: '0 auto', padding: '48px 20px', lineHeight: 1.7 }}>
    <Link href="/">← SalesSetu</Link>
    <h1>SalesSetu Terms of Use</h1>
    <p><strong>Public-release draft:</strong> These terms are provided by {operator}, an individual developer. Contact <a href={`mailto:${support}`}>{support}</a> for support. These terms require operator review before public release.</p>
    <h2>Using SalesSetu</h2>
    <p>SalesSetu helps you research companies, organize contacts and prepare sales outreach in your own workspace. Research and AI output can be incomplete or wrong. You are responsible for reviewing sources, recipient details, message claims, permissions and applicable outreach rules before sending.</p>
    <h2>Gmail and other providers</h2>
    <p>Connect Gmail is optional and separately authorized. Sending requires a connected Gmail account, a confirmed recipient and human approval of the current message revision. SalesSetu does not guarantee delivery or detect replies automatically. Search, AI, work-email lookup and Gmail availability also depend on those providers’ terms, permissions and quotas. Outlook and other email providers are not currently integrated.</p>
    <h2>Your records</h2>
    <p>You can archive saved leads without deleting their linked history. You can disconnect Gmail or delete your workspace in account settings. Archiving a lead does not itself pause or cancel an active follow-up sequence.</p>
    <p>Before public release, the operator must finalize these terms, its legal identity, support contact, governing details and any required customer agreement. See the <Link href="/privacy">Privacy Policy</Link> for current data handling.</p>
  </main>
}
