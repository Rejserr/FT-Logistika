# FT-Logistika – Upute za korištenje

Dokumentacija za korisnike aplikacije FT-Logistika: vodič po stranicama i opis baze podataka.

---

## 1. Uvod i pokretanje aplikacije

### Što je FT-Logistika?

FT-Logistika je aplikacija za planiranje ruta dostave. Omogućuje:
- sinkronizaciju naloga s ERP sustavom (Luceed),
- kreiranje i optimizaciju ruta dostave,
- upravljanje vozilima, vozačima, regijama i postavkama.

### Pokretanje

1. **Backend (API)**  
   U mapi `backend` pokrenite:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
   API je dostupan na: `http://localhost:8000`  
   Interaktivna dokumentacija: `http://localhost:8000/docs`

2. **Frontend**  
   U mapi `frontend` pokrenite:
   ```bash
   npm run dev
   ```
   Aplikacija se otvara na: `http://localhost:5173`

3. **Baza podataka**  
   Koristi se SQL Server baza `FTLogistika`. Prije prvog korištenja pokrenite migracije:
   ```bash
   cd backend
   alembic upgrade head
   ```
   Opcionalno: učitajte početne podatke (uloge, prioriteti, zone, tipovi vozila):
   ```bash
   python scripts/seed_data.py
   ```

---

## 2. Navigacija

U lijevom bočnom izborniku (Sidebar) nalaze se stavke:

| Stavka       | Putanja   | Opis                                      |
|--------------|-----------|-------------------------------------------|
| **Dashboard**| `/`       | Pregled statistika i brzi linkovi         |
| **Nova ruta**| `/routing`| Kreiranje nove rute (odabir naloga, vozila, algoritma) |
| **Rute**     | `/routes` | Lista svih ruta i povijest                 |
| **Nalozi**   | `/orders` | Pregled naloga i sinkronizacija s ERP-om   |
| **Vozila**   | `/vehicles`| Vozila i vozači (CRUD)                    |
| **Regije**   | `/regions`| Regije i poštanski brojevi (CRUD)          |
| **Postavke** | `/settings`| Opće postavke i prioriteti isporuke       |

Klik na stavku otvara odgovarajuću stranicu.

---

## 3. Stranica: Dashboard (`/`)

### Namjena

Pregled stanja sustava i brzi pristup glavnim radnjama.

### Što se prikazuje

- **Kartice statistika** (gore):
  - **Ukupno naloga** – broj naloga u sustavu
  - **Aktivna vozila** – broj aktivnih vozila
  - **Rute danas** – broj ruta za danas (ili prema filteru)

- **Zadnji nalozi** – tablica s nekoliko najnovijih naloga (broj, partner, status).

- **Aktivne rute** – kratki pregled nedavnih ruta (ID, datum, status, broj stopova).

### Akcije

- **Sinkroniziraj nalozi** – pokreće sinkronizaciju naloga s ERP-om. Nalozi se dohvaćaju u pozadini; nakon završetka pojavit će se novi/ ažurirani nalozi na stranici Nalozi.

### Korištenje

- Za ažuriranje broja naloga: prvo pokrenite sinkronizaciju, zatim osvježite ili pričekajte da se podaci osvježe.
- Klik na **Nova ruta** vodi na kreiranje rute, na **Rute** na listu ruta.

---

## 4. Stranica: Nova ruta (`/routing`)

### Namjena

Odabir naloga i vozila te kreiranje nove rute s odabranim algoritmom optimizacije.

### Raspored stranice

- **Lijevo** – lista vozila (VehicleList).
- **Sredina** – lista naloga s filterima i odabirom (OrderList).
- **Desno** – mapa (MapView); nakon kreiranja rute prikazuje stopove i liniju rute.

### Opcije i radnje

**1. Odabir vozila (lijevo)**  
- Prikazana su aktivna vozila (oznaka, tip, nosivost, volumen).  
- Klikom odaberite jedno vozilo za rutu (opcionalno; možete kreirati rutu i bez vozila).

**2. Odabir naloga (sredina)**  
- **Filteri**: status naloga, datum od/do, pretraga po tekstu.  
- **Checkbox** uz svaki nalog – označite sve naloge koji će ući u rutu.  
- Možete odabrati više naloga; redoslijed će (osim kod “Ručni”) odrediti algoritam.

