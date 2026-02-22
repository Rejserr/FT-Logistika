# 🚀 FT-LOGISTIKA – PLAN RAZVOJA NOVE APLIKACIJE ZA RUTIRANJE I DOSTAVE

## 🧭 KLJUČNE ODLUKE
- **Naziv aplikacije:** FT-Logistika
- **Nova baza:** SQL Server `FTLogistika`
- **Smjer:** potpuna nova aplikacija (clean-slate), uz zadržavanje ERP znanja i domenskih pravila

## 📁 STRATEGIJA PROJEKTA (NOVI REPO)
- **Ne ostajemo** u postojećem projektu – kreiramo novi projekt/repo `FT-Logistika`
- Postojeća aplikacija ostaje **read-only referenca** (ne brišemo je)
- U novi projekt prenosimo **samo core logiku** i ERP integraciju

### ✅ Datoteke/komponente za kopiranje ili portanje
- `app/services/erp_client.py` → Luceed ERP API client (zadržati strukturu, prilagoditi config)
- `app/services/region_service.py` → normalizacija poštanskih brojeva
- `app/services/aggregation_service.py` → izračun masa/volumena (referenca)
- `app/services/filter_service.py` → filteri, sortiranje, paginacija (referenca)
- `app/services/logistics_service.py` → logistička pravila (referenca)
- `app/schedulers/sync_scheduler.py` → logika batch sinkronizacije (refaktor)
- `scripts/import_postal_codes.py` → CSV import poštanskih brojeva (prilagoditi FTLogistika shemi)
- `app/schemas/erp_schemas.py` → mapiranja polja (koristiti kao referencu)
- `app/schemas/vehicle_schemas.py` → vozila, tipovi, ograničenja (referenca)
- `app/schemas/logistics_schemas.py` → logistička pravila (referenca)
- `app/api/orders.py` → filteri, update naloga, paging (referenca, bez Optimo)
- `app/api/regions.py` → postal codes CRUD + mapiranje regija (referenca)
- `app/api/vehicles.py` → CRUD vozila i tipova (referenca)
- `app/api/logistics.py` → logistička pravila (referenca)
- `app/api/config.py` → config endpointi (referenca)
- `app/config.py` → struktura env varijabli (referenca)
- `app/database.py` → SQLAlchemy engine/session setup (template)
- `app/main.py` → FastAPI bootstrap + routeri (template)
- `app/api/__init__.py` → standard router pattern (template)
- `app/models/__init__.py` → Base + metadata (template)
- `app/schemas/__init__.py` → schema export pattern (template)
- `app/models/erp_models.py` → modeli naloga/partnera/artikala (template)
- `app/models/regional_models.py` → regije i poštanski brojevi (template)
- `app/models/vehicle_models.py` → vozila (template)
- `app/models/logistics_models.py` → logistička pravila (template)
- `app/models/config_models.py` → konfiguracije (template)
- `scripts/create_database.sql` → reference za inicijalnu bazu (prilagoditi FTLogistika)
- `scripts/migrate_postal_codes_table.sql` → struktura poštanskih brojeva (referenca)
- `scripts/test_db_connection.py` → provjera konekcije (template)
- `.env` → **ne kopirati**; napraviti `.env.example` bez tajni

### ❌ Ne kopirati (više se ne koristi)
- `app/templates/*` (Jinja2 + Bootstrap UI)
- OptimoRoute integracija i SQL view-evi za Optimo
- `app/services/optimo_client.py`, `app/services/optimo_mapper.py`
- `app/models/optimo_models.py`
- `scripts/create_optimo_payload_view.sql`
- `scripts/create_vw_optimo_payload_json_stavke.sql`
- `scripts/migrate_na_uvid_column.sql`
- Frontend JS za dashboard u staroj aplikaciji

## 🧱 STRUKTURA NOVOG PROJEKTA (FT-Logistika)
```
FT-Logistika/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── core/          # config, security, constants
│   │   ├── db/            # session, base, migrations
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   ├── tasks/
│   │   ├── utils/
│   │   └── main.py
│   ├── tests/
│   ├── alembic/
│   └── requirements.txt
├── frontend/
│   ├── src/
│   └── package.json
├── infra/                 # service config, ci, nginx
├── docs/
├── .env.example
└── README.md
```

