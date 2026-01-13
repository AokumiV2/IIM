# Web App

Responsibilities
- Internal dashboard for operations.
- Public verify view for customers and auditors.

Demo (XRPL testnet)
- Open `apps/web/index.html` via a local static server.
- Example: `python -m http.server 8000` from `apps/web`.
- Browse to `http://localhost:8000` and use the UI to connect, fund a wallet, mint NFTs, and anchor trace events.
- Use the "NFT Metadata" panel to generate JSON and download it into `apps/web/metadata/`, then apply it to the Mint URI.

Notes
- Testnet only. Use disposable keys.
- Metadata examples live in `apps/web/metadata/`.