**3. Algoritam (gore desno)**  
Padajući izbornik **Algoritam**:

- **Nearest Neighbor** – brz; uvijek odabire najbliži sljedeći stop. Preporučuje se za brzo planiranje.
- **OR-Tools (VRP)** – naprednija optimizacija; uzima u obzir kapacitete vozila (nosivost, volumen) i sl. Preporučuje se kada je važan kapacitet.
- **Ručni redoslijed** – redoslijed stopova ostaje onakav kakav ste odabrali (bez optimizacije).

**4. Kreiraj rutu**  
- Gumb **Kreiraj rutu (N)** – N je broj odabranih naloga.  
- Mora biti odabran barem jedan nalog.  
- Nakon uspješnog kreiranja otvara se stranica **Detalji rute** za novu rutu.

### Mapa

- Ako nije kreirana ruta: prikazuje se poruka da treba odabrati naloge i kreirati rutu.  
- Nakon kreiranja rute (ili nakon odlaska na Detalje rute): na karti se prikazuju depot (zeleni marker), numerirani stopovi i linija rute. Klik na marker može istaknuti odgovarajući stop u listi.

---

## 5. Stranica: Rute – povijest (`/routes`)

### Namjena

Pregled svih kreiranih ruta i filtriranje po statusu i datumu.

### Opcije

- **Status** – filter: Svi statusi / Nacrt / Planirano / U tijeku / Završeno / Otkazano.
- **Datum od** i **Datum do** – raspon datuma za prikaz ruta.
- **Poništi** – briše filtere.

### Tablica

Za svaku rutu prikazuje se: ID, datum, status, algoritam, broj stopova, udaljenost (km), trajanje (min).

### Akcije

- **Detalji** – otvara stranicu s detaljima rute (`/routes/{id}`).
- **Nova ruta** – preusmjerava na `/routing`.

---

## 6. Stranica: Detalji rute (`/routes/:routeId`)

### Namjena

Pregled jedne rute, uređivanje redoslijeda stopova, promjena statusa, export i brisanje.

### Informacije o ruti (lijevo)

- Status, algoritam, vozilo, udaljenost, trajanje, broj stopova.

### Lista stopova (lijevo, ispod)

- Stopovi su numerirani prema redoslijedu.  
- **Povuci-i-ispusti (drag & drop)** – povucite red da biste promijenili redoslijed; promjena se šalje na backend.  
- Klik na stop ga istakne; na mapi se može istaknuti odgovarajući marker.

### Mapa (desno)

- Prikaz depota, stopova i linije rute (kao na stranici Nova ruta kada je ruta aktivna).

### Akcije (gore)

- **Povratak** – natrag na listu ruta.  
- **Re-optimiziraj** – ponovna optimizacija redoslijeda (dostupno za status Nacrt).  
- **Potvrdi rutu** – status Nacrt → Planirano.  
- **Pokreni dostavu** – status Planirano → U tijeku.  
- **Završi rutu** – status U tijeku → Završeno.  
- **Excel** / **PDF** – preuzimanje izvještaja rute (lista stopova, ETA, partneri).  
- **Obriši** – brisanje rute (nakon potvrde).

### Statusi rute

- **Nacrt (DRAFT)** – ruta je kreirana, još se može mijenjati i optimizirati.  
- **Planirano (PLANNED)** – potvrđena, spremna za izvršenje.  
- **U tijeku (IN_PROGRESS)** – dostava je pokrenuta.  
- **Završeno (COMPLETED)** – ruta je završena.  
- **Otkazano (CANCELLED)** – ruta je otkazana.

---

## 7. Stranica: Nalozi (`/orders`)

### Namjena

Pregled naloga dohvaćenih iz ERP-a i ručno pokretanje sinkronizacije.

### Filteri

- **Pretraga** – po UID-u naloga, partneru, broju dokumenta.  
- **Status** – Novi / U obradi / Spreman / Dostavljen / Otkazano.  
- **Datum od** / **Datum do** – raspon datuma.

### Tablica naloga

Prikaz: Nalog UID, Broj dokumenta, Partner, Datum, Iznos, Status.  
Klik na red naloga otvara **detalje naloga** u desnom panelu.

### Detalji naloga (desno)

