# Investigation Feature

> **Owner:** Yaniv

Drill-down view for a single attacker — the story of one IP across the whole kill chain.

| Folder | What's inside |
|--------|---------------|
| [`components/`](components/) | `EventDetailPanel` and timeline views |
| [`context/`](context/) | `InvestigationContext` — selected attacker, events, chain state |

Chains are linked by the `attacker_trace_id` cookie set by Bar's kill-chain decoys.
