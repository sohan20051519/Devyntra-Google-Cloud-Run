/**
 * Script to clear failed deployments from Firebase Firestore
 * 
 * Usage: 
 * 1. Install Firebase CLI: npm install -g firebase-tools
 * 2. Login: firebase login
 * 3. Run this script: node clear-firebase-data.js
 * 
 * OR use the web console at: https://console.firebase.google.com/project/devyntra-500e4/firestore
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('./serviceAccountKey.json'); // You'll need to download this from Firebase Console

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function clearFailedDeployments() {
  try {
    console.log('Fetching failed deployments...');
    
    const deploymentsRef = db.collection('deployments');
    const snapshot = await deploymentsRef.where('status', '==', 'failed').get();
    
    if (snapshot.empty) {
      console.log('No failed deployments found.');
      return;
    }
    
    console.log(`Found ${snapshot.size} failed deployments to delete.`);
    
    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    console.log(`Successfully deleted ${snapshot.size} failed deployments.`);
    
  } catch (error) {
    console.error('Error clearing deployments:', error);
  }
}

// Clear all deployments
async function clearAllDeployments() {
  try {
    console.log('Fetching all deployments...');
    
    const deploymentsRef = db.collection('deployments');
    const snapshot = await deploymentsRef.get();
    
    if (snapshot.empty) {
      console.log('No deployments found.');
      return;
    }
    
    console.log(`Found ${snapshot.size} deployments to delete.`);
    
    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    console.log(`Successfully deleted ${snapshot.size} deployments.`);
    
  } catch (error) {
    console.error('Error clearing deployments:', error);
  }
}

// Run the appropriate function
const args = process.argv.slice(2);
if (args.includes('--all')) {
  clearAllDeployments();
} else {
  clearFailedDeployments();
}



