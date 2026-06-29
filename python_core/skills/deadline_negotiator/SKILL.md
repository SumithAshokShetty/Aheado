# Skill Name: Deadline Negotiator
## Description: Intercepts tight homework, project, or task deadlines and drafts polite extension request proposals.

### Trigger Conditions
- Incoming assignment or task has a remaining completion window of `< 24 hours` (Critical threshold).
- Natural language query explicitly expresses panic, time crunch, or inability to submit on schedule.
- High-level academic, client, or professional portal deadlines about to breach.

### Execution Bounds & Governance
- **Zero Ambient Authority**: Under no circumstances must this skill send or submit emails/messages directly. It must ONLY generate draft payloads and present them as a Human-In-The-Loop (HITL) verification card.
- **Tone Guardrails**: The drafted message must remain highly professional, respectful, concise, and free from melodramatic storytelling.

### Anti-Patterns
- ❌ Do not invoke random excuses like family tragedies or health lies unless explicitly stated by the user. Keep it to structural bottlenecks, complex calculations, compilation issues, or server crashes.
- ❌ Do not bypass the HITL gate. The output must require manual review before delivery.
- ❌ Do not specify hard dates without consulting calendar availability.