- Nalog UID, broj dokumenta, partner, datumi, status, napomena.  
- Iznosi: ukupno bez PDV-a, PDV, ukupno s PDV-om.  
- Stavke narudžbe (artikl, količina, cijena, iznos).

### Akcije

- **Sinkroniziraj s ERP-om** – pokreće dohvat/ ažuriranje naloga iz Luceed ERP-a. Sinkronizacija se izvršava u pozadini.

---

## 8. Stranica: Vozila (`/vehicles`)

### Namjena

Upravljanje tipovima vozila, vozilima i vozačima (CRUD).

### Tabovi

**1. Vozila**  
- Tablica: Oznaka, Tip, Nosivost (kg), Volumen (m³), Status (Aktivan/Neaktivan).  
- **Novo vozilo** – otvara obrazac: oznaka, tip vozila, nosivost, volumen, aktivno/neaktivno.  
- **Uredi** – ažuriranje postojećeg vozila.  
- **Obriši** – brisanje vozila (nakon potvrde).

**2. Vozači**  
- Tablica: Ime i prezime, Telefon, Vozilo (opcionalno), Status.  
- **Novi vozač** – obrazac: ime, prezime, telefon, vozilo (opcionalno), aktivan.  
- **Uredi** / **Obriši** – kao kod vozila.

Tipovi vozila (npr. “Dostavno vozilo”, “Kamion”) unose se u Postavkama ili putem API-ja i odabiru se pri dodavanju vozila.

---

## 9. Stranica: Regije (`/regions`)

### Namjena

Upravljanje regijama i poštanskim brojevima za potrebe planiranja i dodjele naloga.

### Učitavanje regija (CSV / XLSX)

Gumb **Učitaj regije (CSV/XLSX)** omogućuje masovni import regija i poštanskih brojeva iz datoteke.

**Format datoteke** (prvi red = zaglavlje):
- **Postanski_broj** – poštanski broj (npr. 10000)
- **Mjesto** – naziv mjesta/grada (npr. Zagreb, Sljeme)
- **regija** – naziv regije (npr. ZAGREBAČKA)

Primjer (CSV s separatorom tab, ; ili ,):
```
Postanski_broj	Mjesto	regija
10000	Sljeme	ZAGREBAČKA
10000	Zagreb	ZAGREBAČKA
10010	Buzin	ZAGREBAČKA
```

**Ponašanje:** Ako regija s danim nazivom ne postoji, kreira se. Za svaki red kreira se ili ažurira zapis u tablici poštanskih brojeva (par *poštanski broj + mjesto* je jedinstven). Nakon importa prikazuje se sažetak: broj novih/postajećih regija i novih/ažuriranih poštanskih brojeva.

### Tabovi

**1. Regije**  
- Tablica: Naziv, Status.  
- **Nova regija** – naziv, aktivna/neaktivna.  
- **Uredi** / **Obriši** – standardni CRUD.

**2. Poštanski brojevi**  
- Pretraga po poštanskom broju ili nazivu mjesta.  
- Tablica: Poštanski broj, Mjesto, Regija.  
- **Novi poštanski broj** – poštanski broj, naziv mjesta, regija.  
- **Uredi** / **Obriši** – CRUD.

Regije i poštanski brojevi koriste se za dodjelu regije nalogu (npr. pri sinkronizaciji s ERP-om na temelju poštanskog broja partnera).

---

## 10. Stranica: Postavke (`/settings`)

### Namjena

Konfiguracija sustava i upravljanje prioritetima isporuke.

### Tabovi

**1. Opće postavke**  
Polja (ključevi) koje možete postaviti učitavaju se s poslužitelja. Primjeri:

- **Vrijeme servisa (min)** – prosječno vrijeme isporuke po stopu.  
- **Max stopova po ruti** – maksimalan broj stopova na jednoj ruti.  
- **Interval sinkronizacije (min)** – interval automatske sinkronizacije (ako je implementirano).  
- **Paralelna sinkronizacija** – broj paralelnih zahtjeva pri syncu.  
- **Default algoritam** – zadani algoritam (npr. nearest_neighbor ili ortools).  
- **Depot latitude / longitude** – GPS koordinata skladišta (depota).

Neka polja mogu biti prazna dok ih ne konfigurirate.  
**Spremi promjene** – šalje sve vrijednosti na poslužitelj (bulk update).

