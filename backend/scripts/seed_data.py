"""
Seed script za inicijalne podatke u FTLogistika bazi.

Pokreni iz backend/ direktorija:
    python -m scripts.seed_data

Ili kroz Python:
    from scripts.seed_data import seed_all
    seed_all()
"""
import sys
from pathlib import Path

# Dodaj backend/ u path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.config_models import Prioritet, Setting
from app.models.erp_models import Skladiste
from app.models.regional_models import Regija, Zona, ZonaIzvor
from app.models.user_models import Role
from app.models.vehicle_models import VoziloTip


def seed_roles(db: Session) -> None:
    """Seed uloge korisnika."""
    roles = [
        {"id": 1, "name": "Admin"},
        {"id": 2, "name": "Disponent"},
        {"id": 3, "name": "Vozač"},
        {"id": 4, "name": "Viewer"},
    ]
    for r in roles:
        existing = db.get(Role, r["id"])
        if not existing:
            db.add(Role(**r))
    db.commit()
    print(f"[OK] Uloge: {len(roles)} uneseno/provjereno")


def seed_prioriteti(db: Session) -> None:
    """Seed prioriteti naloga."""
    prioriteti = [
        {"naziv": "Hitno", "tezina": 100, "aktivan": True},
        {"naziv": "Visoki", "tezina": 75, "aktivan": True},
        {"naziv": "Normalan", "tezina": 50, "aktivan": True},
        {"naziv": "Niski", "tezina": 25, "aktivan": True},
    ]
    for p in prioriteti:
        existing = db.query(Prioritet).filter(Prioritet.naziv == p["naziv"]).first()
        if not existing:
            db.add(Prioritet(**p))
    db.commit()
    print(f"[OK] Prioriteti: {len(prioriteti)} uneseno/provjereno")


def seed_regije(db: Session) -> None:
    """Seed regije za Hrvatsku."""
    regije = [
        {"naziv": "Zagreb i okolica", "opis": "Grad Zagreb i Zagrebačka županija"},
        {"naziv": "Sjeverna Hrvatska", "opis": "Varaždinska, Međimurska, Koprivničko-križevačka"},
        {"naziv": "Slavonija", "opis": "Osječko-baranjska, Vukovarsko-srijemska, Brodsko-posavska, Požeško-slavonska, Virovitičko-podravska"},
        {"naziv": "Primorje i Istra", "opis": "Primorsko-goranska, Istarska"},
        {"naziv": "Dalmacija", "opis": "Splitsko-dalmatinska, Dubrovačko-neretvanska, Šibensko-kninska, Zadarska"},
        {"naziv": "Središnja Hrvatska", "opis": "Sisačko-moslavačka, Karlovačka, Bjelovarsko-bilogorska, Krapinsko-zagorska"},
        {"naziv": "Lika i Gorski kotar", "opis": "Ličko-senjska"},
    ]
    for r in regije:
        existing = db.query(Regija).filter(Regija.naziv == r["naziv"]).first()
        if not existing:
            db.add(Regija(**r))
    db.commit()
    print(f"[OK] Regije: {len(regije)} uneseno/provjereno")


def seed_zone(db: Session) -> None:
    """Seed zone dostave."""
    zone = [
        {"naziv": "Zona Zagreb", "opis": "Dostava iz centralnog skladišta Zagreb"},
        {"naziv": "Zona Rijeka", "opis": "Dostava iz skladišta Rijeka"},
        {"naziv": "Zona Split", "opis": "Dostava iz skladišta Split"},
        {"naziv": "Zona lokalne trgovine", "opis": "Dostava iz najbliže trgovine"},
    ]
    for z in zone:
        existing = db.query(Zona).filter(Zona.naziv == z["naziv"]).first()
        if not existing:
            db.add(Zona(**z))
    db.commit()
    print(f"[OK] Zone: {len(zone)} uneseno/provjereno")


