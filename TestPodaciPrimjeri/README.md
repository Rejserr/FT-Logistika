# OptimoRout - Logistics Integration Backend

Production-ready FastAPI backend za integraciju Luceed ERP-a s logističkim pravilima i pripremu OptimoRoute order payloada.

## Tehnologije

- Python 3.11
- FastAPI
- SQLAlchemy 2.0
- SQL Server (pyodbc)
- aiohttp (async ERP calls)
- APScheduler
- Alembic migrations
- Jinja2 templates

## Instalacija

### 1. Kreiraj virtualno okruženje

```bash
python -m venv venv
venv\Scripts\activate  # Windows
# ili
source venv/bin/activate  # Linux/Mac
```

### 2. Instaliraj dependencies

```bash
pip install -r requirements.txt
```

### 3. Konfiguracija

Kopiraj `.env.example` u `.env` i uredi postavke:

```bash
copy .env.example .env
```

Uredi `.env` datoteku s tvojim SQL Server i ERP podacima.

### 4. Kreiraj bazu podataka

Izvrši SQL skriptu u SQL Server Management Studio:

```sql
-- Pokreni scripts/create_database.sql
```

### 5. Pokreni Alembic migracije

```bash
alembic upgrade head
```

### 6. Import poštanskih brojeva (opcionalno)

```bash
# CSV datoteka treba biti u root direktoriju ili u data/ direktoriju
python scripts/import_postal_codes.py
# ili s custom putanjom:
python scripts/import_postal_codes.py data/Posta_mjesta.csv
```

### 7. Pokreni aplikaciju

```bash
python -m app.main
# ili
uvicorn app.main:app --reload
```

Aplikacija će biti dostupna na `http://localhost:8000`

## Struktura Projekta

```
OptimaRout/
├── app/
│   ├── models/          # SQLAlchemy modeli
│   ├── schemas/         # Pydantic schemas
│   ├── services/        # Business logic
│   ├── api/             # FastAPI routers
│   ├── schedulers/      # APScheduler jobs
│   ├── templates/       # Jinja2 templates
│   └── static/          # CSS, JS
├── scripts/             # Utility skripte
├── alembic/             # Database migrations
└── data/                # CSV datoteke
```

## API Endpoints

### Orders
- `GET /api/orders` - Lista naloga s filterima
- `GET /api/orders/{uid}` - Detalji naloga
- `GET /dashboard` - Orders dashboard UI

### Configuration
- `GET /api/config/delivery-types` - Lista dozvoljenih vrsta isporuke
- `POST /api/config/delivery-types` - Dodaj vrstu isporuke
- `GET /config/delivery-types` - UI za upravljanje

### Regions
- `GET /api/regions` - Lista regija
- `POST /api/regions` - Kreiraj regiju
- `GET /config/regions` - UI za upravljanje

### Logistics
- `GET /api/logistics/rules` - Lista logističkih pravila
- `POST /api/logistics/rules` - Kreiraj pravilo
- `GET /config/logistics` - UI za upravljanje

## Scheduler

Aplikacija automatski sinkronizira podatke:

- **Artikli**: Dnevno u 02:00
- **Nalozi**: Svako 20 minuta

## Business Rules

### Filtriranje Naloga

Samo naloge s dozvoljenim vrstama isporuke se spremaju u bazu:
- VDK
- B2BD
- VDK-SLO
- B2BD-SLO

Lista se može upravljati kroz UI (`/config/delivery-types`).

### Logistička Pravila

Pravila se evaluiraju po prioritetu:
1. Regija
2. Grupa artikla
3. Masa (min/max)
4. Volumen (min/max)

Rezultat: Tip vozila (KAMION/KOMBI)

## Development

### Pokretanje u development modu

```bash
# U .env postavi
DEBUG=True
```

### Kreiranje novih migracija

```bash
alembic revision --autogenerate -m "description"
alembic upgrade head
```

## License

Proprietary
