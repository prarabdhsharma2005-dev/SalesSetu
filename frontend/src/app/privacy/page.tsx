import Link from 'next/link'

export const metadata = { title: 'Privacy Policy | SalesSetu' }

export default function PrivacyPage() {
  const operator = process.env.SALESSETU_PUBLIC_OPERATOR_NAME?.trim() || 'Prarabdh Sharma'
  const support = process.env.SALESSETU_PUBLIC_SUPPORT_EMAIL?.trim() || 'prarabdhsharma2005@gmail.com'
  return <main style={{ maxWidth: 760, margin: '0 auto', padding: '48px 20px', lineHeight: 1.7 }}>
    <Link href="/">← SalesSetu</Link>
    <h1>SalesSetu Privacy Policy</h1>
    <p><strong>Public-release draft:</strong> {operator}, an individual developer, operates SalesSetu. Contact <a href={`mailto:${support}`}>{support}</a> about privacy or account data. The operator must review retention and legal details before submitting this policy for OAuth verification.</p>
    <h2>Information used</h2>
    <p>Google sign-in provides your Google account identifier, name and email for authentication and workspace ownership. Your workspace can contain saved leads, research citations, contact details, ICP rules, drafts, approvals, delivery attempts, follow-ups, meetings, and deals. SalesSetu stores these records separately for each signed-in workspace.</p>
    <h2>Optional integrations</h2>
    <p>When you explicitly request company or contact research, SalesSetu sends the relevant company or contact context to its configured search and AI providers. “Find work email” sends only the selected professional contact and company details to the provider you choose, Hunter or Apollo when enabled. It does not automatically enrich every contact.</p>
    <p>Google sign-in does not connect Gmail. If you choose Connect Gmail, SalesSetu requests <code>gmail.send</code> and basic account identity in a separate consent flow. The backend encrypts the resulting OAuth tokens in workspace-specific storage. It uses Gmail permission only to send a message after you confirm a recipient and the current draft revision is approved. SalesSetu does not request Gmail inbox-reading permission or scan replies.</p>
    <h2>Storage and control</h2>
    <p>Production workspace records are held in PostgreSQL. Gmail tokens are stored separately as encrypted records. Disconnect Gmail removes SalesSetu’s saved connection and attempts Google token revocation. You can delete your workspace through Settings → Your account after reauthentication. Sign-out alone does not delete records. Provider-side retention and Google Account revocation are controlled by those providers and your account settings.</p>
    <p>Before public release, the operator must publish a support contact, review retention and backup practices, and verify this policy accurately describes deployed providers and hosting.</p>
    <p><Link href="/terms">Terms of Use</Link></p>
  </main>
}
