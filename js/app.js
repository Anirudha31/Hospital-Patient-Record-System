const firebaseConfig = {
  apiKey: "AIzaSyAVULPxlDkN8kqdZ1weiFQ76XVE2TnzY44",
  authDomain: "hospital-patient-record-system.firebaseapp.com",
  projectId: "hospital-patient-record-system",
  storageBucket: "hospital-patient-record-system.firebasestorage.app",
  messagingSenderId: "171141672577",
  appId: "1:171141672577:web:db8457293927e553f9e780",
  measurementId: "G-VJ147WN7LX"
};


firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Sign Up
async function signup() {
  const email = document.getElementById("suEmail").value;
  const pass = document.getElementById("suPass").value;
  const pass2 = document.getElementById("suPass2").value;
  const msg = document.getElementById("suMsg");

  msg.textContent = "";

  if (pass !== pass2) {
    msg.textContent = "❌ Passwords do not match.";
    return;
  }

  try {
    const user = await auth.createUserWithEmailAndPassword(email, pass);
    await db.collection("users").doc(user.user.uid).set({
      email,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    msg.textContent = "✅ Account created!";
    setTimeout(() => (window.location = "dashboard.html"), 1000);
  } catch (err) {
    msg.textContent = "❌ " + err.message;
  }
}

// Login
async function login() {
  const email = document.getElementById("loginEmail").value;
  const pass = document.getElementById("loginPass").value;
  const msg = document.getElementById("loginMsg");

  try {
    await auth.signInWithEmailAndPassword(email, pass);
    msg.textContent = "✅ Logged in!";
    setTimeout(() => (window.location = "dashboard.html"), 800);
  } catch (err) {
    msg.textContent = "❌ " + err.message;
  }
}

// Logout
document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  await auth.signOut();
  window.location = "login.html";
});

document.getElementById("createBtn")?.addEventListener("click", signup);
document.getElementById("loginBtn")?.addEventListener("click", login);
