"""
Clear all demo/sample data from MongoDB.
Keeps collections but removes all documents.
"""
import os
from pymongo import MongoClient

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("MONGODB_DB_NAME", "edi_platform")

def main():
    client = MongoClient(MONGODB_URL)
    db = client[DB_NAME]

    collections = [
        "documents",
        "exceptions",
        "audit_logs",
        "trading_partners",
        "mappings",
        "users",
    ]

    total = 0
    for coll_name in collections:
        coll = db[coll_name]
        count = coll.count_documents({})
        if count > 0:
            coll.delete_many({})
            total += count
            print(f"  Cleared {count} from {coll_name}")

    if total == 0:
        print("  No demo data found — already empty.")
    else:
        print(f"\nDone. Removed {total} records total.")

if __name__ == "__main__":
    print(f"Clearing demo data from {DB_NAME}...")
    main()
