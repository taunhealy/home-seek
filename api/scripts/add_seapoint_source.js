import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { join } from 'path';

// Initialize Firebase Admin (assuming service account or default credentials)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault()
  });
}

const db = admin.firestore();

async function addSource() {
  const source = {
    url: 'https://www.facebook.com/groups/1835146853375362/',
    name: 'Sea Point Rentals',
    user_id: 'demo-user',
    enabled: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  };

  try {
    const res = await db.collection('sources').add(source);
    console.log('Added source with ID: ', res.id);
  } catch (err) {
    console.error('Error adding source: ', err);
  }
}

addSource();
