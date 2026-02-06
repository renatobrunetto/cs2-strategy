// 🔹 IMPORTS (sempre no topo)
import {
  doc,
  setDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

    li.onclick = async () => {
      currentStrategyId = doc.id;
      currentStep = 1;
      await loadStepFromDB(1);
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
const stepStates = {};
function loadSteps() {
  const stepContainer = document.getElementById("stepButtons");
  stepContainer.innerHTML = "";

  for (let i = 1; i <= 10; i++) {
    const btn = document.createElement("button");
    btn.textContent = i;

  btn.onclick = async () => {
   await saveCurrentStep();
   currentStep = i;
   await loadStepFromDB(i);
  };

    stepContainer.appendChild(btn);
  }
}

const mapContainer = document.getElementById("map-container");
const addPlayerBtn = document.getElementById("addPlayerBtn");

addPlayerBtn.onclick = async () => {
  if (!currentStrategyId) {
    alert("Selecione uma estratégia primeiro");
    return;
  }

  if (!stepStates[currentStep]) {
    stepStates[currentStep] = { players: [] };
  }

  const id = `p${Date.now()}`;

  const playerData = {
    id,
    x: 50,
    y: 50
  };

  stepStates[currentStep].players.push(playerData);

  renderStep();
  await saveCurrentStep();
};


function makeDraggable(el, playerData) {
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
    const x = e.clientX - rect.left - offsetX;
    const y = e.clientY - rect.top - offsetY;

    el.style.left = `${x}px`;
    el.style.top = `${y}px`;

    playerData.x = x;
    playerData.y = y;
  });

  document.addEventListener("mouseup", () => {
    dragging = false;
    el.style.cursor = "grab";
  });
}


function renderStep() {
  // limpa mapa
  mapContainer.querySelectorAll(".player").forEach(p => p.remove());

  const state = stepStates[currentStep];
  if (!state) return;

state.players.forEach(player => {
  const el = document.createElement("div");
  el.className = "player";
  el.style.left = `${player.x}px`;
  el.style.top = `${player.y}px`;

  // 🔥 REMOVER COM BOTÃO DIREITO
  el.addEventListener("contextmenu", async (e) => {
    e.preventDefault();
    removePlayer(player.id);
  });

  makeDraggable(el, player);
  mapContainer.appendChild(el);
});
// GRANADAS
state.grenades?.forEach(grenade => {
  const el = document.createElement("div");
  el.className = `grenade ${grenade.type}`;
  el.style.left = `${grenade.x}px`;
  el.style.top = `${grenade.y}px`;

  el.addEventListener("contextmenu", async (e) => {
    e.preventDefault();
    state.grenades = state.grenades.filter(g => g.id !== grenade.id);
    renderStep();
    await saveCurrentStep();
  });

  makeDraggable(el, grenade);
  mapContainer.appendChild(el);
});
}

async function saveCurrentStep() {
  if (!currentStrategyId) return;

  const state = stepStates[currentStep] || { players: [] };

  const stepRef = doc(
    db,
    "strategies",
    currentStrategyId,
    "steps",
    String(currentStep)
  );

  await setDoc(stepRef, {
    stepNumber: currentStep,
    state
  });
}

async function loadStepFromDB(step) {
  if (!currentStrategyId) return;

  const stepRef = doc(
    db,
    "strategies",
    currentStrategyId,
    "steps",
    String(step)
  );

  const snapshot = await getDoc(stepRef);

  if (snapshot.exists()) {
    stepStates[step] = snapshot.data().state;
  } else {
    stepStates[step] = { players: [] };
  }

  renderStep();
}

async function removePlayer(playerId) {
  const state = stepStates[currentStep];
  if (!state) return;

  stepStates[currentStep].players = state.players.filter(
    p => p.id !== playerId
  );

  renderStep();
  await saveCurrentStep();
}

document.querySelectorAll("#grenade-tools button")
  .forEach(btn => {
    btn.onclick = async () => {
      if (!currentStrategyId) {
        alert("Selecione uma estratégia");
        return;
      }

      if (!stepStates[currentStep]) {
        stepStates[currentStep] = { players: [], grenades: [] };
      }

      const grenade = {
        id: `g${Date.now()}`,
        type: btn.dataset.type,
        x: 100,
        y: 100
      };

      stepStates[currentStep].grenades.push(grenade);
      renderStep();
      await saveCurrentStep();
    };
  });