**2. Prioriteti**  
- Tablica: Naziv, Težina, Status (Aktivan/Neaktivan).  
- **Novi prioritet** – naziv, težina (npr. 0–100; viša = veći prioritet), aktivan.  
- **Uredi** / **Obriši** – CRUD.

Prioriteti se mogu koristiti za označavanje važnosti naloga (npr. hitna dostava) i u budućim verzijama za sortiranje ili prioritizaciju u optimizaciji.

---

## 11. Toast notifikacije

Aplikacija koristi “toast” poruke u gornjem desnom kutu:

- **Zelena (success)** – uspješna radnja (npr. “Ruta kreirana”, “Postavke spremljene”).  
- **Crvena (error)** – greška (npr. neuspjela sinkronizacija ili kreiranje rute).  
- **Žuta (warning)** – upozorenje (npr. “Odaberite barem jedan nalog”).  
- **Plava (info)** – informativna poruka.

Poruke se automatski sakrivaju nakon nekoliko sekundi; možete ih zatvoriti i ručno (X).

---

## 12. Opis tablica u SQL Serveru i veze između tablica

Baza podataka: **FTLogistika**. Tablice su kreirane Alembic migracijama.

### Pregled tablica i veza

- **Strelica (→)** označava stranu na kojoj je strani ključ (npr. `rute_stops.ruta_id → rute.id`).

---

### Konfiguracija i korisnici

| Tablica    | Opis | Veze |
|-----------|------|------|
| **settings** | Key-value postavke sustava (npr. DEFAULT_SERVICE_TIME_MINUTES, DEPOT_LAT). | Nema stranih ključeva. |
| **prioriteti** | Prioriteti isporuke (naziv, težina, aktivan). | Koristi se u **nalozi_header** (prioritet_id). |
| **roles** | Uloge korisnika (npr. admin, dispatcher). | Povezana s **users** preko **user_roles**. |
| **users** | Korisnici sustava (username, lozinka, ime, prezime, email). | → **user_roles** (user_id). |
| **user_roles** | Više-prema-više: koji korisnik ima koju ulogu. | user_id → **users**.id, role_id → **roles**.id. |
| **audit_log** | Zapisnik radnji (akcija, entitet, entity_id, data). | user_id → **users**.id (opcionalno). |

---

### Regije i zone

| Tablica    | Opis | Veze |
|-----------|------|------|
| **regije** | Geografske regije (naziv, opis, aktivan). | Koristi se u **postanski_brojevi** (regija_id) i **nalozi_header** (regija_id). |
| **postanski_brojevi** | Poštanski brojevi, naziv mjesta (grad/mjesto) i povezivanje s regijom. Jedinstveni par: (postanski_broj, naziv_mjesta). | regija_id → **regije**.id. |
| **zone** | Zone dostave (naziv, opis, aktivan). | Koristi se u **zone_izvori** (zona_id). |
| **zone_izvori** | Povezivanje zone s izvorom (depot/store). | zona_id → **zone**.id; izvor_id referira skladište (bez FK u migraciji). |

---

### ERP podaci (partneri, artikli, nalozi, vrste isporuke)

| Tablica    | Opis | Veze |
|-----------|------|------|
| **vrste_isporuke** | Vrste isporuke koje se koriste za filtriranje pri sync-u (vrsta_isporuke, opis, aktivan). Inicijalne vrijednosti: B2BD, B2BD-SLO, VDK, VDK-SLO. | Samostalna tablica - služi za filtriranje naloga. |
| **partneri** | Partneri (kupci/dobavljači) iz Luceed ERP-a. **Primarni ključ: partner_uid**. Sva polja mapirana iz API poziva `/datasnap/rest/partneri/sifra/{sifra}` - uključuje kontakt podatke, adresu, financijske podatke, grupacije, komercijalista, i sl. | Referira ga **nalozi_header**.partner_uid. |
| **artikli** | Artikli iz ERP-a (UID, šifra, naziv, grupa, masa, volumen). | Primarni ključ artikl_uid; referira ga **nalozi_details**.artikl_uid. |
| **skladista** | Skladišta/depoti (naziv, adresa, mjesto, lat, lng, tip, aktivan). | Nema stranih ključeva; **rute**.izvor_id može referirati skladista.id. |
| **nalozi_header** | Zaglavlja naloga prodaje iz Luceed ERP-a. **Primarni ključ: nalog_prodaje_uid**. Sva polja mapirana iz API poziva `/datasnap/rest/NaloziProdaje/uid/{uid}`. Polje **raspored** = datum isporuke. Interna polja: regija_id, vozilo_tip, total_weight, total_volume, synced_at. | partner_uid → **partneri**.partner_uid; regija_id → **regije**.id. |
| **nalozi_details** | Stavke naloga prodaje iz Luceed ERP-a. **Primarni ključ: stavka_uid**. Sva polja mapirana iz "stavke" array unutar naloga (artikl, količina, pakiranja, cijena, rabat, redoslijed...). | nalog_prodaje_uid → **nalozi_header**.nalog_prodaje_uid; artikl_uid → **artikli**.artikl_uid. |

