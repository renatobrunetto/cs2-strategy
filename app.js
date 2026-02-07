// =======================
// 🔹 IMPORTS
// =======================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut
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
  getDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// =======================
// 🔹 FIREBASE INIT
// =======================
const firebaseConfig = {
  apiKey: "AIzaSyAEX1MOFqLp1UDO8SfN4oMqDQx_8NhEH8w",
  authDomain: "cs2-strategy.firebaseapp.com",
  projectId: "cs2-strategy",
  appId: "1:225150653706:web:b6dbaf3fa480b8765fd6f3"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// =======================
// 🔹 GLOBAL STATE
// =======================
let currentUserId = null;
let currentStrategyId = null;
let currentStep = 1;
const stepStates = {};

let previewHover = false;

// =======================
// 🔹 DOM
// =======================
const loginView = document.getElementById("login-view");
const appView = document.getElementById("app-view");

const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const userNameEl = document.getElementById("userName");

const newStrategyInput = document.getElementById("newStrategyName");
const createStrategyBtn = document.getElementById("createStrategyBtn");

const myPrivateList = document.getElementById("myPrivateStrategyList");
const myPublicList = document.getElementById("myPublicStrategyList");
const publicList = document.getElementById("publicStrategyList");

const editorEmpty = document.getElementById("editor-empty");
const editorContent = document.getElementById("editor-content");

const addPlayerBtn = document.getElementById("addPlayerBtn");
const mapContainer = document.getElementById("map-container");

const videoPreview = document.getElementById("video-preview");
const videoFrame = document.getElementById("video-frame");

// =======================
// 🔹 AUTH
// =======================
loginBtn.onclick = async () => {
  showLoader();
  await signInWithPopup(auth, provider);
  hideLoader();
};

logoutBtn.onclick = async () => {
  showLoader();
  await signOut(auth);
  hideLoader();
};

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    loginView.style.display = "flex";
    appView.style.display = "none";
    hideEditor();
    return;
  }

  currentUserId = user.uid;
  userNameEl.textContent = user.displayName;

  loginView.style.display = "none";
  appView.style.display = "block";

  hideEditor();
  showLoader();
  await loadStrategies();
  hideLoader();
});

// =======================
// 🔹 STRATEGIES
// =======================
async function loadStrategies() {
  myPrivateList.innerHTML = "";
  myPublicList.innerHTML = "";
  publicList.innerHTML = "";

  const myQuery = query(
    collection(db, "strategies"),
    where("ownerId", "==", currentUserId)
  );

  const publicQuery = query(
    collection(db, "strategies"),
    where("isPublic", "==", true)
  );

  const mySnap = await getDocs(myQuery);
  const pubSnap = await getDocs(publicQuery);

  mySnap.forEach(s => renderStrategy(s, true));
  pubSnap.forEach(s => {
    if (s.data().ownerId !== currentUserId) {
      renderStrategy(s, false);
    }
  });
}

function renderStrategy(docSnap, isMine) {
  const data = docSnap.data();

  const card = document.createElement("div");
  card.className = "strategy-card";

  const info = document.createElement("div");
  info.className = "strategy-info";
  info.textContent = data.name;

  const actions = document.createElement("div");
  actions.className = "strategy-actions";

  if (isMine) {
    const toggle = document.createElement("button");
    toggle.textContent = data.isPublic ? "🌐" : "🔒";
    toggle.setAttribute("data-tooltip", "Alterar visibilidade");

    toggle.onclick = async (e) => {
      e.stopPropagation();
      await updateDoc(doc(db, "strategies", docSnap.id), {
        isPublic: !data.isPublic
      });
      loadStrategies();
    };

    const del = document.createElement("button");
    del.textContent = "🗑️";
    del.classList.add("delete");
    del.setAttribute("data-tooltip", "Excluir estratégia");

    del.onclick = async (e) => {
      e.stopPropagation();
      if (!confirm("Excluir estratégia?")) return;
      await setDoc(doc(db, "strategies", docSnap.id), {}, { merge: false });
      if (currentStrategyId === docSnap.id) hideEditor();
      loadStrategies();
    };

    actions.append(toggle, del);
  }

  card.append(info, actions);

  card.onclick = async () => {
    currentStrategyId = docSnap.id;
    currentStep = 1;
    Object.keys(stepStates).forEach(k => delete stepStates[k]);

    document.querySelectorAll(".strategy-card")
      .forEach(c => c.classList.remove("active"));
    card.classList.add("active");

    showEditor();
    loadSteps();

    showLoader();
    await loadStepFromDB(1);
    hideLoader();
  };

  (isMine
    ? data.isPublic ? myPublicList : myPrivateList
    : publicList
  ).appendChild(card);
}

createStrategyBtn.onclick = async () => {
  const name = newStrategyInput.value.trim();
  if (!name) return;

  showLoader();
  await addDoc(collection(db, "strategies"), {
    name,
    ownerId: currentUserId,
    isPublic: false,
    createdAt: new Date()
  });
  hideLoader();

  newStrategyInput.value = "";
  loadStrategies();
};

// =======================
// 🔹 EDITOR
// =======================
function showEditor() {
  editorEmpty.style.display = "none";
  editorContent.style.display = "block";
}

function hideEditor() {
  editorContent.style.display = "none";
  editorEmpty.style.display = "flex";
}

// =======================
// 🔹 STEPS
// =======================
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
    };
    container.appendChild(btn);
  }
}

// =======================
// 🔹 STEP STATE
// =======================
function ensureStepState(step) {
  stepStates[step] ||= { players: [], grenades: [], bomb: null };
}

