# Clear Firebase Deployments

## Method 1: Using Firebase Console (Easiest)

1. Go to: https://console.firebase.google.com/project/devyntra-500e4/firestore
2. Click on the `deployments` collection
3. Filter by status = `failed`
4. Select all documents and delete them

## Method 2: Using Firebase CLI

### Clear Failed Deployments

```bash
# Install Firebase CLI if not installed
npm install -g firebase-tools

# Login to Firebase
firebase login

# Navigate to project directory
cd Devyntra-Google-Cloud-Run

# Clear failed deployments using the Firestore console
# OR use this Node.js script (requires serviceAccountKey.json):
node clear-firebase-data.js
```

## Method 3: Using Node.js in Browser Console

Open browser console (F12) on your DevYntra app and run:

```javascript
import { getFirestore, collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';

async function clearFailedDeployments() {
  const db = getFirestore();
  const deploymentsRef = collection(db, 'deployments');
  const q = query(deploymentsRef, where('status', '==', 'failed'));
  const snapshot = await getDocs(q);
  
  const deletePromises = snapshot.docs.map(async (docSnap) => {
    await deleteDoc(docSnap.ref);
    console.log('Deleted:', docSnap.id);
  });
  
  await Promise.all(deletePromises);
  console.log(`Deleted ${snapshot.size} failed deployments`);
}

clearFailedDeployments();
```

## Method 4: Add a Button in the UI

The code now includes `deleteFailedDeployments` function in `services/firestore.ts` that can be called from the UI.



