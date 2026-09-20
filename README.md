# LabOS v2 — Centralized Lab Management System

This starter project provides a modular lab operations platform designed for research environments such as cancer biology, genomics, pathology, and shared core facilities.

## Included modules

### Core operations
- Authentication with JWT login
- Role-based access foundation
- Protocol and workflow management
- Instrument registry and booking management
- Tasks, compliance logs, and user feedback
- Training and certification tracking
- Inventory and reagent management
- Incident and deviation reporting
- Study or project workspaces
- Notification rule management

### New in v2
- **Sample registry** with barcode-ready identifiers
- **Sample event log** for chain-of-custody and transfer history
- **Lab calendar** for maintenance windows, protocol deadlines, and milestones
- **Reminder queue** for dashboard, email, or SMS routing

## Tech stack
- **Backend:** FastAPI + SQLAlchemy + SQLite
- **Frontend:** React + Vite + TypeScript

## Demo accounts
- `admin@lab.local` / `Admin123!`
- `manager@lab.local` / `Manager123!`
- `staff@lab.local` / `Staff123!`

## Run locally

### Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python seed.py
uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Frontend default URL: `http://localhost:5173`
Backend default URL: `http://127.0.0.1:8000`

## Suggested next upgrades
- Browser/mobile barcode scanner integration
- Background job worker for real reminder delivery
- Google Calendar / Outlook sync
- SOP approvals with signatures and audit exports
- Sample attachment uploads (images, PDFs, run sheets)
- Dashboard analytics for turnaround time and instrument utilization

## Notes
This is a solid starter codebase rather than a production-hardened deployment. Before production use, add:
- database migrations
- secrets management
- stronger authorization policies
- audit trails for all writes
- async workers for reminders
- object storage for files
- backup and disaster recovery configuration
