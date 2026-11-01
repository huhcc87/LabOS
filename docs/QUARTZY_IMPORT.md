# Quartzy import (local, read-only)

Brings the lab's Quartzy exports into LabOS: **Resources → Inventory → Quartzy**.

## What it does
- Reads the inventory workbook (`.xlsx`, one sheet per category) and the **Orders** / **Order Requests** CSVs **in the browser**. Nothing is sent anywhere except the lab's own LabOS database.
- Shows a dry-run report per file (row counts by type, missing name, missing catalog #, repeated ids) before anything is saved.
- Stores each row as exported: original Quartzy id, every original column (`data` JSON), the source file name and import time.
  - Item rows are keyed by **Serial Number**, Instance rows by **Instance ID**, orders by **Order #**, requests by name + vendor + catalog # + date requested.
  - Instances are never merged by product name. Re-importing a file updates rows in place.
- Search across items, instances, orders and requests (name, vendor, catalog #, id), filter by type, export results to CSV.
- Reconciliation of requests: **Ordered** (not in stock, not received), **Received**, **Stock available** (an item/instance with the same vendor + catalog # exists).
- Source-level counts (rows per file and type) on the same tab.

## Run it on macOS
```bash
cd frontend
npm install
npx convex dev            # terminal 1: local backend
npm run dev               # terminal 2: app on http://localhost:5173
```
Sign in as a manager or admin (import needs manager+), open Resources → Inventory → Quartzy, choose the files.

## Tests
```bash
cd frontend
npx vitest run tests/unit/quartzyParse.test.ts          # synthetic rows
QUARTZY_DIR=~/Downloads npx vitest run tests/unit/quartzyLocalExports.test.ts   # your real exports (skipped if absent)
```
The local-exports test expects 3,988 items, 3,054 instances, order 1022716 (Addgene, $94) and the pHCMV-EcoEnv request (catalog 15802, Ordered).

## Data handling
- Export files are institutional records. `*.xlsx` is git-ignored; never commit CSV exports, cookies or tokens.
- LabOS never calls Quartzy and never changes Quartzy records or places orders.
- The Orders CSVs hold 0 and 1 rows, so they are **not** the full order history. Export a wider date range from Quartzy to import more.
- The workbook has no pHCMV-EcoEnv row; it exists only as a request/order until it is received and added to inventory.

## Not built
- Live sync or a REA investigation of Quartzy: needs your signed-in session and explicit go-ahead; read-only.
- Category-specific column views (all original columns are stored in `data`; the table shows the common ones).
- Excel export (CSV only).
