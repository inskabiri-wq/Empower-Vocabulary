/* Student Dashboard - Config & State */

// Security: HTML escape to prevent XSS via user-controlled content
function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

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
const auth = firebase.auth();
const db = firebase.firestore();

// DATA - Loaded from external file
let datasets = {};
let allBookData = {}; // Store all book datasets
let multipleChoiceOverrides = {}; // Hand-curated multiple choice options
let selectedBook = localStorage.getItem('selectedBook') || 'empower';

// Book dataset file mapping
const bookFiles = {
  'empower': 'datasets.json',
  'gateway': 'gateway_dataset.json'
};

// Load multiple choice overrides from JSON file.
// Keys are normalized to lowercase so lookup is case-insensitive. This
// protects against dataset words like "January", "Monday", or any phrase
// whose casing might differ between dataset authoring and override authoring.
async function loadMultipleChoiceOverrides() {
  try {
    const response = await fetch('student/js/multipleChoiceOverrides.json');
    const data = await response.json();
    const normalized = {};
    Object.keys(data).forEach(k => {
      if (k === '_instructions') return;
      normalized[String(k).toLowerCase()] = data[k];
    });
    multipleChoiceOverrides = normalized;
    console.log('✅ Multiple choice overrides loaded:', Object.keys(normalized).length, 'words');
    return normalized;
  } catch (error) {
    console.warn('⚠️ No multipleChoiceOverrides.json found (optional)', error);
    return {};
  }
}

// Load datasets from JSON file based on selected book
async function loadBookDataset(book) {
  const file = bookFiles[book] || bookFiles['empower'];
  try {
    const response = await fetch(file);
    const data = await response.json();
    allBookData[book] = data;
    datasets = data;
    console.log(`${book} dataset loaded successfully`);
    return data;
  } catch (error) {
    console.error(`Error loading ${book} dataset:`, error);
    return null;
  }
}

// Dataset-load gate. Before this flips true, activity buttons can't yield
// words — the fetch is still in flight. startActivity() reads this flag
// so it can show a friendly "still loading" message instead of the
// misleading "no words available" when someone clicks too fast, or when
// a book switch is mid-swap.
let datasetsReady = false;

// Initial load - load both datasets and overrides
loadBookDataset(selectedBook).then(() => {
  loadMultipleChoiceOverrides().then(() => {
    datasetsReady = true;
    // Refresh UI after loading
    if (typeof populateUnitSelector === 'function') {
      populateUnitSelector();
      updateWordCount();
    }
  });
});

// STATE
let selectedLevel = 'A2';
let selectedUnit = 'all';
let currentWords = [];
let currentIndex = 0;
let score = 0;
let sessionStreak = 0;
let missedWords = [];
let currentActivity = null;
let soundEnabled = true;
let turkishEnabled = false;
let speechSynthesis = window.speechSynthesis;
let selectedAccent = localStorage.getItem('accent') || 'US';
let selectedItems = [];
let orderAnswer = [];
let hintsUsed = 0;
let orderAttempts = 0;

// Match game state
let matchBatchStart = 0;
let matchedInBatch = 0;

// Journey Stats
let journeyStats = {
  totalSessions: 0,
  totalWordsLearned: 0,
  totalCorrect: 0,
  averageScore: 0,
  activitiesCompleted: {},
  recentActivity: null
};

// Profile System
let userProfile = {
  avatar: 'fox',   // emoji avatar key (matches data-avatar in grid)
  level: 1,
  xp: 0,
  achievements: []
};

// Learning Map
let mapProgress = {};
