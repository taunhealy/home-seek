import os
import sys

# Ensure api directory is in sys.path
api_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if api_dir not in sys.path:
    sys.path.insert(0, api_dir)

from services.database import get_db

def delete_collection(db, coll_ref, batch_size=400):
    total_deleted = 0
    while True:
        docs = list(coll_ref.limit(batch_size).stream())
        if not docs:
            break
        
        batch = db.batch()
        for doc in docs:
            batch.delete(doc.reference)
            total_deleted += 1
        batch.commit()
        print(f"  Deleted batch of {len(docs)} documents... (Total: {total_deleted})")
    return total_deleted

def purge_database():
    print("=== [PURGE] Starting Property Database Cleanup ===")
    db = get_db()
    if not db:
        print("ERROR: Could not connect to Firestore.")
        return

    # 1. Purge global 'listings' collection
    print("\n1. Purging global 'listings' collection...")
    g_count = delete_collection(db, db.collection("listings"))
    print(f"-> Cleared {g_count} global listings.")

    # 2. Purge user-specific 'listings' subcollections
    print("\n2. Purging user listing subcollections...")
    u_total = 0
    users = list(db.collection("users").stream())
    for u in users:
        u_listings_ref = db.collection("users").document(u.id).collection("listings")
        u_count = delete_collection(db, u_listings_ref)
        if u_count > 0:
            print(f"-> Cleared {u_count} listings for user '{u.id}'.")
            u_total += u_count
    print(f"-> Total user listings purged: {u_total}")

    # 3. Purge 'fingerprints' collection (scraper memory reset)
    print("\n3. Purging 'fingerprints' collection (resetting deduplication cache)...")
    fp_count = delete_collection(db, db.collection("fingerprints"))
    print(f"-> Cleared {fp_count} fingerprints.")

    print("\n=== [PURGE COMPLETE] Database is 100% clean and ready for fresh scans. ===")
    print(f"Summary: {g_count} global listings, {u_total} user listings, {fp_count} fingerprints removed.")

if __name__ == "__main__":
    purge_database()
