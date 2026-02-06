// 🔹 IMPORTS (sempre no topo)
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

// 🔹 ESTADO GLOBAL
let currentStrategyId = null;
let currentStep = 1;

// 🔹 FIREBASE CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyAEX1MOFqLp1UDO8SfN4oMqDQx_8NhEH8w",
  authDomain: "cs2-strategy.firebaseapp.com",
  projectId: "cs2-strategy",
  storageBucket: "cs2-strategy.firebasestorage.app",
  messagingSenderId: "225150653706",
  appId: "1:225150653706:web:b6dbaf3fa480b8765fd6f3"
};

// 🔹 INIT
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// 🔹 DOM
const loginBtn = document.getElementById("loginBtn");
const createBtn = document.getElementById("createStrategyBtn");
const status = document.getElementById("status");
const list = document.getElementById("strategyList");

// 🔹 LOGIN
loginBtn.onclick = async () => {
  await signInWithPopup(auth, provider);
};

// 🔹 AUTH STATE
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

    li.onclick = () => {
      currentStrategyId = doc.id;
      loadSteps();
    };

    list.appendChild(li);
  });
});

// 🔹 CREATE STRATEGY
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

// 🔹 LOAD STEPS
function loadSteps() {
  const stepContainer = document.getElementById("stepButtons");
  stepContainer.innerHTML = "";

  for (let i = 1; i <= 10; i++) {
    const btn = document.createElement("button");
    btn.textContent = i;

    btn.onclick = () => {
      currentStep = i;
      alert(`Passo ${i} selecionado`);
    };

    stepContainer.appendChild(btn);
  }
}

const mapContainer = document.getElementById("map-container");
const addPlayerBtn = document.getElementById("addPlayerBtn");

addPlayerBtn.onclick = () => {
  const player = document.createElement("div");
  player.className = "player";

  player.style.left = "50px";
  player.style.top = "50px";

  makeDraggable(player);
  mapContainer.appendChild(player);
};

function makeDraggable(el) {
  let offsetX = 0;
  let offsetY = 0;
  let dragging = false;

  el.addEventListener("mousedown", (e) => {
    dragging = true;
    offsetX = e.offsetX;
    offsetY = e.offsetY;
    el.style.cursor = "grabbing";
  });

  document.addEventListener("mousemove", (e) => {
    if (!dragging) return;

    const rect = mapContainer.getBoundingClientRect();
    el.style.left = `${e.clientX - rect.left - offsetX}px`;
    el.style.top = `${e.clientY - rect.top - offsetY}px`;
  });

  document.addEventListener("mouseup", () => {
    dragging = false;
    el.style.cursor = "grab";
  });
}
