# 🗺️ PLAN ZA ROUTING SUSTAV

## 📋 Pregled

Cilj je razviti vlastiti routing sustav koji će zamijeniti OptimoRoute funkcionalnost, omogućavajući:
- Dodjeljivanje naloga vozilima
- Optimizaciju ruta za dostave
- Prikaz ruta na karti s redoslijedom dostava
- Spremanje ruta po vozilima i datumima
- Provjeru kapaciteta vozila

---

## 🎯 1. ARHITEKTURA I TEHNOLOGIJE

### Frontend (UI) Layout

```
┌─────────────┬───────────────────┬──────────────────────┐
│   Vozila    │      Nalozi       │        Karta         │
│  (Lijevo)   │    (Sredina)      │      (Desno)         │
├─────────────┼───────────────────┼──────────────────────┤
│ ☑ Kamion 1  │ ☑ Nalog #1234     │   🗺️ Google Maps /   │
│ ☐ Kamion 2  │ ☐ Nalog #1235     │    Leaflet           │
│ ☐ Kombi 1   │ ☑ Nalog #1236     │   + Polyline         │
│             │ ...               │   + Markers (1,2,3)  │
└─────────────┴───────────────────┴──────────────────────┘
```

### Tehnologije za kartu:
- **Leaflet.js** (besplatno, open-source) + OpenStreetMap
- **Google Maps API** (plaćeno, ali bolje za Hrvatsku)
- **MapBox** (kompromis - besplatno do određenog broja)

### Routing API opcije:
- **OpenRouteService** (besplatno do 2000 req/dan)
- **OSRM** (Open Source Routing Machine - može se hostati lokalno!)
- **GraphHopper** (open-source, može lokalno)
- **Google Directions API** (plaćeno, ali najpreciznije)

---

## 🏗️ 2. ARHITEKTURA BACKEND-A

```
┌─────────────────────────────────────────────┐
│           FastAPI Backend                    │
├─────────────────────────────────────────────┤
│  1. Routing Service                          │
│     - Optimizacija redoslijeda dostave       │
│     - TSP (Traveling Salesman Problem)       │
│     - Kapacitet vozila                       │
│                                              │
│  2. Geocoding Service                        │
│     - Adresa → lat/lng koordinate            │
│     - Cache (za brže učitavanje)             │
│                                              │
│  3. Map Service                              │
│     - Generiranje ruta (API pozivi)          │
│     - Spremanje ruta u bazu                  │
│                                              │
│  4. Vehicle Assignment Service               │
│     - Dodjeljivanje naloga vozilima          │
│     - Provjera kapaciteta                    │
└─────────────────────────────────────────────┘
```

---

## 💾 3. BAZA PODATAKA - NOVE TABLICE

### Rute (spremljene rute po vozilima i datumima)
```sql
CREATE TABLE Rute (
    ruta_id INT IDENTITY(1,1) PRIMARY KEY,
    vozilo_uid NVARCHAR(50) NOT NULL,
    datum_isporuke DATE NOT NULL,
    pocetak_lokacija NVARCHAR(500),  -- Gdje kreće vozilo
    pocetak_lat DECIMAL(10, 7),
    pocetak_lng DECIMAL(10, 7),
    ukupna_udaljenost_km DECIMAL(10, 2),
    procijenjeno_vrijeme_min INT,
    status NVARCHAR(50),  -- 'planirana', 'u_tijeku', 'zavrsena'
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE()
);
```

### Stavke rute (nalozi u ruti, s redoslijedom)
```sql
CREATE TABLE RuteStavke (
    ruta_stavka_id INT IDENTITY(1,1) PRIMARY KEY,
    ruta_id INT NOT NULL,
    nalog_prodaje_uid NVARCHAR(50) NOT NULL,
    redoslijed INT NOT NULL,  -- 1, 2, 3... (redoslijed dostave)
    lat DECIMAL(10, 7),
    lng DECIMAL(10, 7),
    procijenjena_udaljenost_km DECIMAL(10, 2),
    procijenjeno_vrijeme_min INT,
    stvarna_udaljenost_km DECIMAL(10, 2),
    stvarno_vrijeme_min INT,
    dostavljeno_at DATETIME2,
    FOREIGN KEY (ruta_id) REFERENCES Rute(ruta_id),
    FOREIGN KEY (nalog_prodaje_uid) REFERENCES NaloziHeader(nalog_prodaje_uid)
);
```

### Polyline data (za prikaz na karti)
```sql
CREATE TABLE RutePolylines (
    polyline_id INT IDENTITY(1,1) PRIMARY KEY,
    ruta_id INT NOT NULL,
    from_nalog_uid NVARCHAR(50),  -- Od kojeg naloga
    to_nalog_uid NVARCHAR(50),    -- Do kojeg naloga
    polyline_data NVARCHAR(MAX),  -- Encoded polyline
    udaljenost_km DECIMAL(10, 2),
    vrijeme_min INT,
    FOREIGN KEY (ruta_id) REFERENCES Rute(ruta_id)
);
```