---

### Vozila i vozači

| Tablica    | Opis | Veze |
|-----------|------|------|
| **vozila_tip** | Tipovi vozila (naziv, opis, aktivan). | Koristi se u **vozila** (tip_id). |
| **vozila** | Vozila (oznaka, naziv, tip, nosivost_kg, volumen_m3, aktivan). | tip_id → **vozila_tip**.id; referira ga **rute**.vozilo_id. |
| **vozaci** | Vozači (ime, prezime, telefon, email, aktivan). | Referira ga **rute**.vozac_id. |

---

### Rute

| Tablica    | Opis | Veze |
|-----------|------|------|
| **rute** | Ruta dostave (datum, status, algoritam, vozilo, vozač, izvor, udaljenost_km, trajanje_min). | vozilo_id → **vozila**.id; vozac_id → **vozaci**.id. izvor_id opcionalno referira **skladista**.id. |
| **rute_stops** | Stopovi na ruti (redoslijed, nalog_uid, ETA, status). | ruta_id → **rute**.id; nalog_uid → **nalozi_header**.nalog_prodaje_uid. |
| **rute_polylines** | Polyline rute (encoded linija, udaljenost, trajanje). | ruta_id → **rute**.id. |

---

### Sinkronizacija i cache

| Tablica    | Opis | Veze |
|-----------|------|------|
| **sync_log** | Zapisnik sinkronizacija (entitet, status, poruka, started_at, finished_at). | Nema stranih ključeva. |
| **geocoding_cache** | Cache geocodinga (address_hash, adresa, lat, lng, provider). | Nema stranih ključeva. |
| **distance_matrix_cache** | Cache udaljenosti/vremena (origin_hash, dest_hash, distance_m, duration_s, provider). | Nema stranih ključeva. |

---

### Shema veza (sažeto)

```
settings          (samostalna)
prioriteti        (samostalna)
roles             (samostalna)
users             (samostalna)  ← user_roles.user_id, audit_log.user_id
user_roles        → users, roles
audit_log         → users

regije            (samostalna)  ← postanski_brojevi.regija_id, nalozi_header.regija_id
postanski_brojevi → regije
zone              (samostalna)  ← zone_izvori.zona_id
zone_izvori       → zone

vrste_isporuke     (samostalna) - koristi se za filtriranje pri sync-u naloga

partneri           (samostalna, PK partner_uid)  ← nalozi_header.partner_uid
artikli            (samostalna, PK artikl_uid)   ← nalozi_details.artikl_uid
skladista          (samostalna)  ← referencira ju rute.izvor_id

nalozi_header      (PK nalog_prodaje_uid) → partneri, regije  ← nalozi_details, rute_stops
nalozi_details     (PK stavka_uid) → nalozi_header, artikli

vozila_tip         (samostalna)  ← vozila.tip_id
vozila             → vozila_tip  ← rute.vozilo_id
vozaci             (samostalna)  ← rute.vozac_id

rute               → vozila, vozaci  ← rute_stops.ruta_id, rute_polylines.ruta_id
rute_stops         → rute, nalozi_header
rute_polylines     → rute

sync_log           (samostalna)
geocoding_cache    (samostalna)
distance_matrix_cache (samostalna)
```

---

---

## 8. Sinkronizacija s ERP sustavom i WMS-om

### 8.1 Pregled sustava

