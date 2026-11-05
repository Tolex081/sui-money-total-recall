# Slush security warning: review request

Updated 5 November 2026. Status: **unresolved**, and only Slush can clear it. The owner reported contacting Slush support earlier; no response has been recorded here. Do not bypass the warning, disable wallet protections, sign on a flagged origin, or switch to another hostname to evade it.

## What the owner sees
- **Screen:** the Slush browser extension in Chrome on the owner's PC shows "Malicious website. This site has been flagged for malicious behavior." It offers "Flag for review" and "Return to safety".
- **Latest occurrence:** 5 Nov 2026, on the production app `https://sui-money.vercel.app`. **Alert ID `59b8ede0-3a5f-446a-a7a9-bf2ac1c74e19`.**
- **Extension version:** 26.21.6 (e2be7f2), reported earlier and not rechecked on 5 Nov.
- **Other wallets:** StarKey connects, signs in and sends normally on the same app. Suiet has ended development and can't read address-balance transactions.

## Investigation (5 Nov 2026, read-only)
- **Public blocklist:** MystenLabs/wallet_blocklist `main` (commit `fe160fa`, 27 Oct 2026), `blocklists/domain-list.json` has 50,630 entries:
  - `sui-money.vercel.app` is **not** listed;
  - no bare `vercel.app` entry and no wildcard;
  - nothing containing "sui-money" or "suimoney";
  - **447 unrelated `*.vercel.app` hosts** are listed, mostly phishing sites.
- **Conclusion:** the warning doesn't come from the public domain list. It comes from Slush's own, non-public checks. A plausible reason, unconfirmed, is a new finance/crypto app on a shared free `vercel.app` hostname, a pattern common among the listed scam sites. This is not proof of a false positive. Only Slush can identify the rule.
- **Not affected:** the warning appears before the app runs and isn't caused by anything the app can change in code.

Sources: https://github.com/MystenLabs/wallet_blocklist · https://slush.app/security · support https://support.slush.app/hc/en-us/requests/new

## Draft for official support (accurate as of 5 Nov 2026)

**Subject:** Review requested: Slush warning on sui-money.vercel.app (Alert ID 59b8ede0-3a5f-446a-a7a9-bf2ac1c74e19)

Slush in Chrome shows "Malicious website. This site has been flagged for malicious behavior" when opening our app at https://sui-money.vercel.app (Alert ID 59b8ede0-3a5f-446a-a7a9-bf2ac1c74e19). The domain is not in the public MystenLabs/wallet_blocklist domain list as of commit fe160fa.

Sui Money is a Sui Mainnet personal-finance app built for the Tatum × Walrus "Total Recall" hackathon. Source code is public: https://github.com/Tolex081/sui-money-total-recall .

How it uses a wallet:
- **Sign-in** asks the wallet to sign a readable, origin-bound, expiring personal message. It's not a transaction.
- **Sending:** to send USDC or SUI, the app builds an **unsigned** transfer to an address the user typed. The user reviews and approves it in their own wallet. The app never holds keys, never asks for seed phrases or private keys, and never requests token approvals or allowances.
- **Data:** balances and history are read through Tatum's Sui gateway. Payment labels and savings goals are stored with Walrus Memory after the user agrees.
- **Demo:** a fictional demo is available without a wallet at https://sui-money.vercel.app/demo .

Please let us know which check caused the warning and how to get it reviewed. We have told users not to bypass it, and we're happy to make any change you require.

## Builder actions
1. Tap **Flag for review** on the Slush warning screen.
2. Submit the draft above through the official support form. Put contact details only in the form, never in this repository. Don't attach keys, seed phrases, signatures, session cookies, sign-in nonces or database exports.
3. Record the support case reference privately. Once Slush responds, recheck the app in Slush before telling users it's safe to use.
4. Until then, point users to a wallet that works (StarKey). Longer term, a dedicated custom domain is a sensible permanent home for the app. Adopt it as the real address, not to get around this review.
