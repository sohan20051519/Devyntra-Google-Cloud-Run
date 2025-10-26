// Copy and paste this entire code block into your browser console while on the DevYntra app

(async function clearFailedDeployments() {
  try {
    console.log('Fetching failed deployments...');
    
    // Import Firestore functions
    const { getFirestore, collection, query, where, getDocs, deleteDoc } = await import('https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js');
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js');
    
    const firebaseConfig = {
      apiKey: "AIzaSyDYfGFH5-tMEGVoPsTqBgHYX4qcZbY8WkE",
      authDomain: "devyntra-500e4.firebaseapp.com",
      projectId: "devyntra-500e4"
    };
    
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    const deploymentsRef = collection(db, 'deployments');
    const q = query(deploymentsRef, where('status', '==', 'failed'));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      console.log('✓ No failed deployments found.');
      alert('No failed deployments to clear.');
      return;
    }
    
    console.log(`Found ${snapshot.size} failed deployments. Deleting...`);
    
    const deletePromises = snapshot.docs.map(async (docSnap) => {
      await deleteDoc(docSnap.ref);
      console.log(`✓ Deleted: ${docSnap.id}`);
    });
    
    await Promise.all(deletePromises);
    
    console.log(`✓ Successfully deleted ${snapshot.size} failed deployment(s)!`);
    alert(`Successfully cleared ${snapshot.size} failed deployment(s)!`);
    
    // Reload the page to refresh the deployment list
    setTimeout(() => location.reload(), 1000);
    
  } catch (error) {
    console.error('Error clearing deployments:', error);
    alert('Error: ' + error.message);
  }
})();



