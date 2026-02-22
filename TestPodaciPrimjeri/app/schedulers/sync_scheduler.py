"""
APScheduler jobs za sinkronizaciju ERP podataka
"""
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from datetime import datetime, date, timedelta
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.services.erp_client import get_erp_client
from app.services.filter_service import DeliveryFilterService
from app.models.erp_models import (
    Artikli, GrupeArtikala, NaloziHeader, NaloziDetails, Partneri, PartneriAtributi
)
from app.services.aggregation_service import AggregationService
from app.services.region_service import RegionService
from app.services.logistics_service import LogisticsService
from app.services.optimo_mapper import OptimoMapper
from app.config import settings
import logging

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def sync_artikli(start_offset: int = 0):
    """
    Sinkronizira artikle iz ERP-a.
    Pokreće se dnevno u 02:00.
    
    Args:
        start_offset: Offset od kojeg počinje sinkronizacija (za nastavak)
    """
    logger.info(f"Starting artikli sync from offset {start_offset}...")
    print(f"\n{'='*60}")
    print(f"Započinje sinkronizacija artikala (offset: {start_offset})")
    print(f"{'='*60}\n")
    
    db: Session = SessionLocal()
    erp_client = get_erp_client()
    
    try:
        offset = start_offset
        # Pokušaj s većim batch size-om, ali ako ne radi, smanji
        limit = 1000  # Povećano sa 100 na 1000
        total_synced = 0
        batch_count = 0
        processed_grupe = set()  # Track processed grupe to avoid duplicates
        max_retries = 3  # Maksimalan broj pokušaja za svaki batch
        batch_size_reduced = False  # Track if we've reduced batch size
        
        consecutive_failures = 0  # Track consecutive batch failures
        max_consecutive_failures = 5  # Stop after 5 consecutive failures
        
        while True:
            # Fetch artikli batch with retry logic
            artikli_data = None
            retry_count = 0
            batch_failed = False
            
            while retry_count < max_retries:
                try:
                    artikli_data = await erp_client.get_artikli_list(offset=offset, limit=limit)
                    consecutive_failures = 0  # Reset on success
                    break  # Success, exit retry loop
                except Exception as e:
                    retry_count += 1
                    error_msg = str(e)
                    logger.warning(f"Error fetching batch at offset {offset} (attempt {retry_count}/{max_retries}): {error_msg}")
                    print(f"⚠️  Greška pri dohvaćanju batch-a (offset {offset}, pokušaj {retry_count}/{max_retries})")
                    print(f"   Detalji: {error_msg[:200]}")
                    
                    if retry_count < max_retries:
                        import asyncio
                        await asyncio.sleep(2)  # Wait 2 seconds before retry
                    else:
                        batch_failed = True
                        consecutive_failures += 1
                        logger.error(f"Failed to fetch batch at offset {offset} after {max_retries} attempts. Skipping...")
                        print(f"❌ Preskačem batch na offsetu {offset} nakon {max_retries} neuspjelih pokušaja")
                        
                        # Try reducing batch size if we haven't already and if limit > 100
                        if not batch_size_reduced and limit > 100 and consecutive_failures >= 2:
                            old_limit = limit
                            limit = 100  # Reduce to smaller batch size
                            batch_size_reduced = True
                            consecutive_failures = 0  # Reset counter
                            logger.info(f"Reducing batch size from {old_limit} to {limit} due to failures")
                            print(f"📉 Smanjujem batch size sa {old_limit} na {limit} zbog grešaka")
                            break  # Retry with smaller batch size
                        
                        # If too many consecutive failures, stop
                        if consecutive_failures >= max_consecutive_failures:
                            print(f"\n⚠️  Previše uzastopnih grešaka ({consecutive_failures}). Zaustavljam sinkronizaciju.")
                            print(f"   Možeš nastaviti od offseta: {offset}")
                            raise Exception(f"Too many consecutive batch failures ({consecutive_failures}). Last offset: {offset}")
                        
                        # Skip this batch and continue to next
                        offset += limit
                        break  # Exit retry loop, continue to next batch
            
            # If batch failed after all retries, skip to next batch
            if batch_failed:
                continue
            
            # If no data returned (empty response), we're done
            if not artikli_data or len(artikli_data) == 0:
                print(f"\n✅ Sinkronizacija završena - nema više podataka (offset: {offset})")
                break
            
            batch_count += 1
            batch_start_time = datetime.now()
            
            logger.info(f"Processing batch {batch_count} (offset {offset}, {len(artikli_data)} artikli)")
            print(f"\n📦 Batch {batch_count} - Offset: {offset}, Artikala: {len(artikli_data)}")
            
            batch_synced = 0
            for artikl_data in artikli_data:
                try:
                    # Extract grupa info
                    grupa_uid = artikl_data.get("grupa_artikla_uid")
                    grupa_kod = artikl_data.get("grupa_artikla")
                    
                    # Upsert GrupeArtikala (only once per grupa_uid)
                    if grupa_uid and grupa_kod and grupa_uid not in processed_grupe:
                        grupa = db.query(GrupeArtikala).filter(
                            GrupeArtikala.grupa_artikla_uid == grupa_uid
                        ).first()
                        
                        if not grupa:
                            grupa = GrupeArtikala(
                                grupa_artikla_uid=grupa_uid,
                                grupa_artikla=grupa_kod,
                                grupa_artikla_naziv=artikl_data.get("grupa_artikla_naziv"),
                                nadgrupa_artikla=artikl_data.get("nadgrupa_artikla"),
                                nadgrupa_artikla_naziv=artikl_data.get("nadgrupa_artikla_naziv"),
                                supergrupa_artikla=artikl_data.get("supergrupa_artikla"),
                                supergrupa_artikla_naziv=artikl_data.get("supergrupa_artikla_naziv")
                            )
                            db.add(grupa)
                        else:
                            # Update existing
                            grupa.grupa_artikla_naziv = artikl_data.get("grupa_artikla_naziv")
                            grupa.nadgrupa_artikla = artikl_data.get("nadgrupa_artikla")
                            grupa.nadgrupa_artikla_naziv = artikl_data.get("nadgrupa_artikla_naziv")
                            grupa.supergrupa_artikla = artikl_data.get("supergrupa_artikla")
                            grupa.supergrupa_artikla_naziv = artikl_data.get("supergrupa_artikla_naziv")
                        
                        processed_grupe.add(grupa_uid)
                        db.flush()  # Flush to ensure grupa is saved before artikl references it
                    
                    # Upsert Artikli
                    artikl_uid = artikl_data.get("artikl_uid")
                    if not artikl_uid:
                        continue
                    
                    artikl = db.query(Artikli).filter(
                        Artikli.artikl_uid == artikl_uid
                    ).first()
                    
                    if not artikl:
                        artikl = Artikli(artikl_uid=artikl_uid)
                        db.add(artikl)
                    
                    # Update all fields
                    for key, value in artikl_data.items():
                        if hasattr(artikl, key) and key != "artikl_uid":
                            setattr(artikl, key, value)
                    
                    if grupa_uid:
                        artikl.grupa_artikla_uid = grupa_uid
                    
                    total_synced += 1
                    batch_synced += 1
                    
                    # Print progress every 500 artikli
                    if total_synced % 500 == 0:
                        logger.info(f"Progress: {total_synced} artikli synced so far...")
                        print(f"  ✓ Sinkronizirano: {total_synced} artikala...")
                    
                except Exception as e:
                    logger.error(f"Error syncing artikl {artikl_data.get('artikl_uid')}: {e}")
                    db.rollback()
                    continue
            
            db.commit()
            batch_time = (datetime.now() - batch_start_time).total_seconds()
            logger.info(f"Batch {batch_count} completed. Total synced: {total_synced} artikli")
            print(f"  ✅ Batch {batch_count} završen - {batch_synced} artikala ({batch_time:.1f}s)")
            print(f"  📊 Ukupno sinkronizirano: {total_synced} artikala")
            
            # Check if we got less than limit (last page)
            if len(artikli_data) < limit:
                print(f"\n✅ Sinkronizacija završena - dohvaćeno manje od {limit} artikala (zadnja stranica)")
                break
            
            offset += limit
        
        print(f"\n{'='*60}")
        print(f"✅ Sinkronizacija artikala završena!")
        print(f"   Ukupno batch-eva: {batch_count}")
        print(f"   Ukupno artikala: {total_synced}")
        print(f"{'='*60}\n")
        logger.info(f"Artikli sync completed: {total_synced} artikli synced in {batch_count} batches")
        
    except Exception as e:
        logger.error(f"Error in artikli sync: {e}")
        print(f"\n❌ Greška u sinkronizaciji: {e}")
        print(f"   Možeš nastaviti od offseta: {offset}")
        db.rollback()
        raise
    finally:
        db.close()
        await erp_client.close()


