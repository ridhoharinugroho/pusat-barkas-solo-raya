/**
 * Pusat Jual Beli Solo Raya - Central Real-Time Worldwide Cloud Sync Engine
 * High-Speed Multi-Relay SSE & Cloud PubSub with Cache-Busting
 */

const PRIMARY_SYNC_URL = 'https://ntfy.envs.net/pusat_barkas_settings_280995';
const SECONDARY_SYNC_URL = 'https://ntfy.sh/pusat_barkas_settings_280995';

const CLOUD_ENDPOINTS = [PRIMARY_SYNC_URL, SECONDARY_SYNC_URL];

let eventSource = null;
let isConnected = false;
let isCloudSyncInitialized = false;
let sseErrorCount = 0;
const MAX_SSE_ERRORS = 3;

// -------------------------------------------------------------
// INITIALIZE CLOUD REAL-TIME LISTENER (ON HP & ALL DEVICES)
// -------------------------------------------------------------
export function initCloudRealtimeSync(onTextsUpdate, onSettingsUpdate, onListingsUpdate, onUsersUpdate) {
  if (isCloudSyncInitialized) return;
  isCloudSyncInitialized = true;

  // 1. Fresh Fetch latest state from central cloud with Cache-Busting
  fetchLatestCloudState(onTextsUpdate, onSettingsUpdate, onListingsUpdate, onUsersUpdate);

  // 2. Open Real-Time SSE Stream for instant sub-50ms live updates
  startRealtimeStream(onTextsUpdate, onSettingsUpdate, onListingsUpdate, onUsersUpdate);
}

// Fresh Fetch latest updates with cache-busting from central database
export async function fetchLatestCloudState(onTextsUpdate, onSettingsUpdate, onListingsUpdate, onUsersUpdate) {
  const cacheBuster = Date.now();
  
  for (const baseUrl of CLOUD_ENDPOINTS) {
    try {
      const res = await fetch(`${baseUrl}/json?poll=1&_cb=${cacheBuster}`, { 
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      if (!res.ok) continue;

      const textData = await res.text();
      if (!textData || !textData.trim()) continue;

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

      // Successfully fetched from working relay
      return;
    } catch (err) {
      // Fallback to next endpoint
    }
  }
}

// Live SSE Stream with auto-reconnect limit
function startRealtimeStream(onTextsUpdate, onSettingsUpdate, onListingsUpdate, onUsersUpdate) {
  if (eventSource) {
    try { eventSource.close(); } catch (e) {}
  }

  try {
    eventSource = new EventSource(`${PRIMARY_SYNC_URL}/sse`);

    eventSource.onopen = () => {
      isConnected = true;
      sseErrorCount = 0;
    };

    eventSource.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.event === 'message' && msg.message) {
          const payload = typeof msg.message === 'string' ? JSON.parse(msg.message) : msg.message;
          if (!payload || typeof payload !== 'object') return;

          if (payload.type === 'SETTINGS_UPDATED' && payload.data) {
            if (onSettingsUpdate) onSettingsUpdate(payload.data);
          } else if (payload.type === 'TEXTS_UPDATED' && payload.data) {
            if (onTextsUpdate) onTextsUpdate(payload.data);
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
      sseErrorCount++;
      if (sseErrorCount >= MAX_SSE_ERRORS) {
        console.warn("[CloudSync] Max SSE retry attempts reached. Closing EventSource to prevent network overload.");
        try { eventSource.close(); } catch (e) {}
      }
    };
  } catch (e) {
    console.warn("SSE stream init:", e);
  }
}

// -------------------------------------------------------------
// BROADCAST UPDATE TO ALL CONNECTED DEVICES IN PARALLEL
// -------------------------------------------------------------
export async function broadcastToCloud(type, data) {
  const payload = JSON.stringify({
    type,
    data,
    timestamp: Date.now()
  });

  const promises = CLOUD_ENDPOINTS.map((url) => 
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      body: payload
    }).catch(() => null)
  );

  await Promise.allSettled(promises);
  return true;
}

