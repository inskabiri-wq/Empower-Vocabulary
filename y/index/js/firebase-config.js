/* ============================================
   FIREBASE-CONFIG.JS - Firebase Initialization
   Empower Vocabulary Trainer
   ============================================ */

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyDmTTictWJmxVxj9frqSODPUjOgpRPPNzU",
  authDomain: "empower-vocabulary-practice.firebaseapp.com",
  projectId: "empower-vocabulary-practice",
  storageBucket: "empower-vocabulary-practice.firebasestorage.app",
  messagingSenderId: "136270199832",
  appId: "1:136270199832:web:174222066ef1cbdc8f576d",
  measurementId: "G-1BBXBVEP5C"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize services
const auth = firebase.auth();
const db = firebase.firestore();

// Initialize App Check with error handling
try {
  const appCheck = firebase.appCheck();
  appCheck.activate('6Lc-jS0sAAAAADZHuluoJrM8aJWCLwiJPedS8ki7', true);
} catch (error) {
  console.log('App Check initialization failed:', error);
}
