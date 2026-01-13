# Traceability Events (Draft)

Core event types
- CREATED
- PRINT_STARTED
- PRINT_COMPLETED
- POST_PROCESS
- QA_PASSED
- QA_FAILED
- PACKAGED
- SHIPPED
- DELIVERED
- SERVICED
- RECALLED
- RETIRED

Event payload guidelines
- Keep payload JSON small.
- Store files (photos, scan data) in object store and reference by URI.
- Always hash the canonical JSON before anchoring on-ledger.
