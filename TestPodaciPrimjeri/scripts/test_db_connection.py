"""
Test script za provjeru SQL Server konekcije
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.config import settings
import pyodbc

print("Testing SQL Server connection...")
print(f"Server: {settings.DB_SERVER}")
print(f"Database: {settings.DB_NAME}")
print(f"Username: {settings.DB_USERNAME}")
print(f"Driver: {settings.DB_DRIVER}")
print()

# Check if .env is loaded
import os
env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
if os.path.exists(env_path):
    print(f"✓ .env file found at: {env_path}")
else:
    print(f"⚠ .env file NOT found at: {env_path}")
    print("  Using default values from config.py")
print()

# Try different connection string formats
# For named instance without Browser, we need TCP/IP
formats = [
    # Format 1: TCP/IP (DBMSSOCN) - works without Browser service
    f"DRIVER={{{settings.DB_DRIVER}}};SERVER={settings.DB_SERVER};DATABASE={settings.DB_NAME};UID={settings.DB_USERNAME};PWD={settings.DB_PASSWORD};Network Library=DBMSSOCN;",
    # Format 2: TCP/IP with TrustServerCertificate
    f"DRIVER={{{settings.DB_DRIVER}}};SERVER={settings.DB_SERVER};DATABASE={settings.DB_NAME};UID={settings.DB_USERNAME};PWD={settings.DB_PASSWORD};Network Library=DBMSSOCN;TrustServerCertificate=yes;",
    # Format 3: Try localhost if server name doesn't work
    f"DRIVER={{{settings.DB_DRIVER}}};SERVER=localhost\\SQLDEV;DATABASE={settings.DB_NAME};UID={settings.DB_USERNAME};PWD={settings.DB_PASSWORD};Network Library=DBMSSOCN;TrustServerCertificate=yes;",
    # Format 4: Try with . (dot) for localhost
    f"DRIVER={{{settings.DB_DRIVER}}};SERVER=.\\SQLDEV;DATABASE={settings.DB_NAME};UID={settings.DB_USERNAME};PWD={settings.DB_PASSWORD};Network Library=DBMSSOCN;TrustServerCertificate=yes;",
]

for i, conn_str in enumerate(formats, 1):
    print(f"Trying format {i}...")
    try:
        conn = pyodbc.connect(conn_str, timeout=10)
        print(f"✓ SUCCESS with format {i}!")
        cursor = conn.cursor()
        cursor.execute("SELECT @@VERSION")
        row = cursor.fetchone()
        print(f"SQL Server version: {row[0][:50]}...")
        conn.close()
        break
    except Exception as e:
        print(f"✗ FAILED: {e}")
        print()
else:
    print("\nAll connection attempts failed!")
    print("\nTroubleshooting tips:")
    print("1. Check if SQL Server is running")
    print("2. Check if SQL Server Browser service is running (required for named instances)")
    print("3. Check firewall settings")
    print("4. Try connecting with SQL Server Management Studio first")
    print("5. Verify server name and instance name are correct")
