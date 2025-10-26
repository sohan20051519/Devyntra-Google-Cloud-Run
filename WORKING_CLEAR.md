# CLEAR FAILED DEPLOYMENTS - WORKING METHOD

## Steps:

1. **Make sure you're logged into DevYntra app** (you should already be)

2. **Open the DevYntra app in your browser** (where you see the deployment failure)

3. **Press F12** to open Developer Tools

4. **Click the Console tab**

5. **Copy this code and paste it, then press Enter:**

```javascript
// Get Firestore instance
import { getFirestore } from './services/firestore';
import { collection, query, where, getDocs, deleteDoc } from './services/firestore';
const db = getFirestore();

// Query failed deployments
const q = query(collection(db, 'deployments'), where('status', '==', 'failed'));
const snapshot = await getDocs(q);

console.log(`Found ${snapshot.size} failed deployments`);

// Delete them
for (const doc of snapshot.docs) {
  await deleteDoc(doc.ref);
  console.log('Deleted:', doc.id);
}

alert(`Cleared ${snapshot.size} failed deployments!`);
location.reload();
```

That's it! The deployments will be cleared and the page will reload.