---

## 🔄 4. ALGORITAM OPTIMIZACIJE

**Problem:** TSP (Traveling Salesman Problem) - NP-hard problem

### A) JEDNOSTAVNO (za početak) - Nearest Neighbor
```python
# Nearest Neighbor Algorithm - greedy pristup
def optimize_route_simple(start_location, delivery_locations):
    current = start_location
    unvisited = set(delivery_locations)
    route = [current]
    
    while unvisited:
        nearest = min(unvisited, key=lambda loc: distance(current, loc))
        route.append(nearest)
        current = nearest
        unvisited.remove(nearest)
    
    return route
```
**Prednosti:** Brzo, jednostavno  
**Mane:** Nije uvijek najoptimalnije (~25% lošije od optimalnog)

### B) SREDNJE (Google OR-Tools)
```python
from ortools.constraint_solver import routing_enums_pb2
from ortools.constraint_solver import pywrapcp

def optimize_route_ortools(start_location, delivery_locations, vehicle_capacity):
    # Google OR-Tools za VRP (Vehicle Routing Problem)
    # Podržava:
    # - Više vozila
    # - Kapacitete vozila
    # - Vremenska ograničenja
    # - Distance matrix
    pass
```
**Prednosti:** Jako dobro, brzo, podržava kompleksne scenarije  
**Mane:** Treba naučiti koristiti

### C) NAPREDNO (Vlastiti genetic algorithm ili Ant Colony)
- Za kasnije, kad sustav postane kompleksniji

---

## 🔄 5. WORKFLOW - KORAK PO KORAK

```
┌─────────────────────────────────────────────┐
│ 1. Korisnik odabere naloge (checkboxes)     │
└──────────────────┬──────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│ 2. Korisnik odabere vozilo iz liste         │
└──────────────────┬──────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│ 3. Backend: Geocoding adresa → koordinate   │
│    (Cache postojeće, nove šalje na Google)  │
└──────────────────┬──────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│ 4. Backend: Distance Matrix API poziv       │
│    (Udaljenosti između svih točaka)         │
└──────────────────┬──────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│ 5. Backend: Optimizacija redoslijeda        │
│    (OR-Tools ili jednostavni algoritam)     │
└──────────────────┬──────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│ 6. Backend: Directions API za svaki segment │
│    (Start → Dostava 1 → 2 → 3... → Kraj)    │
└──────────────────┬──────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│ 7. Spremanje u bazu: Rute + RuteStavke      │
└──────────────────┬──────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│ 8. Frontend: Prikaz na karti                │
│    - Polyline za rutu                       │
│    - Markers s brojevima (1, 2, 3...)       │
│    - Info: km, vrijeme, redoslijed          │
└─────────────────────────────────────────────┘
```

---

## 📅 6. FAZE RAZVOJA

### FAZA 1: MVP (Minimum Viable Product)
- ✅ UI layout (3 kolone)
- ✅ Lista vozila
- ✅ Lista naloga s checkboxima
- ✅ Dodjeljivanje naloga vozilu
- ✅ Geocoding adresa (Google Maps)
- ✅ Jednostavni routing (Nearest Neighbor)
- ✅ Prikaz na karti (Leaflet ili Google Maps)

### FAZA 2: Optimizacija
- ✅ OR-Tools integracija
- ✅ Distance Matrix API
- ✅ Optimizacija redoslijeda
- ✅ Spremanje ruta u bazu
- ✅ Pregled povijesti ruta

### FAZA 3: Kapaciteti i ograničenja
- ✅ Težina i volumen vozila
- ✅ Automatska alokacija (sustav predlaže vozilo)
- ✅ Provjera kapaciteta prije dodjeljivanja
- ✅ Multi-trip routing (jedno vozilo, više tura)

### FAZA 4: Tracking i analitika
- ✅ GPS tracking vozila (real-time)
- ✅ Odstupanja od planirane rute
- ✅ Izvještaji (km, vrijeme, troškovi)
- ✅ Optimizacija na temelju povijesnih podataka

---

## 💰 7. PROCJENA TROŠKOVA API-ja

| API | Besplatno | Cijena |
|-----|-----------|--------|
| **Google Maps Geocoding** | 40.000/mj | $5 / 1000 |
| **Google Directions** | 40.000/mj | $5 / 1000 |
| **Google Distance Matrix** | 40.000/mj | $10 / 1000 |
| **OpenRouteService** | 2000/dan | Besplatno |
| **OSRM (self-hosted)** | Unlimited | Hosting (€50/mj) |

