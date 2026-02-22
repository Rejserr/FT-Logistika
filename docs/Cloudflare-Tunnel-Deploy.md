# Cloudflare Tunnel — HTTPS Deploy dokumentacija

## Sadržaj

1. [Arhitektura](#1-arhitektura)
2. [Preduvjeti](#2-preduvjeti)
3. [Instalacija cloudflared](#3-instalacija-cloudflared)
4. [Kreiranje tunnela](#4-kreiranje-tunnela)
5. [Konfiguracija tunnela](#5-konfiguracija-tunnela)
6. [DNS konfiguracija](#6-dns-konfiguracija)
7. [Pokretanje tunnela](#7-pokretanje-tunnela)
8. [Promjene u aplikaciji](#8-promjene-u-aplikaciji)
9. [Production build & deploy](#9-production-build--deploy)
10. [Windows servis](#10-windows-servis)
11. [Provjera i troubleshooting](#11-provjera-i-troubleshooting)

---

## 1. Arhitektura

```
                          INTERNET
                             |
                     Cloudflare Edge
                    (HTTPS terminacija,
                     DDoS zaštita, CDN)
                             |
                    Cloudflare Tunnel
                   (outbound konekcija,
                    nema port forwarding)
                             |
                        LAN Server
                    ┌────────┴────────┐
              localhost:8000     frontend/dist/
              (FastAPI backend)  (static files)
```

**Jedna domena, path routing:**

| URL | Destinacija |
|-----|-------------|
| `https://logistika.domena.hr/` | Frontend (index.html) |
| `https://logistika.domena.hr/api/*` | Backend API |
| `https://logistika.domena.hr/assets/*` | Frontend static assets |

---

## 2. Preduvjeti

- Domena registrirana i DNS na Cloudflare-u (nameserveri postavljeni)
- Windows server s pristupom internetu (outbound)
- Python backend i frontend build spremni
- **Nije potrebno:** otvaranje portova, port forwarding, certifikati

---

## 3. Instalacija cloudflared

### Windows

```powershell
# Opcija 1: winget
winget install cloudflare.cloudflared

# Opcija 2: ručno
# Preuzmi sa: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
# Stavi cloudflared.exe u PATH
```

Provjera:

```powershell
cloudflared --version
```

---

## 4. Kreiranje tunnela

```powershell
# 1. Login (otvara browser za Cloudflare autorizaciju)
cloudflared tunnel login

# 2. Kreiraj tunnel
cloudflared tunnel create ft-logistika

# Output:
# Created tunnel ft-logistika with id <TUNNEL-ID>
# Credentials written to C:\Users\mladen.lackovic\.cloudflared\<TUNNEL-ID>.json
```

> **Zapamti `<TUNNEL-ID>`** — treba za config i DNS.

---

## 5. Konfiguracija tunnela

Kreiraj datoteku `C:\Users\mladen.lackovic\.cloudflared\config.yml`:

```yaml
tunnel: ft-logistika
credentials-file: C:\Users\mladen.lackovic\.cloudflared\<TUNNEL-ID>.json

ingress:
  # Sve na jednu domenu — backend servira i frontend build
  - hostname: logistika.domena.hr
    service: http://localhost:8000
    originRequest:
      noTLSVerify: true

  # Catch-all (obavezno, uvijek zadnje)
  - service: http_status:404
```

### Napomene

- `hostname` — zamijeniti s pravom domenom
- `credentials-file` — zamijeniti s pravim TUNNEL-ID-jem
- Backend na portu 8000 servira i API i frontend static files
- `noTLSVerify: true` — jer backend radi na HTTP lokalno

---

## 6. DNS konfiguracija

```powershell
# Automatski kreira CNAME zapis na Cloudflare DNS
cloudflared tunnel route dns ft-logistika logistika.domena.hr
```

Ovo kreira:

```
logistika.domena.hr  CNAME  <TUNNEL-ID>.cfargotunnel.com
```

> Može se napraviti i ručno u Cloudflare dashboardu: DNS → Add Record → CNAME.

---

## 7. Pokretanje tunnela

### Ručno (za testiranje)

```powershell
cloudflared tunnel run ft-logistika
```

### Provjera

```powershell
# Status tunnela
cloudflared tunnel info ft-logistika

# Lista svih tunnela
cloudflared tunnel list
```

---

## 8. Promjene u aplikaciji

### 8.1. Backend — `.env`

```env
# Produkcija
DEBUG=False
CORS_ORIGINS=http://localhost:5173,https://logistika.domena.hr
```

### 8.2. Backend — Cookie secure flag (`auth.py`)

Na **3 mjesta** gdje se poziva `response.set_cookie()`, promijeniti:

```python
# Prije:
secure=False,

# Poslije:
secure=not settings.DEBUG,
```

Lokacije u `backend/app/api/auth.py`:
- Linija 77: `access_token` cookie (login)
- Linija 86: `refresh_token` cookie (login)
- Linija 259: `access_token` cookie (refresh)

Efekt:
- `DEBUG=True` (dev) → `secure=False` → radi na HTTP (localhost)
- `DEBUG=False` (prod) → `secure=True` → cookie samo preko HTTPS

### 8.3. Backend — Serviranje frontend builda (`main.py`)

Dodati **na kraj** `main.py`, **ISPOD** `app.include_router(api_router)`:

```python
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

frontend_dist = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.isdir(frontend_dist):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="static-assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """SPA fallback — sve što nije /api/* ide na index.html"""
        index = os.path.join(frontend_dist, "index.html")
        if os.path.isfile(index):
            return FileResponse(index)
        return JSONResponse(status_code=404, content={"detail": "Frontend build not found"})
```

> **Važno:** Ovo mora biti NAKON API routera, inače će catch-all uhvatiti API pozive.

### 8.4. Frontend — `.env.production`

```env
VITE_API_BASE_URL=/api
```

Relativni path — sve na istoj domeni, nema CORS problema.

### 8.5. Mobilna app — Production URL

`driver-app/services/api.ts`, linija 7:

```typescript
if (!__DEV__) {
    return 'https://logistika.domena.hr/api';
}
```

---

## 9. Production build & deploy

### Frontend build

```powershell
cd C:\VS\FT-Logistika\frontend
npm run build
# Generira: frontend/dist/
```

### Backend pokretanje (produkcija)

```powershell
cd C:\VS\FT-Logistika\backend

# Bez --reload u produkciji
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

### Tunnel pokretanje

```powershell
cloudflared tunnel run ft-logistika
```

---

## 10. Windows servis

Za automatsko pokretanje pri boot-u:

### Cloudflared kao servis

```powershell
# Instalacija (kao Administrator)
cloudflared service install

# Pokreni servis
net start cloudflared
```

Servis koristi config iz `C:\Users\mladen.lackovic\.cloudflared\config.yml`.

### Backend kao servis (opcija: NSSM)

```powershell
# Instaliraj NSSM (Non-Sucking Service Manager)
winget install nssm

# Registriraj servis
nssm install FTLogistika "C:\Python313\python.exe" "-m uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4"
nssm set FTLogistika AppDirectory "C:\VS\FT-Logistika\backend"
nssm set FTLogistika DisplayName "FT-Logistika Backend"
nssm set FTLogistika Start SERVICE_AUTO_START

# Pokreni
nssm start FTLogistika
```

---

## 11. Provjera i troubleshooting

### Provjera da tunnel radi

```powershell
# Lokalno
curl http://localhost:8000/api/health

# Preko tunnela
curl https://logistika.domena.hr/api/health
```

### Česti problemi

| Problem | Rješenje |
|---------|----------|
| `502 Bad Gateway` | Backend nije pokrenut na localhost:8000 |
| Cookie se ne šalje | Provjeri `secure=True` + HTTPS, `samesite=lax` |
| CORS error | Dodaj domenu u `CORS_ORIGINS` u .env |
| Frontend 404 | Provjeri da `frontend/dist/` postoji i da je mount u main.py |
| Tunnel disconnect | Provjeri internet konekciju, restartaj `cloudflared service` |
| `ModuleNotFoundError: No module named 'app'` | Uvicorn pokrenut iz krivog direktorija, mora biti `cd backend` |

### Cloudflare dashboard

- **Tunnel status:** Cloudflare Zero Trust → Networks → Tunnels
- **DNS zapisi:** Cloudflare Dashboard → DNS → Records
- **Analytics:** Cloudflare Dashboard → Analytics & Logs

---

## Sažetak — checklist za deploy

- [ ] Instaliraj `cloudflared` na server
- [ ] `cloudflared tunnel login`
- [ ] `cloudflared tunnel create ft-logistika`
- [ ] Kreiraj `config.yml`
- [ ] `cloudflared tunnel route dns ft-logistika logistika.domena.hr`
- [ ] Backend `.env`: `DEBUG=False`, `CORS_ORIGINS` dodaj domenu
- [ ] `auth.py`: `secure=not settings.DEBUG` (3 mjesta)
- [ ] `main.py`: dodaj static file serving
- [ ] `frontend/.env.production`: `VITE_API_BASE_URL=/api`
- [ ] `driver-app/services/api.ts`: production URL
- [ ] `npm run build` (frontend)
- [ ] Pokreni backend: `uvicorn app.main:app --host 0.0.0.0 --port 8000`
- [ ] Pokreni tunnel: `cloudflared tunnel run ft-logistika`
- [ ] Testiraj: `https://logistika.domena.hr`
- [ ] (Opcionalno) Postavi Windows servise za auto-start