## ⚙️ DEVOPS I OPERATIVA
- **Bez Dockera (primarno):** backend i worker kao servis na serveru
  - Windows: NSSM / Windows Service
  - Linux: systemd service
- Reverse proxy: Nginx ili IIS (HTTPS, static frontend)
- CI: lint + test + build (GitHub Actions / GitLab CI)
- Alembic migracije + backup politika za SQL Server
- Okoline: dev / stage / prod
- Docker opcionalno kasnije (lokalni dev ili izolacija)

### ✅ Primjeri servisa (produkcija)

**Linux systemd (backend API):**
```
[Unit]
Description=FT-Logistika API
After=network.target

[Service]
WorkingDirectory=/opt/ft-logistika/backend
ExecStart=/opt/ft-logistika/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always
EnvironmentFile=/opt/ft-logistika/.env

[Install]
WantedBy=multi-user.target
```

**Linux systemd (worker/async tasks):**
```
[Unit]
Description=FT-Logistika Worker
After=network.target

[Service]
WorkingDirectory=/opt/ft-logistika/backend
ExecStart=/opt/ft-logistika/venv/bin/celery -A app.tasks worker --loglevel=INFO
Restart=always
EnvironmentFile=/opt/ft-logistika/.env

[Install]
WantedBy=multi-user.target
```

**Windows (NSSM) primjer:**
```
nssm install FTLogistikaApi "C:\FT-Logistika\venv\Scripts\uvicorn.exe" "app.main:app" --host 0.0.0.0 --port 8000
nssm set FTLogistikaApi AppDirectory "C:\FT-Logistika\backend"
nssm set FTLogistikaApi AppEnvironmentExtra "ENV_FILE=C:\FT-Logistika\.env"

nssm install FTLogistikaWorker "C:\FT-Logistika\venv\Scripts\celery.exe" "-A app.tasks worker --loglevel=INFO"
nssm set FTLogistikaWorker AppDirectory "C:\FT-Logistika\backend"
nssm set FTLogistikaWorker AppEnvironmentExtra "ENV_FILE=C:\FT-Logistika\.env"
```

## 🔒 SIGURNOST I AUTENTIKACIJA
- JWT auth + refresh token
- Role-based pristup (Admin/Disponent/Vozač/Viewer)
- Audit log svih promjena
- Skrivanje tajni u `.env` i secret store-u

## 📈 OBSERVABILITY
- Strukturirani logovi (JSON)
- Health check endpointi
- Error tracking (Sentry) – opcionalno

## 🧪 TESTIRANJE
- Unit testovi (services, utils)
- Integration testovi (DB, ERP sync)
- E2E testovi (frontend kritične flow-e)

## 📊 ANALIZA TRENUTNE APLIKACIJE

### ✅ Što već imamo:
- **Backend:** FastAPI (moderna, brza, async podrška)
- **ORM:** SQLAlchemy 2.0 (napredna, tipizirana)
- **Baza podataka:** SQL Server (već postoji ERP integracija)
- **Frontend:** Jinja2 templates + Bootstrap 5 + Vanilla JavaScript
- **ERP Integracija:** Već funkcionalna (Luceed ERP)
- **Modularna struktura:** API, Services, Models, Schemas
- **Scheduler:** APScheduler za sinkronizaciju
- **Postojeći moduli:**
  - Orders (nalozi)
  - Regions (regije)
  - Vehicles (vozila)
  - Logistics (logistička pravila)
  - Config (konfiguracije)

### ⚠️ Što nedostaje za routing:
- Frontend framework React za kompleksnu interakciju
- Map integracija (Leaflet/Google Maps) implementirati obje verzije i postaviti da se u aplikaciji može odabrati koju će se koristiti
- Routing algoritmi (OR-Tools)
- Geocoding servis
- Route storage (nove tablice u bazi)
- Real-time komunikacija (WebSockets za tracking)

---

## 🎯 CILJEVI I OPSEG (FT-Logistika)
- Centralno planiranje dostava s jasnim statusima naloga
- Uvoz naloga, partnera i artikala iz ERP-a (automatizirano + ručno)
- Optimizacija ruta (MVP jednostavno, kasnije OR-Tools)
- Map prikaz ruta i točaka isporuke
- Dodjela vozila i vozača, kapaciteti, ograničenja
- Praćenje realizacije (statusi, ETA, povratna informacija)
- Izvještaji i KPI-evi (km, vrijeme, iskorištenost vozila)

