# Inventory import (local, read-only)

Brings the lab's inventory, orders and request exports into LabOS: **Resources → Inventory → Import**.

## What it does
- Reads the inventory workbook (`.xlsx`, one sheet per category) and the **Orders** / **Order Requests** CSVs **in the browser**. Nothing is sent anywhere except the lab's own LabOS database.
- Shows a dry-run report per file (row counts by type, missing name, missing catalog #, repeated ids) before anything is saved.
- Stores each row as exported: original id, every original column (`data` JSON), the source file name and import time.
  - Item rows are keyed by **Serial Number**, Instance rows by **Instance ID**, orders by **Order #**, requests by name + vendor + catalog # + date requested.
  - Instances are never merged by product name. Re-importing a file updates rows in place.
- Search across items, instances, orders and requests (name, vendor, catalog #, id), filter by type, export results to CSV.
- Reconciliation of requests: **Ordered** (not in stock, not received), **Received**, **Stock available** (an item/instance with the same vendor + catalog # exists).
- Source-level counts (rows per file and type) on the same tab.
- **Stock alerts** over active instances: out of stock (amount 0), below minimum (only where "Min to Stock" is set), expired, expiring within 90 days. Filter by reason, export CSV.
  - In the lab's current workbook "Min to Stock" is empty on every row and only one instance has an expiration date, so today the alerts are mostly "out of stock". They fill in as those columns get used.
- **Vendor page** button per row: the exported product URL when it is http(s), otherwise the vendor's own search page for the catalog # (for the vendors in `src/data/vendorSearch.ts`).
- **Reorder** button per row: creates a normal request in Requests (pending, goes through the usual approval and budget checks).
- **Remove** button per imported file (admin only): deletes that file's rows; re-import brings them back.

## Run it on macOS
```bash
cd frontend
npm install
npx convex dev            # terminal 1: local backend
npm run dev               # terminal 2: app on http://localhost:5173
```
Sign in as a manager or admin (import needs manager+), open Resources → Inventory → Import, choose the files.

## Tests
```bash
cd frontend
npx vitest run tests/unit/stockimportParse.test.ts          # synthetic rows
IMPORT_DIR=~/Downloads npx vitest run tests/unit/stockimportLocalExports.test.ts   # your real exports (skipped if absent)
```
The local-exports test expects 3,988 items, 3,054 instances, order 1022716 (Addgene, $94) and the pHCMV-EcoEnv request (catalog 15802, Ordered).

## Data handling
- Export files are institutional records. `*.xlsx` is git-ignored; never commit CSV exports, cookies or tokens.
- LabOS never contacts the original system, never changes its records and never places orders.
- The Orders CSVs hold 0 and 1 rows, so they are **not** the full order history. Export a wider date range from the original system to import more.
- The workbook has no pHCMV-EcoEnv row; it exists only as a request/order until it is received and added to inventory.

## Not built
- Live sync or a investigation of the original system: needs your signed-in session and explicit go-ahead; read-only.
- Category-specific column views (all original columns are stored in `data`; the table shows the common ones).
- Excel export (CSV only).