// =======================
// 🔹 TOOLS
// =======================
addPlayerBtn.onclick = async () => {
  if (!currentStrategyId) return;
  ensureStepState(currentStep);

  stepStates[currentStep].players.push({
    id: `p${Date.now()}`,
    x: 100,
    y: 100
  });

  renderStep();
  await saveCurrentStep();
};

document.querySelectorAll("[data-type]").forEach(btn => {
  btn.onclick = async () => {
    if (!currentStrategyId) return;
    ensureStepState(currentStep);

    const type = btn.dataset.type;

    if (type === "bomb") {
      stepStates[currentStep].bomb =
        stepStates[currentStep].bomb
          ? null
          : { x: 200, y: 200, planted: false };
    } else {
      stepStates[currentStep].grenades.push({
        id: `g${Date.now()}`,
        type,
        x: 150,
        y: 150,
        youtubeId: null
      });
    }

    renderStep();
    await saveCurrentStep();
  };
});

// =======================
// 🔹 RENDER
// =======================
function renderStep() {
  mapContainer.querySelectorAll(".player,.grenade,.bomb").forEach(e => e.remove());
  const state = stepStates[currentStep];
  if (!state) return;

  state.players.forEach(p => {
    const el = document.createElement("div");
    el.className = "player";
    el.style.left = `${p.x}px`;
    el.style.top = `${p.y}px`;
    makeDraggable(el, p);
    mapContainer.appendChild(el);
  });

  state.grenades.forEach(g => {
    const el = document.createElement("div");
    el.className = `grenade ${g.type}`;
    el.style.left = `${g.x}px`;
    el.style.top = `${g.y}px`;

    if (g.youtubeId) {
      el.addEventListener("mouseenter", e =>
        showVideoPreview(g.youtubeId, e.clientX, e.clientY)
      );
      el.addEventListener("mouseleave", () => {
        previewHover = false;
        hideVideoPreview();
      });
    }

    el.addEventListener("dblclick", () => openGrenadeEditor(g));
    makeDraggable(el, g);
    mapContainer.appendChild(el);
  });

  if (state.bomb) {
    const el = document.createElement("div");
    el.className = "bomb";
    el.style.left = `${state.bomb.x}px`;
    el.style.top = `${state.bomb.y}px`;
    makeDraggable(el, state.bomb);
    mapContainer.appendChild(el);
  }
}

// =======================
// 🔹 VIDEO PREVIEW
// =======================
function showVideoPreview(id, x, y) {
  videoFrame.src = `https://www.youtube.com/embed/${id}`;
  videoPreview.style.left = `${x + 12}px`;
  videoPreview.style.top = `${y + 12}px`;
  videoPreview.classList.remove("hidden");
  previewHover = true;
}

function hideVideoPreview() {
  setTimeout(() => {
    if (!previewHover) {
      videoFrame.src = "";
      videoPreview.classList.add("hidden");
    }
  }, 120);
}

videoPreview.addEventListener("mouseenter", () => previewHover = true);
videoPreview.addEventListener("mouseleave", () => {
  previewHover = false;
  hideVideoPreview();
});

// =======================
// 🔹 DRAG
// =======================
function makeDraggable(el, data) {
  let dragging = false;
  let ox = 0, oy = 0;

  el.addEventListener("mousedown", e => {
    dragging = true;
    ox = e.offsetX;
    oy = e.offsetY;
  });

  document.addEventListener("mousemove", e => {
    if (!dragging) return;
    const r = mapContainer.getBoundingClientRect();
    data.x = Math.max(0, Math.min(e.clientX - r.left - ox, r.width - el.offsetWidth));
    data.y = Math.max(0, Math.min(e.clientY - r.top - oy, r.height - el.offsetHeight));
    el.style.left = `${data.x}px`;
    el.style.top = `${data.y}px`;
  });

  document.addEventListener("mouseup", async () => {
    if (!dragging) return;
    dragging = false;
    await saveCurrentStep();
  });
}

// =======================
// 🔹 GRENADE EDITOR
// =======================
function openGrenadeEditor(grenade) {
  const modal = document.getElementById("grenade-modal");
  if (!modal) return;

  const input = modal.querySelector("#grenadeVideoInput");
  input.value = grenade.youtubeId ? `https://youtu.be/${grenade.youtubeId}` : "";

  modal.classList.add("open");

  modal.querySelector("#saveGrenadeVideo").onclick = async () => {
    grenade.youtubeId = extractYoutubeId(input.value);
    modal.classList.remove("open");
    await saveCurrentStep();
    renderStep();
  };

  modal.querySelector("#removeGrenadeVideo").onclick = async () => {
    grenade.youtubeId = null;
    modal.classList.remove("open");
    await saveCurrentStep();
    renderStep();
  };
}

function extractYoutubeId(url) {
  try {
    const u = new URL(url);
    return u.searchParams.get("v") || u.pathname.replace("/", "");
  } catch {
    return null;
  }
}

// =======================
// 🔹 FIRESTORE
// =======================
async function saveCurrentStep() {
  if (!currentStrategyId) return;
  await setDoc(
    doc(db, "strategies", currentStrategyId, "steps", String(currentStep)),
    { state: stepStates[currentStep] }
  );
}

async function loadStepFromDB(step) {
  const ref = doc(db, "strategies", currentStrategyId, "steps", String(step));
  const snap = await getDoc(ref);
  stepStates[step] = snap.exists() ? snap.data().state : {};
  ensureStepState(step);
  renderStep();
}

// =======================
// 🔹 UI
// =======================
function showLoader() {
  document.getElementById("loader").classList.remove("hidden");
}

function hideLoader() {
  document.getElementById("loader").classList.add("hidden");
}
