import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

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
const provider = new GoogleAuthProvider();

const loginBtn = document.getElementById("loginBtn");
const status = document.getElementById("status");

loginBtn.addEventListener("click", async () => {
  await signInWithPopup(auth, provider);
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    status.textContent = `logado como ${user.displayName}`;
    loginBtn.style.display = "none";
  } else {
    status.textContent = "não logado";
    loginBtn.style.display = "inline-block";
  }
});
