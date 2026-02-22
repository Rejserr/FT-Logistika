import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))
os.chdir('backend')
from app.db.session import engine
from sqlalchemy import text

with engine.connect() as conn:
    try:
        conn.execute(text("ALTER TABLE nalozi_header ADD manual_paleta INT NULL"))
        conn.commit()
        print("Column manual_paleta added to nalozi_header")
    except Exception as e:
        if "already" in str(e).lower() or "duplicate" in str(e).lower():
            print("Column already exists")
        else:
            raise e
