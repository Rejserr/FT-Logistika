# POD — Proof of Delivery & Luceed DocumentManager integracija

## Sadržaj

1. [Pregled sustava](#1-pregled-sustava)
2. [Tok podataka](#2-tok-podataka)
3. [Pohrana datoteka (lokalno)](#3-pohrana-datoteka-lokalno)
4. [FT-Logistika API endpointi (backend)](#4-ft-logistika-api-endpointi-backend)
5. [Luceed DocumentManager API](#5-luceed-documentmanager-api)
6. [Format slanja u Luceed ERP](#6-format-slanja-u-luceed-erp)
7. [Baza podataka](#7-baza-podataka)
8. [Web aplikacija (frontend)](#8-web-aplikacija-frontend)
9. [Konfiguracija](#9-konfiguracija)

---

## 1. Pregled sustava

POD (Proof of Delivery) sustav omogućuje:

- **Mobilna aplikacija** — vozač fotografira dostavu i/ili potpisuje na licu mjesta
- **Backend** — sprema datoteke lokalno, bilježi metapodatke u bazu
- **Web aplikacija** — pregled svih POD zapisa, detalji naloga, slike, ručno slanje u ERP
- **Luceed ERP** — dokumenti se šalju u Luceed DocumentManager putem REST API-ja

---

## 2. Tok podataka

```
Vozač (mobitel)                    Web aplikacija               Luceed ERP
     |                                  |                          |
     |  POST /api/driver/stop/{id}/pod  |                          |
     |  (multipart: photos, signature)  |                          |
     |--------------------------------->|                          |
     |                                  |                          |
     |         Sprema datoteke lokalno  |                          |
     |         uploads/pod/{nalog}.jpg  |                          |
     |         Zapisuje u delivery_proofs|                          |
     |                                  |                          |
     |                    Korisnik klikne "Pošalji u Luceed"       |
     |                                  |                          |
     |                POST /api/pod/send-to-luceed/{pod_id}        |
     |                                  |------------------------->|
     |                                  | POST DocumentManager/snimi
     |                                  | (Base64 encoded content)  |
     |                                  |                          |
     |                                  |<-------------------------|
     |                                  |  {"result": ["file_uid"]}|
     |                                  |                          |
     |                  Bilježi luceed_sent_at u bazu              |
```

---

## 3. Pohrana datoteka (lokalno)

Datoteke se spremaju u flat strukturu bez podfoldera:

```
backend/uploads/pod/
├── 17766393-2928.jpg           # prva/jedina fotografija (nalog_prodaje_uid.ext)
├── 17766393-2928_2.jpg         # druga fotografija (ako ih ima više)
├── 17766393-2928_3.jpg         # treća fotografija
├── 17766393-2928_potpis.png    # potpis vozača
├── 17772968-2928.jpg
└── ...
```

### Konvencija imenovanja

| Tip datoteke         | Format imena                           | Primjer                    |
|----------------------|----------------------------------------|----------------------------|
| Prva fotografija     | `{nalog_prodaje_uid}.{ext}`            | `17766393-2928.jpg`        |
| Dodatne fotografije  | `{nalog_prodaje_uid}_{n}.{ext}`        | `17766393-2928_2.jpg`      |
| Potpis               | `{nalog_prodaje_uid}_potpis.{ext}`     | `17766393-2928_potpis.png` |

> **Napomena:** `nalog_prodaje_uid` je u formatu `{broj}-{šifra_skladišta}` (npr. `17766393-2928`).

---

## 4. FT-Logistika API endpointi (backend)

Base URL: `http://{server}:8000/api`

### 4.1. Upload POD-a (mobilna app)

```
POST /api/driver/stop/{stop_id}/pod
Content-Type: multipart/form-data
Authorization: Bearer {token}
```

**Parametri (form-data):**

| Polje            | Tip        | Obavezno | Opis                      |
|------------------|------------|----------|---------------------------|
| `photos`         | File[]     | Ne       | Fotografije dostave       |
| `signature`      | File       | Ne       | Potpis primatelja         |
| `recipient_name` | string     | Ne       | Ime primatelja            |
| `comment`        | string     | Ne       | Komentar vozača           |
| `gps_lat`        | float      | Ne       | GPS latitude              |
| `gps_lng`        | float      | Ne       | GPS longitude             |

**Odgovor:**

```json
{
  "pod_id": 1,
  "stop_id": 42,
  "nalog_uid": "17766393-2928",
  "status": "DELIVERED",
  "route_completed": false,
  "signature_path": "pod/17766393-2928_potpis.png",
  "photo_paths": ["pod/17766393-2928.jpg"],
  "message": "Proof of delivery zabilježen."
}
```

### 4.2. Lista POD zapisa

```
GET /api/pod/list?q={search}&ruta_id={id}&limit=50&offset=0
Authorization: Cookie (access_token)
```

| Parametar | Tip    | Opis                                              |
|-----------|--------|----------------------------------------------------|
| `q`       | string | Pretraga po nalog_prodaje_uid ili broj-skladište   |
| `ruta_id` | int    | Filtriranje po ruti                                |
| `limit`   | int    | Max rezultata (default: 50, max: 200)              |
| `offset`  | int    | Offset za paginaciju                               |

### 4.3. Detalj POD-a

```
GET /api/pod/detail/{pod_id}
Authorization: Cookie (access_token)
```

Vraća kompletne podatke: nalog header, stavke naloga, partner info, URL-ove slika, GPS, komentar, status Luceed slanja.

### 4.4. Serviranje slika

```
GET /api/pod/image/{filename}
Authorization: Cookie (access_token)
```

Primjer: `GET /api/pod/image/17766393-2928.jpg`

### 4.5. Slanje u Luceed

```
POST /api/pod/send-to-luceed/{pod_id}
Authorization: Cookie (access_token)
```

**Odgovor (uspjeh):**

```json
{
  "success": true,
  "message": "Uspješno poslano 1 dokument(a) u Luceed.",
  "file_uids": ["777-42"],
  "nalog_prodaje_uid": "17766393-2928"
}
```

---

## 5. Luceed DocumentManager API

### 5.1. Dodavanje dokumenta (POST)

```
POST http://10.10.2.203:3616/datasnap/rest/DocumentManager/snimi/
Content-Type: application/json
Authorization: Basic {base64(username:password)}
```

### 5.2. Izmjena dokumenta (PUT)

```
PUT http://10.10.2.203:3616/datasnap/rest/DocumentManager/snimi/
```

### 5.3. Brisanje dokumenta (DELETE)

```
DELETE http://10.10.2.203:3616/datasnap/rest/DocumentManager/brisi/{file_uid}/{tip_veze}/
```

---

## 6. Format slanja u Luceed ERP

### 6.1. Request payload

```json
{
  "documents": [
    {
      "file_b2b": "17766393-2928",
      "luceed_doc_uid": "17766393-2928",
      "tip_veze": "NalogProdaje",
      "content": "/9j/4AAQSkZJRgABAQ...(base64 encoded)...",
      "filename": "17766393-2928.jpg",
      "naziv": "POD 17766393-2928.jpg"
    }
  ]
}
```

### 6.2. Opis polja

| Polje              | Tip         | Obavezno | Opis                                                     |
|--------------------|-------------|----------|----------------------------------------------------------|
| `file_b2b`         | VARCHAR(50) | **DA**   | PK naloga prodaje. Koristimo `nalog_prodaje_b2b` iz headera, fallback na `nalog_prodaje_uid` |
| `luceed_doc_uid`   | VARCHAR(50) | Ne       | UID naloga u Luceed-u (`nalog_prodaje_uid`)              |
| `tip_veze`         | VARCHAR(50) | Ne       | Tip veze dokumenta u Luceed-u. Za POD koristimo: **`NalogProdaje`** |
| `content`          | LongBlob    | Ne       | Datoteka enkodirana u **Base64**                         |
| `filename`         | VARCHAR(100)| **DA**   | Ime datoteke s ekstenzijom (npr. `17766393-2928.jpg`)    |
| `naziv`            | VARCHAR(200)| Ne       | Naziv/opis dokumenta                                     |
| `content_type`     | VARCHAR(20) | Ne       | Tip dokumenta: `dctImage`, `dctWord`, `dctExcel`, `dctRTF`, `dctURL` |
| `opis`             | TEXT        | Ne       | Opis datoteke                                            |
| `file_uid`         | VARCHAR(50) | Ne       | UID dokumenta (koristi se samo pri izmjeni - PUT)        |
| `luceed_doc_b2b`   | VARCHAR(50) | Ne       | PK naloga iz B2B aplikacije                              |

### 6.3. Dozvoljene vrijednosti za `tip_veze`

```
Null, NalogProizvodnje, VPRacun, NalogProdaje, NalogPovrata,
Ponuda, MPRacun, Kalkulacije, User, Skl, Partneri, Artikli,
URA, Narudzba, CRM, Aparat, Ticket, KalkulacijaProizvodnje,
Xfer, StatusNalogaProdaje, Status Narudzbe, RadniNalogServisa
```

### 6.4. Response

```json
{
  "result": ["777-42"]
}
```

Vraća listu `file_uid` vrijednosti za kreirane dokumente.

### 6.5. Primjer kompletnog poziva (curl)

```bash
curl -X POST \
  "http://10.10.2.203:3616/datasnap/rest/DocumentManager/snimi/" \
  -H "Content-Type: application/json" \
  -u "username:password" \
  -d '{
    "documents": [
      {
        "file_b2b": "17766393-2928",
        "luceed_doc_uid": "17766393-2928",
        "tip_veze": "NalogProdaje",
        "content": "/9j/4AAQSkZJRgABAQAAAQABAAD...",
        "filename": "17766393-2928.jpg",
        "naziv": "POD 17766393-2928.jpg"
      }
    ]
  }'
```

---

## 7. Baza podataka

### Tablica: `delivery_proofs`

| Kolona              | Tip            | Opis                                     |
|---------------------|----------------|------------------------------------------|
| `id`                | INT (PK)       | Auto-increment                           |
| `stop_id`           | INT (FK)       | Referenca na `rute_stops.id`             |
| `driver_user_id`    | INT (FK)       | Referenca na `users.id`                  |
| `nalog_prodaje_uid` | NVARCHAR(50)   | UID naloga prodaje (npr. `17766393-2928`)|
| `signature_path`    | NVARCHAR(500)  | Relativni put do potpisa                 |
| `photo_path`        | NVARCHAR(500)  | Relativni put do prve fotografije        |
| `photo_paths`       | NVARCHAR(MAX)  | JSON array svih puteva fotografija       |
| `recipient_name`    | NVARCHAR(200)  | Ime primatelja                           |
| `comment`           | TEXT           | Komentar vozača                          |
| `gps_lat`           | DECIMAL(18,8)  | GPS latitude                             |
| `gps_lng`           | DECIMAL(18,8)  | GPS longitude                            |
| `created_at`        | DATETIME       | Datum kreiranja                          |
| `luceed_sent_at`    | DATETIME       | Datum slanja u Luceed (NULL = nije slano)|

### Primjer upita

```sql
-- Svi POD-ovi koji nisu poslani u Luceed
SELECT dp.id, dp.nalog_prodaje_uid, dp.photo_path, dp.created_at
FROM delivery_proofs dp
WHERE dp.luceed_sent_at IS NULL;

-- POD-ovi za određenu rutu
SELECT dp.*
FROM delivery_proofs dp
JOIN rute_stops rs ON dp.stop_id = rs.id
WHERE rs.ruta_id = 1024;
```

---

## 8. Web aplikacija (frontend)

### Stranica: `/pod`

Dostupna u sidebaru pod **"POD"** (ikona 📋). Zahtijeva permisiju `routes.view`.

#### Funkcionalnosti:

| Funkcija                  | Opis                                                         |
|---------------------------|--------------------------------------------------------------|
| **Pretraga**              | Po `nalog_prodaje_uid` ili `broj-skladište`                  |
| **Lista POD-ova**         | Nalog, partner, vozač, ruta, dokumenti, Luceed status, datum |
| **Detalj POD-a**          | Klik na red otvara kompletne informacije                     |
| **Nalog info**            | Broj, datum, status, vrsta isporuke, za naplatu, težina      |
| **Partner info**          | Naziv, adresa, mjesto, kontakt, OIB                          |
| **Stavke naloga**         | Artikl, količina, JM, cijena, rabat                          |
| **Prikaz slika**          | Fotografije i potpis s lightbox prikazom (klik za uvećanje)  |
| **Pošalji u Luceed**      | Ručno slanje svih dokumenata POD-a u ERP                     |
| **Status slanja**         | Prikaz je li dokument već poslan (datum slanja)              |

---

## 9. Konfiguracija

Postavke u `.env` datoteci (backend):

```env
# Luceed ERP konekcija
ERP_BASE_URL=http://10.10.2.203:3616
ERP_USERNAME=api_korisnik
ERP_PASSWORD=api_lozinka
```

Backend automatski koristi ove postavke za:
- Basic Auth autentikaciju prema Luceed API-ju
- Konstruiranje URL-a: `{ERP_BASE_URL}/datasnap/rest/DocumentManager/snimi/`

---

## Buduće nadogradnje (TODO)

- [ ] **Automatsko slanje** — automatski poslati POD u Luceed nakon što vozač potvrdi dostavu
- [ ] **Brisanje dokumenta** — poziv `DELETE /DocumentManager/brisi/{file_uid}/{tip_veze}/`
- [ ] **Izmjena dokumenta** — poziv `PUT /DocumentManager/snimi/` s `file_uid`
- [ ] **Bulk slanje** — slanje više POD-ova odjednom
- [ ] **Retry mehanizam** — automatski retry ako Luceed nije dostupan
- [ ] **Status sync** — provjera je li dokument još u Luceed-u
