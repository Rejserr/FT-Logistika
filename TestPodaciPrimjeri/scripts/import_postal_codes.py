"""
Import script za Posta_mjesta.csv
Auto-kreira regije na temelju županija i mapira poštanske brojeve
"""
import sys
import os
import csv
from pathlib import Path

# Add parent directory to path
root_dir = Path(__file__).parent.parent
sys.path.insert(0, str(root_dir))

# Load .env file from root directory
from dotenv import load_dotenv
env_path = root_dir / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path)
    print(f"Loaded .env from: {env_path}")
else:
    print(f"Warning: .env file not found at {env_path}")

from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.regional_models import Regije, PostanskiBrojevi
from app.services.region_service import RegionService
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def extract_postal_code(postanski_ured: str) -> str:
    """
    Ekstraktira poštanski broj iz "Postanski_ured" kolone.
    Format: "10000" -> "10000"
    """
    if not postanski_ured:
        return None

    digits_only = "".join(ch for ch in postanski_ured if ch.isdigit())
    if not digits_only:
        return None
    return digits_only[:5]


def import_postal_codes(csv_path: str = None):
    """
    Importuje poštanske brojeve iz CSV datoteke.
    
    Format CSV:
    Postanski_ured;Mjesto;Zupanija
    
    Auto-kreira regije na temelju županija.
    """
    # Default paths to try
    if csv_path is None:
        possible_paths = [
            "Posta_mjesta.csv",
            "data/Posta_mjesta.csv",
            os.path.join(os.path.dirname(__file__), "..", "Posta_mjesta.csv"),
            os.path.join(os.path.dirname(__file__), "..", "data", "Posta_mjesta.csv")
        ]
        for path in possible_paths:
            if os.path.exists(path):
                csv_path = path
                break
        if csv_path is None:
            logger.error("CSV file not found. Please specify path or place Posta_mjesta.csv in root or data/ directory")
            return
    
    db: Session = SessionLocal()
    
    try:
        # Check if file exists
        if not os.path.exists(csv_path):
            logger.error(f"CSV file not found: {csv_path}")
            return
        
        logger.info(f"Reading CSV file: {csv_path}")
        
        # Read CSV
        imported_count = 0
        skipped_count = 0
        
        with open(csv_path, 'r', encoding='utf-8-sig') as f:
            # Try to detect delimiter
            first_line = f.readline()
            f.seek(0)
            
            delimiter = ';' if ';' in first_line else ','
            
            reader = csv.DictReader(f, delimiter=delimiter)
            
            for row in reader:
                try:
                    postanski_ured = row.get('Postanski_ured', '').strip()
                    mjesto = row.get('Mjesto', '').strip()
                    zupanija = row.get('Zupanija', '').strip()
                    
                    if not postanski_ured:
                        skipped_count += 1
                        continue
                    
                    # Extract postal code
                    postanski_broj = extract_postal_code(postanski_ured)
                    if not postanski_broj:
                        skipped_count += 1
                        continue
                    
                    # Get or create regija (županija)
                    regija = None
                    if zupanija:
                        regija = db.query(Regije).filter(
                            Regije.naziv_regije == zupanija
                        ).first()
                        
                        if not regija:
                            regija = RegionService.create_region(
                                naziv_regije=zupanija,
                                opis=f"Auto-kreirano iz CSV importa",
                                db=db
                            )
                    
                    # Check if postal code + mjesto combination already exists
                    existing = db.query(PostanskiBrojevi).filter(
                        PostanskiBrojevi.postanski_broj == postanski_broj,
                        PostanskiBrojevi.mjesto == mjesto
                    ).first()
                    
                    if existing:
                        # Update regija if needed
                        if regija and existing.regija_id != regija.regija_id:
                            existing.regija_id = regija.regija_id if regija else None
                    else:
                        # Create new (can have multiple mjesta with same postal code)
                        postal = PostanskiBrojevi(
                            postanski_broj=postanski_broj,
                            mjesto=mjesto if mjesto else None,
                            regija_id=regija.regija_id if regija else None
                        )
                        db.add(postal)
                    
                    imported_count += 1
                    
                    # Commit every 100 records
                    if imported_count % 100 == 0:
                        db.commit()
                        logger.info(f"Imported {imported_count} records...")
                
                except Exception as e:
                    logger.error(f"Error processing row {row}: {e}")
                    db.rollback()  # Rollback transaction on error
                    skipped_count += 1
                    continue
        
        # Final commit
        db.commit()
        
        logger.info(f"Import completed:")
        logger.info(f"  - Imported: {imported_count} postal codes")
        logger.info(f"  - Skipped: {skipped_count} rows")
        
        # Show statistics
        total_regije = db.query(Regije).count()
        total_postal = db.query(PostanskiBrojevi).count()
        
        logger.info(f"  - Total regije in DB: {total_regije}")
        logger.info(f"  - Total postal codes in DB: {total_postal}")
        
    except Exception as e:
        logger.error(f"Error importing postal codes: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    import_postal_codes()
