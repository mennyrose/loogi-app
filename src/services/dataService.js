import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  updateDoc, 
  addDoc, 
  query, 
  where,
  getDocs,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../firebase";

// --- SEED DATA LOGIC ---
export const seedInitialData = async (initialData) => {
  const catalogCol = collection(db, "catalog");
  const catalogSnap = await getDocs(catalogCol);
  
  if (catalogSnap.empty) {
    console.log("Seeding initial catalog...");
    for (const item of initialData.catalog) {
      await setDoc(doc(db, "catalog", item.internal_id), item);
    }
  }

  // Ensure the specific Admin user exists
  const mainAdmin = initialData.users.find(u => u.email === 'mennyr@gmail.com');
  if (mainAdmin) {
    await setDoc(doc(db, "users", mainAdmin.email), mainAdmin);
  }

  const inventoryDoc = doc(db, "inventory", "main");
  const inventorySnap = await getDocs(collection(db, "inventory"));
  if (inventorySnap.empty) {
    console.log("Seeding initial inventory...");
    await setDoc(inventoryDoc, initialData.inventory);
  }

  const usersCol = collection(db, "users");
  const usersSnap = await getDocs(usersCol);
  if (usersSnap.empty) {
    console.log("Seeding initial users...");
    for (const user of initialData.users) {
      await setDoc(doc(db, "users", user.email), user);
    }
  }
};

// --- REAL-TIME LISTENERS ---
export const subscribeToCollection = (collectionName, callback) => {
  return onSnapshot(collection(db, collectionName), (snapshot) => {
    const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    callback(data);
  });
};

export const subscribeToInventory = (callback) => {
  return onSnapshot(doc(db, "inventory", "main"), (doc) => {
    if (doc.exists()) callback(doc.data());
  });
};

// --- DATA ACCESS ---
export const getUserByEmail = async (email) => {
  const q = query(collection(db, "users"), where("email", "==", email));
  const snap = await getDocs(q);
  if (!snap.empty) return snap.docs[0].data();
  return null;
};

// --- UPDATE ACTIONS ---
export const updateInventoryInFirestore = async (newInventory) => {
  await setDoc(doc(db, "inventory", "main"), newInventory);
};

export const addRequestToFirestore = async (request) => {
  await addDoc(collection(db, "requests"), {
    ...request,
    createdAt: serverTimestamp()
  });
};

export const updateRequestStatusInFirestore = async (requestId, status, approvedQty = null, previousStatus = null) => {
  const updates = { status };
  if (approvedQty !== null) updates.approvedQty = approvedQty;
  if (previousStatus !== null) updates.previousStatus = previousStatus;
  await updateDoc(doc(db, "requests", requestId), updates);
};

export const updateRequestInFirestore = async (requestId, updates) => {
  await updateDoc(doc(db, "requests", requestId), updates);
};

export const addUserToFirestore = async (user) => {
  await setDoc(doc(db, "users", user.email), user);
};

export const addTransaction = async (tx) => {
  await addDoc(collection(db, "transactions"), {
    ...tx,
    timestamp: new Date().toISOString()
  });
};

export const addItemToCatalog = async (item) => {
  const docRef = await addDoc(collection(db, "catalog"), item);
  return docRef.id;
};

export const updateBattalionInventory = async (newInventory) => {
  await setDoc(doc(db, "inventory", "battalion"), newInventory);
};