FT-Logistika se sinkronizira s dva vanjska sustava:

| Sustav | Tip veze | Svrha |
|--------|----------|-------|
| **Luceed ERP** | REST API (HTTP) | Nalozi prodaje, partneri, artikli |
| **Mantis WMS** | SQL Server (direktna veza) | SSCC/paletni podaci za slaganje robe |

Sve sinkronizacije pokreću se **ručno** iz Settings → Sinkronizacija ili automatski (lazy sync za WMS).

---

### 8.2 Sinkronizacija naloga (`sync_orders`)

**Svrha:** Puni import naloga prodaje iz Luceed ERP-a.

**Pokretanje:** Settings → Sinkronizacija → "Pokreni sync naloga"

**API:** `POST /api/sync/orders`

**Parametri:**
- `statusi` — Statusi naloga za import (default: `["08", "101", "102", "103"]`)
- `datum_od` — Početni datum (default: danas - 30 dana)
- `datum_do` — Krajnji datum (default: danas)

**ERP endpointi koji se pozivaju:**

| Endpoint | Svrha |
|----------|-------|
| `GET /NaloziProdaje/statusi/[{statusi}]/{datum_od}/{datum_do}` | Dohvat headera naloga |
| `GET /NaloziProdaje/uid/{uid}` | Dohvat detalja pojedinog naloga |
| `GET /partneri/sifra/{sifra}` | Dohvat partnera po šifri |

**Tablice koje se ažuriraju:**

| Tablica | Operacija |
|---------|-----------|
| `partneri` | Upsert (kreiranje ili ažuriranje) |
| `nalozi_header` | Upsert |
| `nalozi_details` | Upsert |

**Flow:**
1. Dohvati dozvoljene `vrsta_isporuke` iz tablice `vrste_isporuke` (samo aktivne)
2. Pozovi ERP za headere naloga prema statusima i datumima
3. Filtriraj naloge po `vrsta_isporuke`
4. Za svaki nalog:
   - Dohvati detalje (header + stavke) iz ERP-a
   - Upsert partner u lokalnu bazu (kreiraj stub ako ne postoji)
   - Upsert header — dodijeli `regija_id` na temelju poštanskog broja partnera
   - Upsert stavke — validira da `artikl_uid` postoji u tablici `artikli`
   - Preračunaj `total_weight` i `total_volume` iz stavki
5. Zapiši rezultat u `sync_log`

**Posebnosti:**
- Filtrira po `vrsta_isporuke` (samo aktivne vrste isporuke se importiraju)
- Automatski dodjeljuje `regija_id` iz poštanskog broja partnera
- Validira `artikl_uid` prije povezivanja stavki
- Throttle: 0.05s pauza između ERP poziva

---

### 8.3 Osvježavanje naloga (`refresh_orders`)

**Svrha:** Osvježava naloge u statusu '08' (Odobreno) s najnovijim podacima iz ERP-a. Detektira promjene i logira ih.

**Pokretanje:** Settings → Sinkronizacija → "Osvježi naloge"

**API:** `POST /api/sync/refresh-orders`

**Parametri:**
- `datum_od` — Od kojeg datuma dohvatiti promjene (default: danas - 7 dana)

**ERP endpointi:**

| Endpoint | Svrha |
|----------|-------|
| `GET /NaloziProdaje/IzmjenaStatus/{datum}` | Dohvat izmijenjenih naloga |
| `GET /partneri/uid/{uid}` | Ažuriranje partnera |

**Tablice koje se ažuriraju:**

| Tablica | Operacija |
|---------|-----------|
| `nalozi_header` | Update promijenjenih polja |
| `partneri` | Update ako se promijenio partner |
| `refresh_log` | Insert zapisa o promjenama |

**Flow:**
1. Dohvati listu izmijenjenih naloga iz ERP-a
2. Za svaki nalog:
   - Provjeri postoji li lokalno I je li u statusu '08'
   - Usporedi polja — detektiraj promjene
   - Ažuriraj header
   - Zapiši promjene u `refresh_log` (tip: HEADER) — JSON sa starim/novim vrijednostima
   - Provjeri i ažuriraj partnera ako se promijenio
   - Zapiši promjene partnera u `refresh_log` (tip: PARTNER)
   - Ažuriraj `regija_id` ako se promijenio poštanski broj