## ✅ MVP FUNKCIONALNOSTI (Prvi release)
- ERP sinkronizacija naloga, partnera i artikala
- Pregled i filtriranje naloga
- Time-window isporuke po nalogu
- Prioriteti naloga (tablica prioriteta, default: termin isporuke)
- Ručno planiranje rute i osnovna optimizacija
- Map prikaz ruta i lista točaka
- Dodjela vozila/vozača
- Više depota/skladišta + dostava iz trgovina (zone)
- Export rute (PDF/Excel) i osnovni audit log
- Web aplikacija prilagođena mobitelu (vozači)

## 📦 DOMENSKI MODULI
- **ERP Sync** (nalozi, partneri, artikli)
- **Orders** (statusi, prioriteti, termin isporuke)
- **Depots/Stores** (skladišta i trgovine kao izvori dostave)
- **Zones** (zone dostave i pravila dodjele izvora)
- **Priorities** (tablica prioriteta)
- **Time Windows** (prozor isporuke po nalogu)
- **Routing** (rute, stopovi, optimizacija)
- **Vehicles/Drivers** (kapaciteti, tipovi, ograničenja)
- **Maps & Geocoding** (adrese, koordinate, distance matrix)
- **Tracking** (statusi isporuke, ETA, web za mobitel u MVP-u; native kasnije)
- **Reporting** (KPI, povijest ruta, troškovi)
- **Config & Rules** (logistička pravila, zone po izvoru, regije, poštanski brojevi)
- **Users & Roles** (prava pristupa i audit)

## 🔐 NEFUNKCIONALNI ZAHTJEVI
- Stabilnost i performanse (300–800 naloga dnevno, skalabilno na 1k+)
- Sigurnost: role-based pristup, audit trail, sigurni tajni ključevi
- Skalabilnost: async task queue za optimizacije i geocoding
- Pouzdanost: retry mehanizmi za ERP i vanjske API-je

## 🔌 ERP INTEGRACIJA (TRENUTNI API POZIVI)
Svi ERP pozivi idu prema `ERP_BASE_URL` uz Basic Auth. Trenutno koristimo:
- **GET** `/datasnap/rest/NaloziProdaje/statusi/[{statusi}]/DD.MM.YYYY/DD.MM.YYYY`
  - Dohvat headera naloga po statusima i datumu
- **GET** `/datasnap/rest/NaloziProdaje/uid/{nalog_prodaje_uid}`
  - Dohvat detalja naloga sa stavkama
- **GET** `/datasnap/rest/partneri/sifra/{partner_sifra}`
  - Dohvat partnera po šifri
- **GET** `/datasnap/rest/artikli/lista/[{offset},{limit}]`
  - Lista artikala (paginacija)
- **GET** `/datasnap/rest/artikli/uid/{artikl_uid}`
  - Dohvat pojedinačnog artikla

Statusi za sync: **08, 101, 102, 103**  
Dvosmjerna sinkronizacija: **ne sada (kasnije)**

Napomena: u novoj aplikaciji treba zadržati postojeće mapiranje polja, normalizaciju poštanskih brojeva i regija te mehaniku sinkronizacije (batch + ručno).

## 🔁 INICIJALNI UVOZ PODATAKA
- Prvi full sync: nalozi, partneri, artikli, poštanski brojevi
- Validacija i deduplikacija partnera (naziv vs ime+prezime)
- Log svih importa + retry na neuspješne zapise
- Ručni “re-sync” gumbi za pojedinačne entitete

---

## 🎯 ODLUKA: NOVA APLIKACIJA OD NULE (FT-Logistika)

### ✅ **ODLUKA: CLEAN-SLATE BUILD**

**Razlozi i koristi:**
1. **Čista arhitektura od starta**
   - Jasno odvojeni moduli (ERP sync, routing, tracking, analytics)
   - Nema tehničkog duga iz stare aplikacije
2. **Nova baza `FTLogistika`**
   - Optimizirana struktura za routing i tracking
   - Jasan model podataka bez nasljeđenih tablica
3. **Bolji UX i moderni frontend**
   - React odmah od starta
   - Map UI i real-time prikaz bez kompromisa
4. **Lakše dugoročno održavanje**
   - Standardizirani API, testovi, dokumentacija
   - Jednostavnije uvođenje novih feature-a