**Preporuka za početak:** Google Maps (besplatni kredit $200/mj dovoljan za testiranje)

---

## ✅ 8. PREDNOSTI VLASTITE IMPLEMENTACIJE

- ✅ **Bez mjesečne pretplate** (OptimoRoute ~$50-200/mj)
- ✅ **Potpuna kontrola** nad algoritmima
- ✅ **Prilagodba** specifičnim potrebama (npr. prioriteti, zone)
- ✅ **Integracija** s postojećim sustavom
- ✅ **Offline mogućnosti** (s OSRM self-hosted)
- ✅ **Nema ograničenja** broja vozila/naloga

---

## 🛠️ 9. TEHNIČKI STACK

### Frontend:
- Vue.js ili React (za kompleksnu interakciju)
- Leaflet.js ili Google Maps JavaScript API
- Bootstrap 5 (postojeći)
- Drag & Drop biblioteka (za reorganizaciju ruta)

### Backend:
- FastAPI (postojeći)
- Google OR-Tools (optimizacija)
- Redis (cache za geocoding)
- Celery (async tasks za dugotrajne kalkulacije)

### API:
- Google Maps API ili OpenRouteService
- Backup: OSRM (self-hosted)

---

## 💻 10. PRIMJER KODA (Osnovni routing endpoint)

```python
@router.post("/routing/create-route")
async def create_route(
    vozilo_uid: str,
    nalog_uids: List[str],
    start_location: dict,  # {"lat": 45.8, "lng": 16.0}
    db: Session = Depends(get_db)
):
    # 1. Dohvati naloge i partnere
    nalozi = db.query(NaloziHeader).filter(
        NaloziHeader.nalog_prodaje_uid.in_(nalog_uids)
    ).all()
    
    # 2. Geocode adrese (ako već nisu)
    locations = []
    for nalog in nalozi:
        if not nalog.partner_obj.lat or not nalog.partner_obj.lng:
            # Geocode adresu
            coords = await geocode_address(nalog.partner_obj.adresa)
            nalog.partner_obj.lat = coords['lat']
            nalog.partner_obj.lng = coords['lng']
        locations.append({
            'nalog_uid': nalog.nalog_prodaje_uid,
            'lat': nalog.partner_obj.lat,
            'lng': nalog.partner_obj.lng,
            'weight': nalog.total_weight,
            'volume': nalog.total_volume
        })
    
    # 3. Optimiziraj redoslijed
    optimized = await optimize_route(start_location, locations)
    
    # 4. Generiraj detalje rute (Directions API)
    route_details = await get_route_directions(optimized)
    
    # 5. Spremi u bazu
    ruta = Rute(
        vozilo_uid=vozilo_uid,
        datum_isporuke=nalozi[0].raspored,
        pocetak_lat=start_location['lat'],
        pocetak_lng=start_location['lng'],
        ukupna_udaljenost_km=route_details['total_distance'],
        procijenjeno_vrijeme_min=route_details['total_duration']
    )
    db.add(ruta)
    db.flush()
    
    for i, stop in enumerate(optimized, 1):
        stavka = RuteStavke(
            ruta_id=ruta.ruta_id,
            nalog_prodaje_uid=stop['nalog_uid'],
            redoslijed=i,
            lat=stop['lat'],
            lng=stop['lng']
        )
        db.add(stavka)
    
    db.commit()
    
    return {
        'ruta_id': ruta.ruta_id,
        'route': optimized,
        'polyline': route_details['polyline'],
        'total_distance_km': route_details['total_distance'],
        'total_duration_min': route_details['total_duration']
    }
```

---

## 📝 11. ZAKLJUČAK I PREPORUKE

### Za početak:
1. **Faza 1 (MVP)** - 2-3 tjedna razvoja
2. Koristi **Google Maps API** (besplatni kredit)
3. **Jednostavni Nearest Neighbor** algoritam prvo
4. **Leaflet.js** za mapu (besplatno)

### Kasnije:
- Prijeđi na **OR-Tools** za bolju optimizaciju
- Dodaj **kapacitete vozila**
- Razmotri **self-hosted OSRM** za smanjenje troškova

### ROI (Return on Investment):
- OptimoRoute: ~$100/mj = $1200/god
- Vlastita implementacija: ~$300 razvoj + $50/mj hosting = ~$900 prva godina
- **Isplati se nakon 6-9 mjeseci!**

---

## 📌 BILJEŠKE

- Plan je spreman za implementaciju kada korisnik bude spreman
- Moguće je prilagoditi fazu po fazu prema potrebama
- Svi detalji su dokumentirani za lakše praćenje napretka

---

*Datum kreiranja: 2025-01-22*  
*Status: Planiranje - čeka na instrukcije za početak implementacije*