**Praćenje promjena:**
Svaka promjena se bilježi u tablici `refresh_log`:
```
polja_promijenjena: ["status", "napomena"]
stare_vrijednosti: {"status": "08", "napomena": ""}
nove_vrijednosti: {"status": "101", "napomena": "Hitno"}
```

---

### 8.4 Sinkronizacija artikala (`sync_artikli`)

**Svrha:** Bulk import svih artikala iz ERP-a u lokalnu bazu.

**Pokretanje:** Settings → Sinkronizacija → "Pokreni sync artikala"

**API:** `POST /api/sync/artikli`

**ERP endpoint:**

| Endpoint | Svrha |
|----------|-------|
| `GET /artikli/lista/[{offset},{limit}]` | Paginirana lista artikala (batch: 1000) |

**Tablice koje se ažuriraju:**

| Tablica | Operacija |
|---------|-----------|
| `grupe_artikala` | Upsert grupa |
| `artikli` | Upsert artikala |

**Flow:**
1. Izračunaj offset od postojećeg broja artikala (resume ako je prethodni sync prekinut)
2. Petlja dok ima rezultata:
   - Dohvati batch od 1000 artikala iz ERP-a
   - Upsert grupe artikala (deduplikacija unutar batcha)
   - Upsert artikle
   - Commit po batchu
3. Zapiši rezultat u `sync_log`

**Posebnosti:**
- Resume funkcionalnost (nastavlja od gdje je stao)
- Batch obrada (1000 artikala po batchu)
- Timeout: 180s za velike batcheve

---

### 8.5 Mantis WMS sinkronizacija (SSCC/palete)

**Svrha:** Dohvat podataka o složenoj robi (paletama/koletama) iz Mantis WMS sustava.

**Pokretanje:** Automatski (lazy sync) ili ručno

**API:**

| Endpoint | Metoda | Svrha |
|----------|--------|-------|
| `POST /api/mantis/sync` | POST | Ručni pokretanje WMS sync-a |
| `GET /api/mantis/order/{nalog_uid}` | GET | Dohvat SSCC podataka za jedan nalog |
| `POST /api/mantis/orders/bulk` | POST | Bulk dohvat za više naloga |

**Izvor podataka:** SQL Server view `v_CST_OrderProgress` (read-only) na Mantis serveru.

**Lokalna tablica:** `mantis_sscc`

**Kako radi SSCC logika:**
- `SSCC = NULL` → roba još nije složena
- Isti `SSCC` na više stavki → više artikala na jednoj paleti
- Različiti `SSCC` kodovi → više paleta za nalog
- Broj **različitih (DISTINCT) SSCC** kodova = **broj paleta**

**Lazy sync:**
- Automatski se pokreće kad se otvori detalj naloga na OrdersPage
- Provjerava svježinu cache-a (5 minuta)
- Ako je cache stariji od 5 min, automatski osvježava iz WMS-a
- Radi i za bulk dohvat na RoutingPage (za odabrane naloge)

**Polja koja se sinkroniziraju:**

| Polje | Opis |
|-------|------|
| `OrderCode` | Kod naloga u WMS-u (format: `{broj}-{skladiste}`) |
| `Product` | Naziv artikla |
| `Quantity` | Količina |
| `ItemStatus` | Status stavke u WMS-u (npr. "30 - For picking") |
| `SSCC` | Kod palete/koleta |
| `PSSCC` | Parent SSCC |
| `Zone`, `Location` | Skladišna zona i lokacija |

---

### 8.6 Log sinkronizacije

Svaka sync operacija se prati u tablici `sync_log`:

| Polje | Opis |
|-------|------|
| `id` | Identifikator sync operacije |
| `entity` | Tip: "orders", "refresh_orders", "partners", "artikli" |
| `status` | QUEUED → RUNNING → COMPLETED / FAILED |
| `message` | Detalji rezultata (npr. "Kreirano: 50, Ažurirano: 100, Greške: 0") |
| `started_at` | Vrijeme pokretanja |
| `finished_at` | Vrijeme završetka |

**Status provjera:** `GET /api/sync/status/{sync_id}` — Frontend pollira svake 3 sekunde dok je sync aktivan.

---

### 8.7 Konfiguracija veza

#### Luceed ERP (REST API)