**Što ipak zadržavamo:**
- ERP znanje, postojeća mapiranja polja i validacije
- Logiku sinkronizacije (batch + ručno)
- Domenske principe (nalozi, regije, vozila, logistička pravila)

---

## 🏗️ ARHITEKTURA - PREPORUČENI STACK

### **BACKEND (Zadržati + Proširiti)**

#### Core Framework:
- ✅ **FastAPI** (zadržati)
  - Brz, modern, async podrška
  - Automatska dokumentacija (Swagger)
  - Type hints i Pydantic validacija
  - Odličan za REST API

#### ORM i Baza:
- ✅ **SQLAlchemy 2.0** (zadržati)
  - Napredna ORM funkcionalnost
  - Async podrška
  - Tipizirani upiti

#### Dodatne biblioteke za routing:

```python
# requirements.txt - DODATCI
# Routing optimizacija
ortools>=9.9.0              # Google OR-Tools za VRP/TSP optimizaciju
numpy>=1.24.0               # Numeričke operacije za algoritme
scipy>=1.11.0               # Znanstvene kalkulacije

# Geocoding i Maps
googlemaps>=4.10.0           # Primarno (geocoding, directions, distance matrix)
openrouteservice>=2.3.0     # Fallback/opcija ako treba

# Cache (za geocoding rezultate)
redis>=5.0.0                 # Redis za caching
hiredis>=2.2.0               # Brži Redis parser

# Async tasks (za dugotrajne routing kalkulacije)
celery>=5.3.0                # Distributed task queue

# WebSockets (za real-time tracking)
websockets>=12.0             # WebSocket podrška
python-socketio>=5.10.0      # Socket.IO server

# Utilities
python-dateutil>=2.9.0      # Već imamo
pydantic>=2.10.0             # Već imamo
httpx>=0.25.0                # Async HTTP client (bolji od aiohttp)
```

#### Backend struktura (proširena):

```
app/
├── api/
│   ├── orders.py          # ✅ Postojeći
│   ├── routing.py         # 🆕 NOVO - Routing endpoints
│   ├── maps.py            # 🆕 NOVO - Maps API endpoints
│   ├── vehicles.py        # ✅ Postojeći (proširiti)
│   └── tracking.py        # 🆕 NOVO - Real-time tracking
├── services/
│   ├── routing_service.py      # 🆕 NOVO - Routing algoritmi
│   ├── geocoding_service.py   # 🆕 NOVO - Geocoding
│   ├── maps_service.py        # 🆕 NOVO - Maps API integracija
│   ├── optimization_service.py # 🆕 NOVO - OR-Tools wrapper
│   └── vehicle_assignment.py  # 🆕 NOVO - Dodjeljivanje vozila
├── models/
│   ├── routing_models.py  # 🆕 NOVO - Rute, RuteStops, RutePolylines
│   └── ...                # ✅ Postojeći
└── tasks/
    └── routing_tasks.py   # 🆕 NOVO - Celery tasks za async routing
```

## 🗄️ MODEL PODATAKA (FTLogistika)

### Core (ERP mirror + lokalna logika)
- **`NaloziHeader`** (`nalog_uid` PK, `broj`, `datum`, `raspored`, `status`, `partner_sifra`, `regija_id`, `partner_postanski_broj`, `prioritet_id`, `time_window_od`, `time_window_do`, `izvor_tip`, `izvor_id`)
- **`NaloziDetails`** (`stavka_uid` PK, `nalog_uid` FK, `artikl_uid`, `kolicina`, `cijena`, `opis`)
- **`Partneri`** (`partner_sifra` PK, `naziv`, `ime`, `prezime`, `adresa`, `mjesto`, `drzava`, `postanski_broj`)
- **`Artikli`** (`artikl_uid` PK, `artikl`, `artikl_naziv`, `grupa_artikla_naziv`, `masa`, `volumen`)
- **`Regije`**, **`PostanskiBrojevi`** (mapiranje poštanskih brojeva na regije)
- **`Skladista`** (`id`, `naziv`, `adresa`, `lat`, `lng`, `tip`=central/store)
- **`Zone`** (`id`, `naziv`, `opis`)
- **`ZoneIzvori`** (`zone_id`, `izvor_tip`, `izvor_id`) – odakle se ruta starta po zoni
- **`Prioriteti`** (`id`, `naziv`, `tezina`, `aktivan`)

