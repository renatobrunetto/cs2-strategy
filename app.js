import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAEX1MOFqLp1UDO8SfN4oMqDQx_8NhEH8w",
  authDomain: "cs2-strategy.firebaseapp.com",
  projectId: "cs2-strategy",
  storageBucket: "cs2-strategy.firebasestorage.app",
  messagingSenderId: "225150653706",
  appId: "1:225150653706:web:b6dbaf3fa480b8765fd6f3",
  measurementId: "G-V7FZK2FX3J"
};


const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

const loginBtn = document.getElementById("loginBtn");
const createBtn = document.getElementById("createStrategyBtn");
const status = document.getElementById("status");
const list = document.getElementById("strategyList");

loginBtn.onclick = async () => {
  await signInWithPopup(auth, provider);
};

onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  status.textContent = `logado como ${user.displayName}`;
  loginBtn.style.display = "none";
  createBtn.style.display = "inline-block";

  list.innerHTML = "";

  const q = query(
    collection(db, "strategies"),
    where("ownerId", "==", user.uid)
  );

  const snapshot = await getDocs(q);
  snapshot.forEach((doc) => {
    const li = document.createElement("li");
    li.textContent = doc.data().name;
    list.appendChild(li);
  });
});

createBtn.onclick = async () => {
  const name = prompt("Nome da estratégia:");
  if (!name) return;

  await addDoc(collection(db, "strategies"), {
    name,
    map: "dust2",
    ownerId: auth.currentUser.uid,
    createdAt: new Date()
  });

  alert("Estratégia criada! Recarregue a página.");
};