| Postavka | Opis |
|----------|------|
| `ERP_BASE_URL` | URL ERP servera (default: `http://10.10.2.203:3616`) |
| `ERP_USERNAME` | Korisničko ime za Basic Auth |
| `ERP_PASSWORD` | Lozinka za Basic Auth |

Autentikacija: HTTP Basic Auth

#### Mantis WMS (SQL Server)

| Postavka | Opis |
|----------|------|
| `MANTIS_DB_SERVER` | Hostname/IP WMS servera |
| `MANTIS_DB_NAME` | Baza podataka (default: `LVision`) |
| `MANTIS_DB_USERNAME` | Korisničko ime (default: `mantis`) |
| `MANTIS_DB_PASSWORD` | Lozinka |
| `MANTIS_DB_DRIVER` | ODBC driver (default: `ODBC Driver 17 for SQL Server`) |

Veza je **read-only** — aplikacija nikad ne piše u Mantis bazu.

#### Lokalna baza (SQL Server)

| Postavka | Opis |
|----------|------|
| `DB_SERVER` | Hostname/IP lokalnog SQL Servera |
| `DB_NAME` | Baza podataka: `FTLogistika` |
| `DB_USERNAME` | Korisničko ime |
| `DB_PASSWORD` | Lozinka |

---

### 8.8 Dijagram toka podataka

```
┌─────────────────────────────────────────────────────────────┐
│                     LUCEED ERP (REST API)                    │
│  NaloziProdaje, Partneri, Artikli                           │
└───────────────────────┬─────────────────────────────────────┘
                        │ HTTP (Basic Auth)
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    FT-LOGISTIKA BACKEND                      │
│                                                             │
│  sync_orders ──→ partneri, nalozi_header, nalozi_details    │
│  refresh_orders ──→ nalozi_header, partneri, refresh_log    │
│  sync_artikli ──→ artikli, grupe_artikala                   │
│                                                             │
│  Routing flow:                                               │
│  nalozi_header ──→ nalozi_header_rutiranje ──→ rute_stops   │
│                                              ──→ nalozi_header_arhiva │
│                                                             │
│  mantis_service ──→ mantis_sscc (cache)                     │
└──────────┬──────────────────────────────────────────────────┘
           │ SQL Server (read-only)
           ▼
┌─────────────────────────────────────────────────────────────┐
│                    MANTIS WMS (SQL Server)                    │
│  v_CST_OrderProgress (SSCC, palete, statusi slaganja)       │
└─────────────────────────────────────────────────────────────┘
```

---

### 8.9 Greške i oporavak

| Situacija | Ponašanje |
|-----------|-----------|
| ERP nedostupan | Sync FAILED, poruka greške u `sync_log` |
| Pojedinačni nalog ne uspije | Preskače se, nastavlja s ostalima, broji greške |
| Mantis WMS nedostupan | Lazy sync tiho pada, prikazuje stari cache |
| Prekid sync-a artikala | Sljedeći pokušaj nastavlja od zadnjeg uspješnog batcha |
| Dupli partner/nalog | Upsert — ažurira postojeći umjesto duplikata |
| Nepoznat `artikl_uid` u stavci | Stavka se preskače, logira se upozorenje |

---

### 8.10 Pregled svih sync operacija

| Operacija | Izvor | Odredište | Automatski | Učestalost |
|-----------|-------|-----------|------------|------------|
| Sync naloga | Luceed ERP → | `partneri`, `nalozi_header`, `nalozi_details` | Ne | Ručno |
| Osvježi naloge | Luceed ERP → | `nalozi_header`, `partneri`, `refresh_log` | Ne | Ručno |
| Sync partnera | (Radi se kroz sync naloga) | `partneri` | Ne | Ručno |
| Sync artikala | Luceed ERP → | `artikli`, `grupe_artikala` | Ne | Ručno |
| WMS SSCC sync | Mantis WMS → | `mantis_sscc` | Da (lazy) | Auto 5 min cache |
| Arhiviranje | Lokalno | `nalozi_header_arhiva`, `nalozi_details_arhiva` | Da | Auto pri završetku rute |

---

*Dokument je ažuriran prema stanju aplikacije FT-Logistika. Za tehničke detalje API-ja koristite `/docs` na backendu.*