def seed_skladista(db: Session) -> None:
    """Seed skladišta i trgovine."""
    skladista = [
        {
            "naziv": "Centralno skladište Zagreb",
            "adresa": "Industrijska cesta 1",
            "mjesto": "Zagreb",
            "postanski_broj": "10000",
            "drzava": "Hrvatska",
            "lat": 45.8150,
            "lng": 15.9819,
            "tip": "central",
            "aktivan": True,
        },
        {
            "naziv": "Skladište Rijeka",
            "adresa": "Lučka ulica 10",
            "mjesto": "Rijeka",
            "postanski_broj": "51000",
            "drzava": "Hrvatska",
            "lat": 45.3271,
            "lng": 14.4422,
            "tip": "central",
            "aktivan": True,
        },
        {
            "naziv": "Skladište Split",
            "adresa": "Kopilica bb",
            "mjesto": "Split",
            "postanski_broj": "21000",
            "drzava": "Hrvatska",
            "lat": 43.5081,
            "lng": 16.4402,
            "tip": "central",
            "aktivan": True,
        },
        {
            "naziv": "Trgovina Dubrovnik",
            "adresa": "Vukovarska 45",
            "mjesto": "Dubrovnik",
            "postanski_broj": "20000",
            "drzava": "Hrvatska",
            "lat": 42.6507,
            "lng": 18.0944,
            "tip": "store",
            "aktivan": True,
        },
        {
            "naziv": "Trgovina Osijek",
            "adresa": "Trg Ante Starčevića 1",
            "mjesto": "Osijek",
            "postanski_broj": "31000",
            "drzava": "Hrvatska",
            "lat": 45.5550,
            "lng": 18.6955,
            "tip": "store",
            "aktivan": True,
        },
    ]
    for s in skladista:
        existing = db.query(Skladiste).filter(Skladiste.naziv == s["naziv"]).first()
        if not existing:
            db.add(Skladiste(**s))
    db.commit()
    print(f"[OK] Skladista/trgovine: {len(skladista)} uneseno/provjereno")


def seed_zone_izvori(db: Session) -> None:
    """Poveži zone sa skladištima."""
    # Dohvati zone i skladišta
    zona_zg = db.query(Zona).filter(Zona.naziv == "Zona Zagreb").first()
    zona_ri = db.query(Zona).filter(Zona.naziv == "Zona Rijeka").first()
    zona_st = db.query(Zona).filter(Zona.naziv == "Zona Split").first()

    skl_zg = db.query(Skladiste).filter(Skladiste.naziv == "Centralno skladište Zagreb").first()
    skl_ri = db.query(Skladiste).filter(Skladiste.naziv == "Skladište Rijeka").first()
    skl_st = db.query(Skladiste).filter(Skladiste.naziv == "Skladište Split").first()

    izvori = []
    if zona_zg and skl_zg:
        izvori.append({"zona_id": zona_zg.id, "izvor_tip": "depot", "izvor_id": skl_zg.id})
    if zona_ri and skl_ri:
        izvori.append({"zona_id": zona_ri.id, "izvor_tip": "depot", "izvor_id": skl_ri.id})
    if zona_st and skl_st:
        izvori.append({"zona_id": zona_st.id, "izvor_tip": "depot", "izvor_id": skl_st.id})

    for iz in izvori:
        existing = db.query(ZonaIzvor).filter(
            ZonaIzvor.zona_id == iz["zona_id"],
            ZonaIzvor.izvor_id == iz["izvor_id"],
        ).first()
        if not existing:
            db.add(ZonaIzvor(**iz))
    db.commit()
    print(f"[OK] Zone izvori: {len(izvori)} uneseno/provjereno")


def seed_vozila_tipovi(db: Session) -> None:
    """Seed tipovi vozila."""
    tipovi = [
        {"naziv": "Kombi", "opis": "Mali dostavni kombi do 1.5t"},
        {"naziv": "Kamion 3.5t", "opis": "Srednji kamion do 3.5t"},
        {"naziv": "Kamion 7.5t", "opis": "Veći kamion do 7.5t"},
        {"naziv": "Šleper", "opis": "Tegljač s poluprikolicom"},
    ]
    for t in tipovi:
        existing = db.query(VoziloTip).filter(VoziloTip.naziv == t["naziv"]).first()
        if not existing:
            db.add(VoziloTip(**t))
    db.commit()
    print(f"[OK] Tipovi vozila: {len(tipovi)} uneseno/provjereno")


def seed_settings(db: Session) -> None:
    """Seed globalne postavke."""
    settings_data = [
        {"key": "map_provider", "value": "leaflet"},
        {"key": "geocoding_provider", "value": "google"},
        {"key": "default_time_window_start", "value": "08:00"},
        {"key": "default_time_window_end", "value": "17:00"},
        {"key": "max_stops_per_route", "value": "30"},
        {"key": "default_service_time_minutes", "value": "10"},
    ]
    for s in settings_data:
        existing = db.get(Setting, s["key"])
        if not existing:
            db.add(Setting(**s))
    db.commit()
    print(f"[OK] Postavke: {len(settings_data)} uneseno/provjereno")


def seed_all() -> None:
    """Pokreni sve seed funkcije."""
    print("=" * 50)
    print("FT-Logistika: Seed podataka")
    print("=" * 50)

    with SessionLocal() as db:
        seed_roles(db)
        seed_prioriteti(db)
        seed_regije(db)
        seed_zone(db)
        seed_skladista(db)
        seed_zone_izvori(db)
        seed_vozila_tipovi(db)
        seed_settings(db)

    print("=" * 50)
    print("[OK] Seed podataka zavrseno!")
    print("=" * 50)


if __name__ == "__main__":
    seed_all()
