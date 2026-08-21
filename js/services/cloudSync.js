/**
 * Pusat Barkas Solo Raya - Central Real-Time Worldwide Cloud Sync Engine
 * Powered by High-Speed Cloud SSE / WebSockets PubSub with Cache-Busting
 */

const CLOUD_SYNC_TOPIC = 'pusat_barkas_solo_raya_sync_v4';
const CLOUD_SYNC_URL = `https://ntfy.sh/${CLOUD_SYNC_TOPIC}`;

let eventSource = null;
let isConnected = false;

// -------------------------------------------------------------
// INITIALIZE CLOUD REAL-TIME LISTENER (ON HP & ALL DEVICES)
// -------------------------------------------------------------
export function initCloudRealtimeSync(onTextsUpdate, onSettingsUpdate, onListingsUpdate, onUsersUpdate) {
  // 1. Fetch latest state from cloud with Cache-Busting on startup
  fetchLatestCloudState(onTextsUpdate, onSettingsUpdate, onListingsUpdate, onUsersUpdate);

  // 2. Open Real-Time SSE Stream for instant live updates across devices
  startRealtimeStream(onTextsUpdate, onSettingsUpdate, onListingsUpdate, onUsersUpdate);
}

// Fetch latest updates with cache-busting
export async function fetchLatestCloudState(onTextsUpdate, onSettingsUpdate, onListingsUpdate, onUsersUpdate) {
  try {
    const cacheBuster = Date.now();
    const res = await fetch(`${CLOUD_SYNC_URL}/json?poll=1&_cb=${cacheBuster}`, { 
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
    if (!res.ok) return;

    const textData = await res.text();
    if (!textData || !textData.trim()) return;

    const lines = textData.trim().split('\n');
    let latestTexts = null;
    let latestSettings = null;
    let latestListings = null;
    let latestUsers = null;

    lines.forEach((line) => {
      try {
        if (!line.trim()) return;
        const item = JSON.parse(line);
        if (item.event === 'message' && item.message) {
          const payload = typeof item.message === 'string' ? JSON.parse(item.message) : item.message;
          if (!payload || typeof payload !== 'object') return;

          if (payload.type === 'SETTINGS_UPDATED' && payload.data) {
            const msgTime = payload.data.updatedAt ? new Date(payload.data.updatedAt).getTime() : (payload.timestamp || item.time * 1000 || 0);
            const curTime = latestSettings?.updatedAt ? new Date(latestSettings.updatedAt).getTime() : 0;
            if (!latestSettings || msgTime >= curTime) {
              latestSettings = payload.data;
            }
          } else if (payload.type === 'TEXTS_UPDATED' && payload.data) {
            const msgTime = payload.data.updatedAt ? new Date(payload.data.updatedAt).getTime() : (payload.timestamp || item.time * 1000 || 0);
            const curTime = latestTexts?.updatedAt ? new Date(latestTexts.updatedAt).getTime() : 0;
            if (!latestTexts || msgTime >= curTime) {
              latestTexts = payload.data;
            }
          } else if (payload.type === 'LISTINGS_UPDATED' && payload.data) {
            latestListings = payload.data;
          } else if (payload.type === 'USERS_UPDATED' && payload.data) {
            latestUsers = payload.data;
          }
        }
      } catch (e) {}
    });

    if (latestTexts && onTextsUpdate) onTextsUpdate(latestTexts);
    if (latestSettings && onSettingsUpdate) onSettingsUpdate(latestSettings);
    if (latestListings && onListingsUpdate) onListingsUpdate(latestListings);
    if (latestUsers && onUsersUpdate) onUsersUpdate(latestUsers);
  } catch (err) {
    console.warn("Cloud initial sync passive notice:", err);
  }
}

// Live SSE Stream
function startRealtimeStream(onTextsUpdate, onSettingsUpdate, onListingsUpdate, onUsersUpdate) {
  if (eventSource) {
    try { eventSource.close(); } catch (e) {}
  }

  try {
    eventSource = new EventSource(`${CLOUD_SYNC_URL}/sse`);

    eventSource.onopen = () => {
      isConnected = true;
    };

    eventSource.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.event === 'message' && msg.message) {
          const payload = typeof msg.message === 'string' ? JSON.parse(msg.message) : msg.message;
          if (!payload || typeof payload !== 'object') return;

          if (payload.type === 'TEXTS_UPDATED' && payload.data) {
            if (onTextsUpdate) onTextsUpdate(payload.data);
          } else if (payload.type === 'SETTINGS_UPDATED' && payload.data) {
            if (onSettingsUpdate) onSettingsUpdate(payload.data);
          } else if (payload.type === 'LISTINGS_UPDATED' && payload.data) {
            if (onListingsUpdate) onListingsUpdate(payload.data);
          } else if (payload.type === 'USERS_UPDATED' && payload.data) {
            if (onUsersUpdate) onUsersUpdate(payload.data);
          }
        }
      } catch (err) {
        console.warn("Error parsing cloud realtime message:", err);
      }
    };

    eventSource.onerror = () => {
      isConnected = false;
    };
  } catch (e) {
    console.warn("SSE stream init:", e);
  }
}

// -------------------------------------------------------------
// BROADCAST UPDATE TO ALL CONNECTED DEVICES WORLDWIDE
// -------------------------------------------------------------
export async function broadcastToCloud(type, data) {
  try {
    const payload = JSON.stringify({
      type,
      data,
      timestamp: Date.now()
    });

    await fetch(CLOUD_SYNC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      body: payload
    });
    return true;
  } catch (err) {
    console.warn("Failed to broadcast to cloud:", err);
    return false;
  }
}
