# Architecture

Goal
- End to end traceability for 3D printed XWings using XRPL NFTs.

Components
- XRPL: source of truth for NFT ownership and event anchors.
- API service: write path for items and trace events.
- Indexer: read path that listens to XRPL and updates the database.
- Database: SQLite (local file) for audit and reporting.
- Object store: local folder with versioned JSON for metadata and attachments.

Ledger usage
- NFTokenMint for each physical item.
- NFTokenCreateOffer + NFTokenAcceptOffer for custody transfers.
- Memos on lightweight transactions to anchor trace event hashes.
- NFTokenBurn when an item is retired or destroyed.

Data flow
1) Register item -> build metadata JSON -> mint NFT with URI -> store mapping.
2) Add trace event -> write DB -> hash payload -> submit XRPL tx with Memo.
3) Indexer consumes ledger -> validates hash -> updates audit view.
