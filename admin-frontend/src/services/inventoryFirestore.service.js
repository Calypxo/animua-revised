import { collection, getDocs, getDoc, doc, setDoc, updateDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../config/firebase.js";

export async function getInventoryItems() {
  const snap = await getDocs(collection(db, "inventoryItems"));
  return snap.docs.map((docSnap) => ({
    docId: docSnap.id,
    ...docSnap.data(),
  }));
}

export async function getInventoryItemById(itemId) {
  const ref = doc(db, "inventoryItems", itemId);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    throw new Error("Item not found.");
  }

  return {
    docId: snap.id,
    ...snap.data(),
  };
}

export async function updateInventoryItem(itemId, updates) {
  const ref = doc(db, "inventoryItems", itemId);
  await updateDoc(ref, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function createInventoryItem(item) {
  const ref = doc(db, "inventoryItems", item.id);
  await setDoc(ref, {
    ...item,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function addInventoryTransaction(itemId, txn) {
  await addDoc(collection(db, "inventoryItems", itemId, "transactions"), {
    ...txn,
    createdAt: serverTimestamp(),
  });
}

export async function getItemTransactions(itemId) {
  const snap = await getDocs(collection(db, "inventoryItems", itemId, "transactions"));
  return snap.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  }));
}