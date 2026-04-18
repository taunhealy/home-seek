import firebase_admin
from firebase_admin import credentials, firestore
import os

# Initialize Firebase
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "service-account.json"
if not firebase_admin._apps:
    cred = credentials.Certificate("service-account.json")
    firebase_admin.initialize_app(cred)

db = firestore.client()

print("--- RECENT LISTINGS ---")
listings = db.collection('listings').order_by('created_at', direction=firestore.Query.DESCENDING).limit(5).stream()
for l in listings:
    d = l.to_dict()
    print(f"[{d.get('created_at')}] {d.get('title')} - R{d.get('price')} ({d.get('platform')})")

import sys

# Ensure UTF-8 output for emojis
if sys.stdout.encoding != 'utf-8':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

print("\n--- RECENT TASKS ---")
tasks = db.collection('tasks').order_by('updated_at', direction=firestore.Query.DESCENDING).limit(5).stream()
for t in tasks:
    d = t.to_dict()
    print(f"[{d.get('updated_at')}] Task {t.id}: {d.get('status')} | {d.get('message')}")
