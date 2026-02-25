# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

FT-Logistika is a Croatian logistics/delivery route planning platform. It is a monorepo with:

| Service | Directory | Stack | Dev port |
|---------|-----------|-------|----------|
| Backend API | `backend/` | FastAPI + SQLAlchemy + pyodbc (MSSQL) | 8000 |
| Frontend (Vite) | `frontend/` | React + Vite + TailwindCSS 4 | 5173 |
| Frontend (Next.js) | `frontend-next/` | Next.js 16 + shadcn/ui + TailwindCSS 4 | 3000 |
| Driver App | `driver-app/` | Expo 54 + React Native (mobile, optional) | — |

Both web frontends proxy `/api` requests to the backend at `localhost:8000`.

### Required infrastructure services

- **SQL Server** — runs in Docker: `sudo docker start mssql` (container already created with SA password `FTLog1stika!`, database `FTLogistika`).
- **Redis** — `sudo redis-server --daemonize yes` (used by Celery for background tasks).

### Running services

```bash
# Backend (from /workspace/backend)
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000

# Frontend Vite (from /workspace/frontend)
npx vite --host 0.0.0.0 --port 5173

# Frontend Next.js (from /workspace/frontend-next)
npx next dev --hostname 0.0.0.0 --port 3000
```

### Non-obvious gotchas

- **ODBC Driver 18 vs 17**: Ubuntu 24.04 only has ODBC Driver 18. The `.env` must set `DB_DRIVER=ODBC Driver 18 for SQL Server` (not 17).
- **bcrypt/passlib incompatibility**: `bcrypt>=5` breaks `passlib`. Pin `bcrypt<5` (`pip install 'bcrypt<5'`). This is already handled in the venv.
- **`.env` location**: The backend config (`backend/app/core/config.py`) resolves `.env` relative to itself → expects it at `backend/.env` (not repo root). Copy/symlink from root `.env.example` accordingly.
- **Admin credentials**: On fresh DB, the startup handler seeds user `admin` / `admin123` with `force_password_change=true`.
- **Frontend TypeScript errors**: `frontend/src/pages/PodPage.tsx` and `frontend/src/services/api.ts` have pre-existing TS errors (not blocking dev server or build of frontend-next).

### Lint & type checks

```bash
# frontend-next (ESLint)
cd frontend-next && npm run lint

# frontend-next (TypeScript)
cd frontend-next && npx tsc --noEmit

# frontend (TypeScript — has pre-existing errors)
cd frontend && npx tsc --noEmit
```

### Tests

The backend `tests/` directory contains only `__init__.py`; there are no automated tests yet.
