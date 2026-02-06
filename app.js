// 🔹 IMPORTS
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
  getDocs,
  doc,
  setDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 🔹 FIREBASE CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyAEX1MOFqLp1UDO8SfN4oMqDQx_8NhEH8w",
  authDomain: "cs2-strategy.firebaseapp.com",
  projectId: "cs2-strategy",
  appId: "1:225150653706:web:b6dbaf3fa480b8765fd6f3"
};

// 🔹 INIT
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// 🔹 GLOBAL STATE
let currentStrategyId = null;
let currentStep = 1;
const stepStates = {};

// 🔹 DOM
const loginBtn = document.getElementById("loginBtn");
const createBtn = document.getElementById("createStrategyBtn");
const deleteStrategyBtn = document.getElementById("deleteStrategyBtn");
const newStrategyInput = document.getElementById("newStrategyName");

const addPlayerBtn = document.getElementById("addPlayerBtn");
const addBombBtn = document.getElementById("addBombBtn");

const mapContainer = document.getElementById("map-container");
const list = document.getElementById("strategyList");
const status = document.getElementById("status");

// 🔹 AUTH
loginBtn.onclick = async () => {
  await signInWithPopup(auth, provider);
};

onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  status.textContent = `logado como ${user.displayName}`;
  loginBtn.style.display = "none";
  createBtn.style.display = "inline-block";

  loadStrategies(user.uid);
});

// 🔹 LOAD STRATEGIES
async function loadStrategies(userId) {
  list.innerHTML = "";

  const q = query(
    collection(db, "strategies"),
    where("ownerId", "==", userId)
  );

  const snapshot = await getDocs(q);

  snapshot.forEach((docSnap) => {
    const li = document.createElement("li");
    li.textContent = docSnap.data().name;

    li.onclick = async () => {
      currentStrategyId = docSnap.id;
      currentStep = 1;

      document.querySelectorAll("#strategyList li")
        .forEach(li => li.classList.remove("active"));

      li.classList.add("active");
      deleteStrategyBtn.style.display = "block";

      await loadStepFromDB(1);
      loadSteps();
      highlightActiveStep();
    };

    list.appendChild(li);
  });
}

// 🔹 CREATE STRATEGY
createBtn.onclick = async () => {
  const name = newStrategyInput.value.trim();
  if (!name) return;

  await addDoc(collection(db, "strategies"), {
    name,
    map: "dust2",
    ownerId: auth.currentUser.uid,
    createdAt: new Date()
  });

  newStrategyInput.value = "";
  await loadStrategies(auth.currentUser.uid);
};

// 🔹 DELETE STRATEGY
deleteStrategyBtn.onclick = async () => {
  if (!currentStrategyId) return;

  const confirmDelete = confirm(
    "Tem certeza que deseja excluir esta estratégia?\nEssa ação não pode ser desfeita."
  );

  if (!confirmDelete) return;

  // Limpa passos (Firestore client limitation)
  for (let i = 1; i <= 10; i++) {
    await setDoc(
      doc(db, "strategies", currentStrategyId, "steps", String(i)),
      {},
      { merge: false }
    );
  }

  // Limpa strategy
  await setDoc(
    doc(db, "strategies", currentStrategyId),
    {},
    { merge: false }
  );

  currentStrategyId = null;
  currentStep = 1;
  deleteStrategyBtn.style.display = "none";

  mapContainer.querySelectorAll(".player, .grenade, .bomb")
    .forEach(el => el.remove());

  await loadStrategies(auth.currentUser.uid);
};

// 🔹 STATE HELPER (PADRÃO GLOBAL)
function ensureStepState(step) {
  if (!stepStates[step]) {
    stepStates[step] = {};
  }
  stepStates[step].players ||= [];
  stepStates[step].grenades ||= [];
  stepStates[step].bomb ||= null;
}

// 🔹 LOAD STEPS UI
function loadSteps() {
  const container = document.getElementById("stepButtons");
  container.innerHTML = "";

  for (let i = 1; i <= 10; i++) {
    const btn = document.createElement("button");
    btn.textContent = i;

    btn.onclick = async () => {
      await saveCurrentStep();
      currentStep = i;
      await loadStepFromDB(i);
      highlightActiveStep();
    };

    container.appendChild(btn);
  }
}

