# Security and privacy

Wallet authentication signs a personal message bound to app origin, Mainnet intent, normalized wallet, nonce, issue and expiry times. Server Mysten verification derives the signer. Random session tokens are 32 cryptographic bytes; only hashes are stored. HTTPS cookies are HTTP-only, secure and SameSite=Lax. CSRF combines strict same-origin validation and a session-bound token. Challenges are consumed under a row lock once; sessions expire after seven days and revoke on logout.

Real PostgreSQL tests have exercised correct/incorrect signatures, wrong address, expiry, domain mismatch, concurrent nonce consumption, replay, CSRF, missing session, revocation and cross-profile allocation references. This does not replace all HTTP direct-object-reference tests or genuine installed-wallet sign-in on the deployment. Those remain release gates.

Every owned table has a profile key and composite foreign keys where applicable. Queries use the server-authenticated profile. Memory namespaces are opaque saved mappings. The delegate can access the operator account's namespaces; the operator and managed relayer are in the trust boundary. This version does not claim end-user-owned blobs or sole-user access.

Amounts and event envelopes are validated as structured input. User/memory text renders as text, never HTML or executable instructions. Notes are short aliases; obvious seed/key and common PII patterns are rejected. Onchain fields retain field-specific validation. Chain facts and event envelopes are immutable; corrections create revisions.

Secrets belong only in ignored local files and hosting Secret variables. `.env.example` is a safe public template. Source and `.next/static` scans compare against configured secret values without printing them. No owner-wallet key is configured. Do not include exported personal ledgers, auth traces or private job recovery files in public artifacts.

Headers include CSP, nosniff, frame denial, referrer policy and restricted browser permissions. Shared service controls use durable global/user buckets. Public health/proof do not trigger writes. Operator recovery remains private; production has no test auth bypass.

If a credential is exposed publicly: stop the affected action; revoke/rotate the delegate, API key or database password in its dashboard; replace hosting and private local values; invalidate affected sessions; inspect access logs and scans before resuming. Do not paste the leaked value into a report. The template credentials mentioned during this session were moved to `.env.local` and the uncommitted template sanitized before publication.