### Routing
- **`Rute`** (id, datum, status, algoritam, vozilo_id, vozac_id)
- **`RuteStops`** (id, ruta_id, nalog_uid, redoslijed, ETA, status)
- **`RutePolylines`** (ruta_id, polyline, distance_km, duration_min)
- **`RuteAssignments`** (povezivanje naloga s rutama i vozilima)
- **`Vozila`**, **`Vozaci`**, **`VozilaTip`** (kapaciteti, ograničenja)

### Operativa i sustav
- **`SyncLog`** (statusi sinkronizacije, greške)
- **`GeocodingCache`**, **`DistanceMatrixCache`**
- **`AuditLog`** (tko, što, kada)
- **`Users`**, **`Roles`**, **`UserRoles`**
- **`Settings`** (globalne postavke, map provider, limits)

---

## 🔗 API (MVP) – PREDLOŽENI ENDPOINTI
- **Auth**
  - `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- **Sync**
  - `POST /api/sync/orders`, `POST /api/sync/partners`, `POST /api/sync/artikli`
  - `POST /api/sync/postal-codes` (ručni import)
- **Orders**
  - `GET /api/orders`, `GET /api/orders/{uid}`, `PUT /api/orders/{uid}`
  - `POST /api/orders/{uid}/refresh-region`
- **Routing**
  - `POST /api/routing/optimize`, `POST /api/routes`
  - `GET /api/routes`, `GET /api/routes/{id}`, `PUT /api/routes/{id}/status`
- **Vehicles/Drivers**
  - `GET/POST/PUT/DELETE /api/vehicles`
  - `GET/POST/PUT/DELETE /api/drivers`
- **Depots/Stores/Zones**
  - `GET/POST/PUT/DELETE /api/depots`
  - `GET/POST/PUT/DELETE /api/stores`
  - `GET/POST/PUT/DELETE /api/zones`
- **Priorities**
  - `GET/POST/PUT/DELETE /api/priorities`
- **Regions/Postal**
  - `GET /api/regions`, `GET/POST/PUT/DELETE /api/postal-codes`
- **Config**
  - `GET/PUT /api/settings`

## 🧭 FRONTEND (MVP) – STRANICE
- Dashboard (nalozi + filteri)
- Routing planner (mapa + lista naloga + dodjela vozila)
- Rute povijest / detalji rute
- Vozila / vozači (CRUD)
- Skladišta / trgovine (CRUD)
- Zone dostave (CRUD)
- Prioriteti naloga (CRUD)
- Regije / poštanski brojevi (CRUD)
- Postavke / korisnici
- Izvještaji (KPI, rute, performanse)

## 📊 IZVJEŠTAJI (MVP + PROŠIRENJA)
- KPI: broj naloga, % isporučenih na vrijeme
- Rute: km, trajanje, broj stopova, prosječno vrijeme stopa
- Vozila: iskorištenost kapaciteta (masa/volumen)
- Vozači: izvedene isporuke, kašnjenja, povrati
- Zone/izvori: performanse po zoni i po skladištu/trgovini
- Troškovi: km, vrijeme, procjena troška po ruti
- SLA/Time-window: uspješnost unutar prozora isporuke
- Neisporučeno: razlozi i trendovi

---

### **FRONTEND - MODERNA ARHITEKTURA**

#### 🎯 **PREPORUKA: React + TypeScript**

**Zašto React?**

1. **Najpopularniji** - velika zajednica, puno resursa
2. **Komponentna arhitektura** - idealno za kompleksne UI-ove
3. **Ekosustav** - ogroman broj biblioteka
4. **Posao** - lako naći developere
5. **TypeScript podrška** - tipizirani kod, manje grešaka

#### Frontend Stack:

```json
{
  "framework": "React 18+",
  "language": "TypeScript",
  "build_tool": "Vite",  // Brži od Create React App
  "state_management": "Zustand",  // Jednostavniji od Redux-a
  "routing": "React Router v6",
  "ui_components": "Shadcn/ui + Tailwind CSS",  // Modern, customizable
  "maps": "Leaflet.js + React-Leaflet (OSM) + Google Maps provider (switchable)",
  "forms": "React Hook Form + Zod",  // Validacija
  "http_client": "TanStack Query (React Query)",  // Caching, sync
  "drag_drop": "dnd-kit",  // Za reorganizaciju ruta
  "charts": "Recharts",  // Za analitiku
  "date_picker": "react-day-picker"
}
```

#### 🎨 **UI Komponente - Preporuka: Shadcn/ui + Tailwind CSS**

**Zašto Shadcn/ui?**
- ✅ **Kopiraš kod** (nije dependency) - potpuna kontrola
- ✅ **Tailwind CSS** - utility-first, brzo razvijanje
- ✅ **Accessible** - WCAG compliant
- ✅ **Customizable** - lako prilagoditi dizajn
- ✅ **TypeScript** - tipizirane komponente

#### 🗺️ **Maps Biblioteka**

**Opcija 1: Leaflet.js (PREPORUČENO)**
```bash
npm install leaflet react-leaflet
```
- ✅ Besplatno i open-source
- ✅ Lagano i brzo
- ✅ Dobre React wrapperi
- ✅ OpenStreetMap (besplatne karte)
- ⚠️ Manje precizno za Hrvatsku (može se koristiti Google Maps tiles)

**Opcija 2: Google Maps React**
```bash
npm install @react-google-maps/api
```
- ✅ Najpreciznije za Hrvatsku
- ✅ Integracija s Google Directions API
- ⚠️ Plaćeno (ali imaš besplatni kredit)


#### 📦 **State Management**

**Za kompleksne aplikacije:**
- **Zustand** (React) - jednostavniji od Redux-a, dovoljno moćan

**Za jednostavnije:**
- **React Context + Hooks** - ako nema puno globalnog state-a
- **TanStack Query** - za server state (caching, sync)

---

## 🎨 FRONTEND ARHITEKTURA

### Struktura projekta (React + TypeScript):

```
frontend/
├── src/
│   ├── components/
│   │   ├── common/          # Zajedničke komponente (Button, Input, Modal)
│   │   ├── layout/           # Layout komponente (Sidebar, Header)
│   │   ├── routing/         # Routing specifične komponente
│   │   │   ├── RoutePlanner.tsx
│   │   │   ├── VehicleList.tsx
│   │   │   ├── OrderList.tsx
│   │   │   ├── MapView.tsx
│   │   │   └── RouteOptimizer.tsx
│   │   └── orders/          # Order management komponente
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── Routing.tsx     # 🆕 Glavna routing stranica
│   │   ├── RoutesHistory.tsx
│   │   └── Settings.tsx
│   ├── hooks/
│   │   ├── useRouting.ts
│   │   ├── useMaps.ts
│   │   └── useOrders.ts
│   ├── services/
│   │   ├── api.ts           # Axios/TanStack Query setup
│   │   ├── routingApi.ts
│   │   └── mapsApi.ts
│   ├── store/
│   │   ├── routingStore.ts  # Zustand store
│   │   └── ordersStore.ts
│   ├── types/
│   │   ├── routing.types.ts
│   │   └── order.types.ts
│   └── utils/
│       ├── geocoding.ts
│       └── routing.ts
├── public/
└── package.json
```

### Layout za Routing stranicu:

```tsx
// src/pages/Routing.tsx
<div className="routing-layout">
  <div className="routing-sidebar-left">
    <VehicleList />
  </div>
  <div className="routing-center">
    <OrderList />
    <RouteDetails />
  </div>
  <div className="routing-sidebar-right">
    <MapView />
  </div>
