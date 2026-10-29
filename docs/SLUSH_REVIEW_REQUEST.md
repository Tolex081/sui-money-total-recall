# Slush security warning — prepared review request

Status: unresolved; no support request has been sent. Do not bypass the warning, disable wallet protections, sign on the flagged origin or use another hostname to evade the warning.

## Reported environment

- Slush browser extension in **Chrome** on the builder's PC, confirmed by the user.
- User-reported version: **26.21.6 (e2be7f2)**.
- Warning: “Malicious website. This site has been flagged for malicious behavior.”
- Intended app: https://sui-money.vercel.app/today . Exact hostname displayed when the warning appeared still needs confirmation.
- Server-verified installed-wallet sign-in remains unverified. Public evidence must not contain private authentication records.

## Investigation evidence

`evidence/public/wallet-domain-check.json` records a read-only inspection of MystenLabs/wallet_blocklist at commit `fe160fa2e5e0d103bdcbed92c7d72f5dc8685bf1`. No exact app hostname or literal vercel.app wildcard was found in the inspected lists. This does **not** establish safety or a false positive: other checks, matching behavior and the exact reported origin remain unverified.

Source: https://github.com/MystenLabs/wallet_blocklist . Official security information: https://slush.app/security . Official support: https://support.slush.app/hc/en-us/requests/new . The UI/API sign-in pause is deployed and verified on the prior recorded revision f8bfe48; the pause is retained in deployed source bdace24: health reports disabled sign-in and a new challenge is rejected. See `evidence/public/visual-checks.json`.

## Draft for official support

**Subject:** Review requested: Slush extension warning for Sui Money demo

Slush extension 26.21.6 (e2be7f2) in Chrome on a PC displays “Malicious website — This site has been flagged for malicious behavior” while opening our Sui Money application. Intended origin: https://sui-money.vercel.app . We are confirming the precise flagged hostname.

Public source: https://github.com/Tolex081/sui-money-total-recall . The application is a Sui Mainnet spending tracker and forward budget. Wallet authentication requests a readable origin-bound, expiring nonce personal message. It does not construct or execute transactions, transfer funds, request token approvals or request private keys. The public fictional demo is available without a wallet.

Please identify the rule or behavior causing the warning and advise on the official review/remediation process. We have instructed the user not to bypass the warning and are pausing sign-in. We are not asserting this is a false positive. We can provide the exact flagged hostname and a redacted screenshot if needed.

## Builder actions

Confirm the warning's exact hostname. Chrome and the extension version are recorded. Submit the draft through the official support form if desired; use contact details privately there. Never attach keys, seed phrases, signatures, session cookies, authentication nonces or database exports. Record the support case/reference privately. Resume the genuine wallet acceptance only after the warning has been resolved through official review and the application has been rechecked.
