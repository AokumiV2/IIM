# XRPL Notes

NFT standard
- Use NFTokenMint for each physical item.
- The on-ledger URI is immutable; treat it as a pointer to versioned JSON.
- Use a dedicated issuer account and a separate treasury account.

Transfers
- Use NFTokenCreateOffer and NFTokenAcceptOffer for custody changes.
- Record custody changes in the database for fast queries.

Trace events
- Anchor event hashes in the Memo field of a lightweight transaction.
- The indexer validates that the on-ledger hash matches the stored payload.

Networks
- Use testnet for all demo work.
- WebSocket: wss://s.altnet.rippletest.net:51233
- JSON-RPC: https://s.altnet.rippletest.net:51234
- Faucet: https://faucet.altnet.rippletest.net
