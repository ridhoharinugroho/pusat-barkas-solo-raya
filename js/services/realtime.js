/**
 * Pusat Barkas Solo Raya - Real-Time Multi-Device Synchronization Engine
 * Powered by WebSockets / Firebase Realtime Cloud & Backend REST API
 */

import { getSiteSettings, getCustomTexts, getAllListings } from './storage.js';

// Native Browser BroadcastChannel for 0ms cross-tab synchronization
const broadcastChannel = typeof BroadcastChannel !== 'undefined' 
  ? new BroadcastChannel('pusat_barkas_realtime_channel') 
  : null;

// Real-Time Engine State
export const realtimeState = {
  isWebSocketConnected: false,
  isFirebaseActive: false,
  lastSyncTimestamp: null,
  activeTransport: 'connecting' // 'websocket', 'rest_live', 'broadcast'
};

// Initialize Realtime Listeners
export function initRealtimeEngine(onSettingsUpdate, onTextsUpdate, onListingsUpdate) {
  // 1. Listen to Local BroadcastChannel (Cross-Tab on same device)
  if (broadcastChannel) {
    broadcastChannel.onmessage = (event) => {
      const msg = event.data;
      if (!msg || !msg.type) return;

      if (msg.type === 'SETTINGS_UPDATED' && onSettingsUpdate) {
        onSettingsUpdate(msg.payload);
      } else if (msg.type === 'TEXTS_UPDATED' && onTextsUpdate) {
        onTextsUpdate(msg.payload);
      } else if (msg.type === 'LISTINGS_UPDATED' && onListingsUpdate) {
        onListingsUpdate(msg.payload);
      }
    };
  }

  // 2. Initialize Firebase Realtime Database (WebSockets)
  initFirebaseRealtime(onSettingsUpdate, onTextsUpdate, onListingsUpdate);

  // 3. Start High-Frequency Server Poll (1.5-second live pulse)
  startLivePulse(onSettingsUpdate, onTextsUpdate, onListingsUpdate);
}

// -------------------------------------------------------------
// FIREBASE REALTIME WEBSOCKETS (CLOUD MULTI-DEVICE SYNC)
// -------------------------------------------------------------
function initFirebaseRealtime(onSettingsUpdate, onTextsUpdate, onListingsUpdate) {
  if (typeof firebase === 'undefined') return;

  try {
    const firebaseConfig = {
      databaseURL: "https://pusat-barkas-solo-raya-default-rtdb.asia-southeast1.firebasedatabase.app"
    };

    if (!firebase.apps || firebase.apps.length === 0) {
      firebase.initializeApp(firebaseConfig);
    }

    const db = firebase.database();

    // Listen to Real-Time Settings changes via WebSockets
    db.ref('site_settings').on('value', (snapshot) => {
      const data = snapshot.val();
      if (data) {
        realtimeState.isFirebaseActive = true;
        realtimeState.isWebSocketConnected = true;
        realtimeState.activeTransport = 'websocket';
        if (onSettingsUpdate) onSettingsUpdate(data);
      }
    });

    // Listen to Real-Time Texts changes via WebSockets
    db.ref('custom_texts').on('value', (snapshot) => {
      const data = snapshot.val();
      if (data) {
        realtimeState.isFirebaseActive = true;
        realtimeState.isWebSocketConnected = true;
        realtimeState.activeTransport = 'websocket';
        if (onTextsUpdate) onTextsUpdate(data);
      }
    });

    // Listen to Real-Time Listings changes via WebSockets
    db.ref('listings').on('value', (snapshot) => {
      const data = snapshot.val();
      if (data && Array.isArray(data)) {
        realtimeState.isFirebaseActive = true;
        realtimeState.isWebSocketConnected = true;
        realtimeState.activeTransport = 'websocket';
        if (onListingsUpdate) onListingsUpdate(data);
      }
    });

  } catch (err) {
    console.warn("Firebase Realtime init notice:", err);
  }
}

// -------------------------------------------------------------
// REAL-TIME BROADCAST DISPATCHER
// -------------------------------------------------------------
export function broadcastRealtimeUpdate(type, payload) {
  // 1. Broadcast locally
  if (broadcastChannel) {
    broadcastChannel.postMessage({ type, payload, timestamp: Date.now() });
  }

  // 2. Broadcast to Firebase Realtime WebSockets if available
  if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
    try {
      const db = firebase.database();
      if (type === 'SETTINGS_UPDATED') {
        db.ref('site_settings').set(payload);
      } else if (type === 'TEXTS_UPDATED') {
        db.ref('custom_texts').set(payload);
      } else if (type === 'LISTINGS_UPDATED') {
        db.ref('listings').set(payload);
      }
    } catch (e) {
      console.warn("Firebase broadcast skipped:", e);
    }
  }
}

// -------------------------------------------------------------
// LIVE SERVER PULSE (1.5s FAST REAL-TIME POLLING & AUTO-UPDATE)
// -------------------------------------------------------------
let livePulseInterval = null;
let lastKnownSettingsVersion = null;
let lastKnownTextsVersion = null;
let lastKnownListingsVersion = null;

function startLivePulse(onSettingsUpdate, onTextsUpdate, onListingsUpdate) {
  if (livePulseInterval) clearInterval(livePulseInterval);

  async function checkLivePulse() {
    const origin = window.location.origin;
    const isLocalServer = origin.includes(':5500');
    const baseUrl = isLocalServer ? origin : '';

    try {
      // 1. Check Settings
      const settingsUrl = isLocalServer ? `${baseUrl}/api/settings` : './db/site_settings.json';
      const sRes = await fetch(settingsUrl, { cache: 'no-cache' });
      if (sRes.ok) {
        const data = await sRes.json();
        const ver = JSON.stringify(data);
        if (lastKnownSettingsVersion && lastKnownSettingsVersion !== ver) {
          if (onSettingsUpdate) onSettingsUpdate(data);
        }
        lastKnownSettingsVersion = ver;
      }

      // 2. Check Texts
      const textsUrl = isLocalServer ? `${baseUrl}/api/texts` : './db/custom_texts.json';
      const tRes = await fetch(textsUrl, { cache: 'no-cache' });
      if (tRes.ok) {
        const data = await tRes.json();
        const ver = JSON.stringify(data);
        if (lastKnownTextsVersion && lastKnownTextsVersion !== ver) {
          if (onTextsUpdate) onTextsUpdate(data);
        }
        lastKnownTextsVersion = ver;
      }

      // 3. Check Listings
      const listingsUrl = isLocalServer ? `${baseUrl}/api/listings` : './db/listings.json';
      const lRes = await fetch(listingsUrl, { cache: 'no-cache' });
      if (lRes.ok) {
        const data = await lRes.json();
        const ver = JSON.stringify(data);
        if (lastKnownListingsVersion && lastKnownListingsVersion !== ver) {
          if (onListingsUpdate) onListingsUpdate(data);
        }
        lastKnownListingsVersion = ver;
      }

      realtimeState.lastSyncTimestamp = new Date();
    } catch (err) {
      // Offline / passive mode
    }
  }

  // Initial check
  checkLivePulse();

  // Pulse every 1.5 seconds
  livePulseInterval = setInterval(checkLivePulse, 1500);

  // Instant check on tab focus or screen unlock
  window.addEventListener('focus', checkLivePulse);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkLivePulse();
  });
}
