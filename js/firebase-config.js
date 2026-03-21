// ==========================================
// FIREBASE-CONFIG.JS - Firebase & Firestore
// ==========================================

const firebaseConfig = {
    apiKey: "AIzaSyCb6S8L-HtM9xV8PW2O8B8a1Jag2rria6c",
    authDomain: "pid-cascade-scores.firebaseapp.com",
    projectId: "pid-cascade-scores",
    storageBucket: "pid-cascade-scores.firebasestorage.app",
    messagingSenderId: "1047450043184",
    appId: "1:1047450043184:web:c7ec8a6ce0f160ea2fbef5"
};

let db = null;
let firebaseInitialized = false;

function initFirebase() {
    if (firebaseInitialized) return;
    
    try {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        firebaseInitialized = true;
        console.log('[Firebase] Initialized successfully');
    } catch (error) {
        console.error('[Firebase] Initialization failed:', error);
    }
}

async function saveScoreToFirebase(name, score, mode) {
    if (!db) {
        console.error('[Firebase] Firestore not initialized');
        return { success: false, error: 'Firestore not initialized' };
    }
    
    const entry = {
        name: name.trim().substring(0, 20),
        score: parseFloat(score),
        mode: mode || 'unknown',
        timestamp: Date.now(),
        date: new Date().toISOString().split('T')[0]
    };
    
    try {
        const docRef = await db.collection('leaderboard').add(entry);
        console.log('[Firebase] Score saved with ID:', docRef.id);
        return { success: true, id: docRef.id };
    } catch (error) {
        console.error('[Firebase] Error saving score:', error);
        return { success: false, error: error.message };
    }
}

async function getLeaderboard(limit = 10) {
    if (!db) {
        console.error('[Firebase] Firestore not initialized');
        return [];
    }
    
    try {
        const snapshot = await db.collection('leaderboard')
            .orderBy('score', 'asc')
            .limit(limit)
            .get();
        
        const scores = [];
        snapshot.forEach(doc => {
            scores.push({ id: doc.id, ...doc.data() });
        });
        
        console.log('[Firebase] Leaderboard fetched:', scores.length, 'entries');
        return scores;
    } catch (error) {
        console.error('[Firebase] Error fetching leaderboard:', error);
        return [];
    }
}

function subscribeToLeaderboard(callback, limit = 10) {
    if (!db) {
        console.error('[Firebase] Firestore not initialized');
        return null;
    }
    
    return db.collection('leaderboard')
        .orderBy('score', 'asc')
        .limit(limit)
        .onSnapshot(
            snapshot => {
                const scores = [];
                snapshot.forEach(doc => {
                    scores.push({ id: doc.id, ...doc.data() });
                });
                callback(scores);
            },
            error => {
                console.error('[Firebase] Leaderboard subscription error:', error);
            }
        );
}