async def sync_nalozi():
    """
    Sinkronizira naloge iz ERP-a.
    Pokreće se svako 20 minuta.
    """
    logger.info("Starting nalozi sync...")
    db: Session = SessionLocal()
    erp_client = get_erp_client()
    
    try:
        # Date range: today and next 30 days
        datum_od = date.today()
        datum_do = date.today() + timedelta(days=30)
        
        # Statusi: 08, 101, 102, 103
        statusi = ["08", "101", "102", "103"]
        
        # Fetch headers
        nalozi_headers = await erp_client.get_nalozi_headers(
            statusi=statusi,
            datum_od=datum_od,
            datum_do=datum_do
        )
        
        logger.info(f"Fetched {len(nalozi_headers)} nalozi headers from ERP")
        
        # Filter by allowed delivery types
        allowed_nalozi = await DeliveryFilterService.filter_allowed_nalozi(nalozi_headers, db)
        
        logger.info(f"After filtering: {len(allowed_nalozi)} allowed nalozi")
        
        # Get UIDs for details and partners
        nalog_uids = [n.get("nalog_prodaje_uid") for n in allowed_nalozi if n.get("nalog_prodaje_uid")]
        partner_sifre = list(set([n.get("partner") for n in allowed_nalozi if n.get("partner")]))
        
        # Fetch details and partners concurrently
        nalog_details_map = await erp_client.fetch_multiple_nalozi_details(
            nalog_uids, 
            max_concurrent=settings.SYNC_CONCURRENCY
        )
        
        partner_map = await erp_client.fetch_multiple_partners(
            partner_sifre,
            max_concurrent=settings.SYNC_CONCURRENCY
        )
        
        # Process each nalog
        synced_count = 0
        for nalog_header in allowed_nalozi:
            try:
                nalog_uid = nalog_header.get("nalog_prodaje_uid")
                if not nalog_uid:
                    continue
                
                # Upsert NaloziHeader
                nalog = db.query(NaloziHeader).filter(
                    NaloziHeader.nalog_prodaje_uid == nalog_uid
                ).first()
                
                if not nalog:
                    nalog = NaloziHeader(nalog_prodaje_uid=nalog_uid)
                    db.add(nalog)
                
                # Update header fields
                for key, value in nalog_header.items():
                    if hasattr(nalog, key) and key != "nalog_prodaje_uid" and key != "stavke":
                        # Handle date fields
                        if key in ["datum", "rezervacija_do_datuma", "raspored"] and value:
                            try:
                                if isinstance(value, str):
                                    # Parse date string (format: "15.1.2026" or "17.01.2026.")
                                    value = value.strip().rstrip(".")
                                    value = datetime.strptime(value, "%d.%m.%Y").date()
                                setattr(nalog, key, value)
                            except Exception as e:
                                logger.warning(f"Error parsing date {key}={value}: {e}")
                        elif key == "rezervacija_od_datuma" and value:
                            try:
                                if isinstance(value, str):
                                    # Parse datetime string
                                    value = value.strip().rstrip(".")
                                    value = datetime.strptime(value, "%d.%m.%Y. %H:%M:%S")
                                setattr(nalog, key, value)
                            except Exception as e:
                                logger.warning(f"Error parsing datetime {key}={value}: {e}")
                        else:
                            # Truncate na_uvid if too long
                            if key == "na_uvid" and value and len(str(value)) > 255:
                                value = str(value)[:255]
                            setattr(nalog, key, value)
                
                # Validate required fields before commit
                if not nalog.vrsta_isporuke:
                    logger.warning(f"Nalog {nalog_uid} has no vrsta_isporuke, skipping")
                    db.rollback()
                    continue
                
                db.flush()
                
                # Process details if available
                nalog_details = nalog_details_map.get(nalog_uid)
                if nalog_details and "stavke" in nalog_details:
                    # Delete existing stavke
                    db.query(NaloziDetails).filter(
                        NaloziDetails.nalog_prodaje_uid == nalog_uid
                    ).delete()
                    
                    # Insert new stavke
                    for stavka_data in nalog_details.get("stavke", []):
                        stavka_uid = stavka_data.get("stavka_uid")
                        if not stavka_uid:
                            continue
                        
                        stavka = NaloziDetails(
                            stavka_uid=stavka_uid,
                            nalog_prodaje_uid=nalog_uid
                        )
                        
                        for key, value in stavka_data.items():
                            if hasattr(stavka, key) and key != "stavka_uid" and key != "nalog_prodaje_uid":
                                # Skip relationship attributes
                                from sqlalchemy.orm import RelationshipProperty
                                attr = getattr(type(stavka), key, None)
                                if attr is not None and isinstance(attr.property, RelationshipProperty):
                                    continue
                                
                                # Validate artikl_uid foreign key - set to None if artikl doesn't exist
                                if key == "artikl_uid" and value:
                                    artikl_exists = db.query(Artikli).filter(
                                        Artikli.artikl_uid == value
                                    ).first()
                                    if not artikl_exists:
                                        logger.warning(f"Artikl {value} not found in database, setting artikl_uid to None for stavka {stavka_uid}")
                                        value = None
                                
                                setattr(stavka, key, value)
                        
                        db.add(stavka)
                
                # Process partner if available
                partner_sifra = nalog_header.get("partner")
                if partner_sifra and partner_sifra in partner_map:
                    partner_data = partner_map[partner_sifra]
                    if partner_data:
                        partner_uid = partner_data.get("partner_uid")
                        if partner_uid:
                            # Upsert Partneri
                            partner = db.query(Partneri).filter(
                                Partneri.partner_uid == partner_uid
                            ).first()
                            
                            if not partner:
                                partner = Partneri(partner_uid=partner_uid)
                                db.add(partner)
                            
                            # Update partner fields
                            for key, value in partner_data.items():
                                if hasattr(partner, key) and key != "partner_uid" and key != "atributi":
                                    setattr(partner, key, value)
                            
                            db.flush()
                            
                            # Process atributi
                            if "atributi" in partner_data:
                                # Delete existing atributi
                                db.query(PartneriAtributi).filter(
                                    PartneriAtributi.partner_uid == partner_uid
                                ).delete()
                                
                                # Insert new atributi
                                for atribut_data in partner_data.get("atributi", []):
                                    atribut = PartneriAtributi(
                                        partner_uid=partner_uid
                                    )
                                    
                                    for key, value in atribut_data.items():
                                        if hasattr(atribut, key) and key != "partner_uid":
                                            setattr(atribut, key, value)
                                    
                                    db.add(atribut)
                
                # Set partner_uid as string, not object
                if partner_sifra and partner_sifra in partner_map:
                    partner_data = partner_map[partner_sifra]
                    if partner_data:
                        partner_uid_str = partner_data.get("partner_uid")
                        if partner_uid_str:
                            nalog.partner_uid = str(partner_uid_str)  # Ensure it's a string
                
                db.commit()
                
                # Calculate totals
                AggregationService.update_nalog_totals(nalog_uid, db)
                
                # Assign region
                if partner_sifra and partner_sifra in partner_map:
                    partner_data = partner_map[partner_sifra]
                    if partner_data and partner_data.get("postanski_broj"):
                        RegionService.assign_region_to_nalog(
                            nalog_uid,
                            partner_data.get("postanski_broj"),
                            db
                        )
                
                # Determine vehicle type
                LogisticsService.determine_vehicle_type(nalog_uid, db)
                
                # Generate OptimoRoute payload
                OptimoMapper.save_payload(nalog_uid, db)
                
                synced_count += 1
                
            except Exception as e:
                import traceback
                logger.error(f"Error syncing nalog {nalog_header.get('nalog_prodaje_uid')}: {e}")
                logger.error(traceback.format_exc())
                db.rollback()
                continue
        
        logger.info(f"Nalozi sync completed: {synced_count} nalozi synced")
        
    except Exception as e:
        logger.error(f"Error in nalozi sync: {e}")
        db.rollback()
    finally:
        db.close()
        await erp_client.close()


def start_scheduler():
    """Start APScheduler with configured jobs"""
    if scheduler.running:
        logger.warning("Scheduler already running")
        return
    
    # Artikli sync - daily at configured time
    scheduler.add_job(
        sync_artikli,
        CronTrigger(
            hour=settings.ARTIKLI_SYNC_HOUR,
            minute=settings.ARTIKLI_SYNC_MINUTE
        ),
        id="sync_artikli",
        name="Sync Artikli from ERP",
        replace_existing=True
    )
    
    # Nalozi sync - every N minutes
    scheduler.add_job(
        sync_nalozi,
        IntervalTrigger(minutes=settings.SYNC_INTERVAL_MINUTES),
        id="sync_nalozi",
        name="Sync Nalozi from ERP",
        replace_existing=True
    )
    
    scheduler.start()
    logger.info("Scheduler started with jobs: sync_artikli, sync_nalozi")