</div>
```

---

## 🔄 PLAN FAZA RAZVOJA (FT-Logistika)

### **FAZA 1: Priprema i temelji (1-2 tjedna)**

1. **Kreiraj novu bazu i migracije:**
   - SQL Server DB `FTLogistika`
   - Alembic inicijalna schema (core tablice)

2. **Postavi backend i frontend projekte:**
   ```bash
   npm create vite@latest frontend -- --template react-ts
   cd frontend
   npm install
   ```

3. **Dodaj dependencies:**
   ```bash
   npm install zustand react-router-dom tanstack/react-query
   npm install leaflet react-leaflet @types/leaflet
   npm install tailwindcss shadcn-ui
   npm install @dnd-kit/core @dnd-kit/sortable
   ```

4. **Postavi API proxy i env varijable:**
   - Vite proxy za development
   - CORS konfiguracija u FastAPI
   - ERP credentials i API ključevi u `.env`

5. **Kreiraj osnovni layout:**
   - Sidebar
   - Routing page skeleton

### **FAZA 2: Backend core + ERP sync (2-3 tjedna)**

1. **Implementiraj ERP sync module:**
   - Nalozi, stavke, partneri, artikli
   - Sync log i retry mehanizmi

2. **Dodaj routing modele u bazu:**
   - `Rute`, `RuteStops`, `RutePolylines`
   - Alembic migracije + indeksi

3. **Implementiraj routing servise:**
   - `GeocodingService` - Google Maps API
   - `RoutingService` - OR-Tools integracija
   - `MapsService` - Directions API

4. **Kreiraj API endpoints:**
   - `POST /api/routing/create-route`
   - `GET /api/routing/routes`
   - `GET /api/routing/routes/{ruta_id}`
   - `POST /api/routing/optimize`
   - `GET /api/orders` + filteri

5. **Dodaj caching:**
   - Redis za geocoding rezultate
   - Cache distance matrix rezultate

### **FAZA 3: Frontend - Routing UI (3-4 tjedna)**

1. **Implementiraj komponente:**
   - `VehicleList` - lista vozila s checkboxovima
   - `OrderList` - lista naloga s multi-select
   - `MapView` - Leaflet mapa s rutama
   - `RoutePlanner` - glavna komponenta

2. **Dodaj funkcionalnost:**
   - Odabir vozila i naloga
   - Poziv API-ja za optimizaciju
   - Prikaz rute na karti
   - Drag & drop za reorganizaciju

3. **Dodaj state management:**
   - Zustand store za routing state
   - TanStack Query za API pozive

### **FAZA 4: Optimizacija i proširenja (2-3 tjedna)**

1. **Poboljšaj algoritme:**
   - Prijeđi s Nearest Neighbor na OR-Tools
   - Dodaj kapacitet vozila u optimizaciju

2. **Dodaj dodatne feature-e:**
   - Povijest ruta
   - Export ruta (PDF, Excel)
   - Analitika (km, vrijeme, troškovi)

3. **Performance optimizacije:**
   - Lazy loading komponenti
   - Memoization
   - Virtual scrolling za velike liste

### **FAZA 5: Production ready (1-2 tjedna)**

1. **Testing:**
   - Unit testovi (Jest + React Testing Library)
   - E2E testovi (Playwright)

2. **Dokumentacija:**
   - API dokumentacija (FastAPI automatski)
   - Frontend komponenta dokumentacija

3. **Deployment:**
   - Docker containeri
   - CI/CD pipeline
   - Production optimizacije

---

## 📋 DETALJNI TEHNIČKI STACK

### **BACKEND**

| Kategorija | Tehnologija | Verzija | Razlog |
|------------|-------------|---------|--------|
| Framework | FastAPI | 0.115+ | ✅ Već imamo, odličan |
| ORM | SQLAlchemy | 2.0+ | ✅ Već imamo, async podrška |
| Baza | SQL Server (FTLogistika) | - | ✅ Nova baza za routing i operativu |
| Migracije | Alembic | 1.14+ | ✅ Već imamo |
| Routing | OR-Tools | 9.9+ | 🆕 Google-ov VRP solver |
| Geocoding | Google Maps API | - | 🆕 Najpreciznije za HR |
| Cache | Redis | 7.0+ | 🆕 Brzi cache za geocoding |
| Tasks | Celery | 5.3+ | 🆕 Async routing kalkulacije |
| WebSockets | python-socketio | 5.10+ | 🆕 Real-time tracking |
| HTTP Client | httpx | 0.25+ | 🆕 Async HTTP (bolji od aiohttp) |

### **FRONTEND**

| Kategorija | Tehnologija | Verzija | Razlog |
|------------|-------------|---------|--------|
| Framework | React | 18+ | Najpopularniji, dobar ekosustav |
| Language | TypeScript | 5.0+ | Tipizirani kod, manje grešaka |
| Build Tool | Vite | 5.0+ | Brži od CRA, odličan DX |
| State | Zustand | 4.4+ | Jednostavniji od Redux-a |
| Routing | React Router | 6.20+ | Standard za React |
| HTTP | TanStack Query | 5.0+ | Caching, sync, mutations |
| UI | Shadcn/ui + Tailwind | - | Modern, customizable |
| Maps | Leaflet + React-Leaflet | - | Besplatno, dobar za React |
| Forms | React Hook Form + Zod | - | Performantna validacija |
| Drag & Drop | dnd-kit | 6.0+ | Modern, accessible |
| Charts | Recharts | 2.10+ | Za analitiku |

---

## 💰 PROCJENA TROŠKOVA

### Razvoj:
- **Backend razvoj:** 3-4 tjedna (1 developer)
- **Frontend razvoj:** 4-5 tjedana (1 developer)
- **Testing i optimizacija:** 1-2 tjedna
- **Ukupno:** ~10-12 tjedana

### Infrastruktura (mjesečno):
- **Hosting (VPS/Cloud):** €50-100/mj
- **Google Maps API:** $0-200/mj (ovisno o korištenju)
  - Besplatno: $200 kredit/mj
  - Geocoding: $5/1000 poziva
  - Directions: $5/1000 poziva
  - Distance Matrix: $10/1000 poziva
- **Redis (cache):** €10-20/mj
- **Ukupno:** ~€70-320/mj

---

## ✅ PREPORUKE I ZAKLJUČCI

### 1. **Nova aplikacija FT-Logistika**
   - Clean-slate build uz zadržavanje ERP znanja
   - Nova baza `FTLogistika` s routing-first modelom
   - Jasna arhitektura i standardizirani API

### 2. **Backend: Zadržati FastAPI + dodati routing**
   - FastAPI je odličan izbor
   - Dodaj OR-Tools za optimizaciju
   - Dodaj Redis za caching

### 3. **Frontend: React + TypeScript**
   - Najbolji izbor za kompleksne UI-ove
   - Velika zajednica i resursi
   - TypeScript smanjuje greške

### 4. **UI: Shadcn/ui + Tailwind CSS**
   - Modern, customizable
   - Brzo razvijanje
   - Accessible komponente

### 5. **Maps: Leaflet.js + Google Maps (switchable)**
   - Leaflet/OSM kao default (besplatno)
   - Google Maps kao opcija za veću preciznost

### 6. **Razvoj fazno:**
   - MVP prvo (2-3 tjedna)
   - Zatim optimizacija (OR-Tools)
   - Zatim proširenja (tracking, analitika)

---

## 🚀 SLJEDEĆI KORACI

1. **Potvrdi ključne odluke:**
   - React + TypeScript (odluka: React)
   - Map provider (Leaflet + OSM i Google Maps – oba)
   - Način autentikacije (JWT ili session)

2. **Kreiraj novu bazu `FTLogistika`:**
   - Inicijalna schema i migracije
   - Core tablice za nalozi/partneri/artikli

3. **Implementiraj ERP sync module:**
   - Nalozi, partneri, artikli
   - Sync log i retry

4. **Dodaj backend dependencies:**
   - OR-Tools
   - Google Maps ili OpenRouteService client
   - Redis

5. **Implementiraj MVP:**
   - Osnovni routing UI
   - Jednostavni algoritam (Nearest Neighbor)
   - Prikaz na karti

6. **Iteriraj i poboljšavaj:**
   - Dodaj OR-Tools optimizaciju
   - Dodaj kapacitete vozila
   - Dodaj tracking i analitiku

---

## ✅ POTVRĐENE ODLUKE I PARAMETRI
1. **Statusi iz ERP-a:** 08, 101, 102, 103
2. **Dvosmjerna sinkronizacija:** ne u prvoj fazi (kasnije)
3. **Prioriteti naloga:** tablica prioriteta; default kriterij = termin isporuke
4. **Time-window:** da, obavezno po nalogu
5. **Kapaciteti vozila:** upravljanje kroz tablicu/stranicu po vozilu
6. **Role korisnika:** Admin, Disponent, Vozač, Viewer
7. **Mobilno:** web aplikacija prilagođena mobitelu u MVP-u; native kasnije
8. **Map provider:** Leaflet/OSM default + opcija Google Maps
9. **Izvještaji:** KPI/troškovi/povijest ruta + proširenja (performanse, SLA, zone)
10. **Volumen naloga:** 300–800 dnevno
11. **Depoti:** više izvora (2 centralna skladišta + 28 trgovina, raste)
12. **Logistička pravila:** zone određuju izvor dostave (skladište/trgovina)

*Datum kreiranja: 2026-01-22*  
*Status: Planiranje - spreman za implementaciju*
