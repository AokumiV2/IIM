# Data Model (Draft)

Item
- item_id
- nft_id
- serial
- product_sku
- print_job_id
- status
- current_owner

PrintJob
- print_job_id
- machine_id
- material_lot_id
- started_at
- completed_at

MaterialLot
- material_lot_id
- supplier
- batch_code
- received_at

TraceEvent
- event_id
- item_id
- event_type
- event_time
- actor_id
- location
- payload_json
- payload_hash
- xrpl_tx_hash