// 🔹 HIGHLIGHT STEP
function highlightActiveStep() {
  document.querySelectorAll("#stepButtons button")
    .forEach(btn => {
      btn.classList.toggle(
        "active",
        Number(btn.textContent) === currentStep
      );
    });
}

// 🔹 ADD PLAYER
addPlayerBtn.onclick = async () => {
  if (!currentStrategyId) return;

  ensureStepState(currentStep);

  stepStates[currentStep].players.push({
    id: `p${Date.now()}`,
    x: 60,
    y: 60
  });

  renderStep();
  await saveCurrentStep();
};

// 🔹 ADD BOMB
addBombBtn.onclick = async () => {
  if (!currentStrategyId) return;

  ensureStepState(currentStep);

  stepStates[currentStep].bomb = stepStates[currentStep].bomb
    ? null
    : { x: 200, y: 200, planted: false };

  renderStep();
  await saveCurrentStep();
};

// 🔹 GRENADES
document.querySelectorAll("#grenade-tools button")
  .forEach(btn => {
    btn.onclick = async () => {
      if (!currentStrategyId) return;

      ensureStepState(currentStep);

      stepStates[currentStep].grenades.push({
        id: `g${Date.now()}`,
        type: btn.dataset.type,
        x: 120,
        y: 120
      });

      renderStep();
      await saveCurrentStep();
    };
  });

// 🔹 RENDER
function renderStep() {
  mapContainer.querySelectorAll(".player, .grenade, .bomb")
    .forEach(el => el.remove());

  const state = stepStates[currentStep];
  if (!state) return;

  // PLAYERS
  state.players.forEach(player => {
    const el = document.createElement("div");
    el.className = "player";
    el.style.left = `${player.x}px`;
    el.style.top = `${player.y}px`;

    el.addEventListener("contextmenu", async (e) => {
      e.preventDefault();
      state.players = state.players.filter(p => p.id !== player.id);
      renderStep();
      await saveCurrentStep();
    });

    makeDraggable(el, player);
    mapContainer.appendChild(el);
  });

  // GRENADES
  state.grenades.forEach(grenade => {
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

  // BOMB
  if (state.bomb) {
    const el = document.createElement("div");
    el.className = state.bomb.planted ? "bomb planted" : "bomb";
    el.style.left = `${state.bomb.x}px`;
    el.style.top = `${state.bomb.y}px`;

    el.addEventListener("dblclick", async () => {
      state.bomb.planted = !state.bomb.planted;
      renderStep();
      await saveCurrentStep();
    });

    el.addEventListener("contextmenu", async (e) => {
      e.preventDefault();
      state.bomb = null;
      renderStep();
      await saveCurrentStep();
    });

    makeDraggable(el, state.bomb);
    mapContainer.appendChild(el);
  }
}

// 🔹 DRAG (COMPARTILHADO)
function makeDraggable(el, data) {
  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  el.addEventListener("mousedown", (e) => {
    dragging = true;
    offsetX = e.offsetX;
    offsetY = e.offsetY;
    el.style.cursor = "grabbing";
  });

  document.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    const rect = mapContainer.getBoundingClientRect();
    data.x = e.clientX - rect.left - offsetX;
    data.y = e.clientY - rect.top - offsetY;
    el.style.left = `${data.x}px`;
    el.style.top = `${data.y}px`;
  });

  document.addEventListener("mouseup", async () => {
    if (!dragging) return;
    dragging = false;
    el.style.cursor = "grab";
    await saveCurrentStep();
  });
}

// 🔹 FIRESTORE
async function saveCurrentStep() {
  if (!currentStrategyId) return;
  ensureStepState(currentStep);

  await setDoc(
    doc(db, "strategies", currentStrategyId, "steps", String(currentStep)),
    {
      stepNumber: currentStep,
      state: stepStates[currentStep]
    }
  );
}

async function loadStepFromDB(step) {
  const ref = doc(db, "strategies", currentStrategyId, "steps", String(step));
  const snap = await getDoc(ref);

  stepStates[step] = snap.exists() ? snap.data().state : {};
  ensureStepState(step);
  renderStep();
}
