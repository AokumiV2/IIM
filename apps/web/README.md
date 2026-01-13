# Web App

Responsibilities
- Internal dashboard for operations.
- Public verify view for customers and auditors.

Demo (XRPL testnet)
- Open `apps/web/index.html` via a local static server.
- Example: `python -m http.server 8000` from `apps/web`.
- Browse to `http://localhost:8000` and use the UI to connect, fund a wallet, mint NFTs, and anchor trace events.
- Mint auto-uploads metadata to Supabase and stores a viewer URL on-ledger.
- Open `view.html?id=xwing1` to see the public metadata view.
- You can also use `view.html?url=https://...json` for a direct JSON link.
- Use "Update metadata" to upload a new JSON version and anchor `METADATA_UPDATED`.

Notes
- Testnet only. Use disposable keys.
- Metadata examples live in `apps/web/metadata/`.

Supabase storage (server-side upload)
- Create a Supabase project and a Storage bucket (ex: `Metadata XWing`).
- Make the bucket public for reads.
- In Vercel, set env vars:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_BUCKET`
  - `SUPABASE_FOLDER` (optional)
- Create the database table used to sequence XWings:
```
create table if not exists public.xwing_items (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  item_id text not null unique,
  name text not null,
  metadata_path text not null,
  metadata_url text not null,
  metadata_json jsonb not null
);
```
- Create an events table to record on-chain anchors:
```
create table if not exists public.xwing_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  item_id text not null,
  event_type text not null,
  payload_hash text not null,
  payload_json jsonb,
  metadata_url text,
  tx_hash text
);
```
- Optional env var: `SUPABASE_TABLE` (default `xwing_items`).
- Optional env var: `SUPABASE_EVENTS_TABLE` (default `xwing_events`).
- Deploy; Mint will auto-upload via `/api/upload-metadata`.
- `view.html` calls `/api/metadata?id=...` to render the public page.
- `view.html` also calls `/api/events?id=...` to show anchored updates.
- Manual or automatic anchors are stored via `/api/log-event`.
