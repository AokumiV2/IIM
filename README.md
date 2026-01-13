# XRP Traceability for 3D Printed XWings

This repo holds the initial structure for a traceability platform built on the XRP Ledger (XRPL). Each physical XWing maps to a single NFT, and each traceability event is anchored on-ledger and stored off-ledger for fast queries.

Key constraints and assumptions
- XRPL NFToken metadata is immutable once minted. To support "modifiable" data, store a URI that points to versioned JSON and anchor each update by writing a hash in a transaction Memo.
- Use testnet for development and demo.
- Keep issuer and treasury keys in a vault; never commit secrets.
- This is a demo scope; keep dependencies and infra minimal.

Chosen stack (demo)
- Node.js 20 + TypeScript
- xrpl.js for XRPL transactions (testnet)
- SQLite for local persistence
- Local file storage for versioned metadata JSON
- No auth by default (optional static API key for demo)

Project layout
- apps/api: REST API for product registry, events, and metadata access
- apps/indexer: XRPL listener that syncs on-ledger events to the database
- apps/web: dashboard for internal ops and a public verify view
- packages/domain: shared schemas and validation
- packages/xrpl: xrpl.js wrapper and transaction builders
- packages/shared: shared utilities and config
- docs: design and data model docs
- infra: deployment notes and scripts
