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

let videoHoverActive = false;

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

  mySnap.forEach(d => renderStrategy(d, true));
  pubSnap.forEach(d => {
    if (d.data().ownerId !== currentUserId) {
      renderStrategy(d, false);
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
    const toggleBtn = document.createElement("button");
    toggleBtn.textContent = data.isPublic ? "🌐" : "🔒";
    toggleBtn.setAttribute("data-tooltip", "Alterar visibilidade");

    toggleBtn.onclick = async (e) => {
      e.stopPropagation();
      await updateDoc(doc(db, "strategies", docSnap.id), {
        isPublic: !data.isPublic
      });
      loadStrategies();
    };

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "🗑️";
    deleteBtn.classList.add("delete");
    deleteBtn.setAttribute("data-tooltip", "Excluir estratégia");

    deleteBtn.onclick = async (e) => {
      e.stopPropagation();
      if (!confirm("Excluir estratégia?")) return;

      await setDoc(doc(db, "strategies", docSnap.id), {}, { merge: false });
      if (currentStrategyId === docSnap.id) hideEditor();
      loadStrategies();
    };

    actions.append(toggleBtn, deleteBtn);
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
    highlightActiveStep();

    showLoader();
    await loadStepFromDB(1);
    hideLoader();
  };

  if (isMine) {
    (data.isPublic ? myPublicList : myPrivateList).appendChild(card);
  } else {
    publicList.appendChild(card);
  }
}

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
      highlightActiveStep();
    };

    container.appendChild(btn);
  }
}

function highlightActiveStep() {
  document.querySelectorAll("#stepButtons button").forEach(btn => {
    btn.classList.toggle("active", Number(btn.textContent) === currentStep);
  });
}

// =======================
// 🔹 STEP STATE
// =======================
function ensureStepState(step) {
  if (!stepStates[step]) stepStates[step] = {};
  stepStates[step].players ||= [];
  stepStates[step].grenades ||= [];
  stepStates[step].bomb ||= null;
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
// 🔹 RENDER STEP
// =======================
function renderStep() {
  mapContainer.querySelectorAll(".player, .grenade, .bomb").forEach(e => e.remove());
  const state = stepStates[currentStep];
  if (!state) return;

  // PLAYERS
  state.players.forEach(player => {
    const el = document.createElement("div");
    el.className = "player";
    el.style.left = `${player.x}px`;
    el.style.top = `${player.y}px`;

    el.oncontextmenu = async e => {
      e.preventDefault();
      state.players = state.players.filter(p => p.id !== player.id);
      renderStep();
      await saveCurrentStep();
    };

    makeDraggable(el, player);
    mapContainer.appendChild(el);
  });

  // GRENADES
  state.grenades.forEach(grenade => {
    const el = document.createElement("div");
    el.className = `grenade ${grenade.type}`;
    el.style.left = `${grenade.x}px`;
    el.style.top = `${grenade.y}px`;

    if (grenade.youtubeId) {
      el.classList.add("has-video");

      el.addEventListener("mouseenter", () => {
        videoHoverActive = true;
        showVideoPreview(grenade.youtubeId, el);
      });

      el.addEventListener("mouseleave", () => {
        setTimeout(() => {
          if (!videoHoverActive) hideVideoPreview();
        }, 200);
      });
    }

    el.ondblclick = () => openGrenadeEditor(grenade);

    el.oncontextmenu = async e => {
      e.preventDefault();
      state.grenades = state.grenades.filter(g => g.id !== grenade.id);
      renderStep();
      await saveCurrentStep();
    };

    makeDraggable(el, grenade);
    mapContainer.appendChild(el);
  });

  // BOMB
  if (state.bomb) {
    const el = document.createElement("div");
    el.className = state.bomb.planted ? "bomb planted" : "bomb";
    el.style.left = `${state.bomb.x}px`;
    el.style.top = `${state.bomb.y}px`;

    el.ondblclick = async () => {
      state.bomb.planted = !state.bomb.planted;
      renderStep();
      await saveCurrentStep();
    };

    el.oncontextmenu = async e => {
      e.preventDefault();
      state.bomb = null;
      renderStep();
      await saveCurrentStep();
    };

    makeDraggable(el, state.bomb);
    mapContainer.appendChild(el);
  }
}

// =======================
// 🔹 DRAG
// =======================
function makeDraggable(el, data) {
  let dragging = false;
  let ox = 0, oy = 0;

  el.onmousedown = e => {
    dragging = true;
    ox = e.offsetX;
    oy = e.offsetY;
  };

  document.onmousemove = e => {
    if (!dragging) return;
    const r = mapContainer.getBoundingClientRect();

    data.x = Math.max(0, Math.min(e.clientX - r.left - ox, r.width - el.offsetWidth));
    data.y = Math.max(0, Math.min(e.clientY - r.top - oy, r.height - el.offsetHeight));

    el.style.left = `${data.x}px`;
    el.style.top = `${data.y}px`;
  };

  document.onmouseup = async () => {
    if (!dragging) return;
    dragging = false;
    await saveCurrentStep();
  };
}

// =======================
// 🔹 VIDEO PREVIEW
// =======================
function showVideoPreview(id, anchor) {
  let preview = document.getElementById("video-preview");
  let frame = document.getElementById("video-frame");

  if (!preview) {
    preview = document.createElement("div");
    preview.id = "video-preview";
    preview.innerHTML = `<iframe id="video-frame" allowfullscreen></iframe>`;
    document.body.appendChild(preview);

    preview.onmouseenter = () => videoHoverActive = true;
    preview.onmouseleave = () => {
      videoHoverActive = false;
      hideVideoPreview();
    };
  }

  frame = preview.querySelector("iframe");
  frame.src = `https://www.youtube.com/embed/${id}`;

  const r = anchor.getBoundingClientRect();
  preview.style.left = `${r.right + 10}px`;
  preview.style.top = `${r.top}px`;
  preview.classList.remove("hidden");
}

function hideVideoPreview() {
  const preview = document.getElementById("video-preview");
  if (!preview) return;
  preview.querySelector("iframe").src = "";
  preview.classList.add("hidden");
}

// =======================
// 🔹 GRENADE EDITOR
// =======================
function openGrenadeEditor(grenade) {
  const url = prompt("URL do vídeo do YouTube:", grenade.youtubeId || "");
  grenade.youtubeId = extractYoutubeId(url);
  saveCurrentStep();
  renderStep();
}

function extractYoutubeId(url) {
  try {
    const u = new URL(url);
    if (u.searchParams.get("v")) return u.searchParams.get("v");
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1);
  } catch {}
  return null;
}

// =======================
// 🔹 FIRESTORE
// =======================
async function saveCurrentStep() {
  if (!currentStrategyId) return;
  ensureStepState(currentStep);

  await setDoc(
    doc(db, "strategies", currentStrategyId, "steps", String(currentStep)),
    { stepNumber: currentStep, state: stepStates[currentStep] }
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
// 🔹 UI HELPERS
// =======================
function showLoader() {
  document.getElementById("loader").classList.remove("hidden");
}

function hideLoader() {
  document.getElementById("loader").classList.add("hidden");
}
