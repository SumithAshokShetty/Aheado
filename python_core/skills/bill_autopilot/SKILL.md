# Skill Name: Bill Autopilot
## Description: Intercepts incoming invoice streams and drafts secure, delayed payment schedule routes to prevent late fees without compromising immediate cash liquidity.

### Trigger Conditions
- An incoming invoice, receipt, or subscription notification is detected (e.g. from Gmail parsing or manual text paste).
- Imminent billing cycle with risk of late fee.

### Agent Payments Protocol (AP2) Governance
- **Maximum Spend Threshold**: The default AP2 spend boundary is `$50.00`.
- **Dynamic Token Gate**: Any transaction request *exceeding* this limit must be cryptographically locked. 
- **Required Approval**: It CANNOT execute automatically or stage actual settlement routes without a cryptographically verified human trigger (`HITL_YES`).

### Anti-Patterns
- ❌ Do not allow payment staging routes of any amount if current account cash flow balances represent overdraft risks.
- ❌ Do not bypass the cryptographic token validation. Attempting to split charges into smaller requests to bypass the $50 threshold is strictly blocked.
- ❌ Do not access external account balances without standard token headers.
