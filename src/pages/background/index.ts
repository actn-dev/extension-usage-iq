// Dilly Background Service Worker
// Monitors browser activity and tracks time spent on websites

import { extractDomain, getCurrentDateString, shouldTrackUrl } from '../../types';
import { startBadgeTimer, stopBadgeTimer } from '../../utils/badgeManager';
import { getBlockConfigSync } from '../../utils/blockConfigSync';
import { initializeBlocking, updateBlockingRules } from '../../utils/blockManager';
import { getBlockConfig, getDomainMinutesUsedToday } from '../../utils/blockStorage';
import { getDeviceInfo, setDeviceName } from '../../utils/deviceManager';
import { handleContentScriptMessage } from '../../utils/heartbeatTracker';
import { endBrowserSession, resumeSessionIfExists } from '../../utils/sessionManager';
import { getSessionState, getTodayActivity, incrementVisitCount, initializeStorage, rolloverToNewDay } from '../../utils/storage';
import { getSyncManager } from '../../utils/syncManager';
import { addTab, initializeTabTracker, removeTab, updateTab } from '../../utils/tabTracker';
import { accumulateUnfocusedIdleTime, handleIdleStateChange, pauseTracking, resumeTracking, startTracking, stopTracking } from '../../utils/timeTracker';

console.log('Dilly background service worker loaded');

// Configuration: Time tracking interval
// Set to 1 for debugging (updates every second)
// Set to 60 for production (updates every minute, low CPU overhead)
const TIME_TRACKING_INTERVAL_SECONDS = 60; // Change to 60 for production

// Initialize extension
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Extension installed/updated:', details.reason);

  // Initialize storage
  await initializeStorage();
  
  // Resume existing session or start new one (handles extension reload)
  await resumeSessionIfExists();
  
  // Initialize tab tracker with all open tabs
  await initializeTabTracker();
  
  // Fetch initial blocking config from server (if authenticated)
  const blockConfigSync = getBlockConfigSync();
  await blockConfigSync.fetchConfig();
  
  // Initialize blocking system with server config
  await initializeBlocking();
  
  // Start periodic config sync
  blockConfigSync.startPeriodicSync();
  
  // Initialize sync manager
  const syncManager = getSyncManager();
  await syncManager.initialize();
  
  // Set up idle detection (5 minutes = 300 seconds)
  chrome.idle.setDetectionInterval(300);
  
  // Set up daily rollover alarm (runs at midnight)
  chrome.alarms.create('dailyRollover', {
    when: getNextMidnight(),
    periodInMinutes: 24 * 60, // Once per day
  });
  
  // Set up periodic check for time limits and schedules (every minute)
  chrome.alarms.create('checkTimeLimits', {
    periodInMinutes: 1,
  });
  
  // Set up frequent schedule checks (every 5 minutes)
  chrome.alarms.create('checkSchedules', {
    periodInMinutes: 5,
  });
  
  // Set up time tracking alarm (configurable interval)
  if (TIME_TRACKING_INTERVAL_SECONDS >= 60) {
    // Use periodInMinutes for intervals >= 60 seconds
    chrome.alarms.create('trackTime', {
      periodInMinutes: TIME_TRACKING_INTERVAL_SECONDS / 60,
    });
  } else {
    // Use delayInMinutes with repeating creation for sub-minute intervals
    chrome.alarms.create('trackTime', {
      delayInMinutes: TIME_TRACKING_INTERVAL_SECONDS / 60,
    });
  }
  
  // Start badge timer (updates every second)
  startBadgeTimer();
  
  console.log('Dilly initialized successfully');
});

// Handle window close - end session if last window is closed
chrome.windows.onRemoved.addListener(async (windowId) => {
  try {
    const allWindows = await chrome.windows.getAll();
    if (allWindows.length === 0) {
      // Last Chrome window closed, end the session
      console.log('Last Chrome window closed, ending session');
      await endBrowserSession();
    }
  } catch (error) {
    console.error('Error handling window close:', error);
  }
});

// Handle extension startup (browser restart)
chrome.runtime.onStartup.addListener(async () => {
  console.log('Browser started, resuming Dilly monitoring');
  await initializeStorage();
  
  // Resume or start new browser session
  await resumeSessionIfExists();
  
  // Initialize tab tracker with all open tabs
  await initializeTabTracker();
  
  // Check if day changed while browser was closed
  const today = await getTodayActivity();
  const currentDate = getCurrentDateString();
  if (today.date !== currentDate) {
    await rolloverToNewDay();
  }
  
  // Resume tracking if there's an active tab
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs[0] && tabs[0].id && tabs[0].url) {
    await startTracking(tabs[0].id, tabs[0].url);
  }
  
  // Start badge timer
  startBadgeTimer();
});

// Tab activated (user switched to different tab)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const activationTime = Date.now();
  console.log(`[TRACKING] Tab activated: ${activeInfo.tabId} at ${activationTime}`);
  
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url) {
      // Add/update tab in tracker
      addTab(activeInfo.tabId, tab.url);
      
      const domain = extractDomain(tab.url);
      if (domain && shouldTrackUrl(tab.url)) {
        await incrementVisitCount(domain);
      }
      console.log(`[TRACKING] Starting tracking for domain: ${domain} at ${Date.now()} (${Date.now() - activationTime}ms after activation)`);
      await startTracking(activeInfo.tabId, tab.url);
      
      // Badge timer is already running, will pick up new state immediately
    }
  } catch (error) {
    console.error('Error handling tab activation:', error);
  }
});

// Tab updated (URL changed, page loaded, etc.)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only process when URL changes
  if (changeInfo.url) {
    const state = await getSessionState();
    
    // Update tab in tracker
    updateTab(tabId, changeInfo.url);
    
    // Only start tracking if this is the active tab
    if (state.activeTabId === tabId) {
      console.log('Active tab URL updated:', changeInfo.url);
      
      const domain = extractDomain(changeInfo.url);
      if (domain && shouldTrackUrl(changeInfo.url)) {
        await incrementVisitCount(domain);
      }
      await startTracking(tabId, changeInfo.url);
    }
  }
});

// Tab removed (closed)
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const state = await getSessionState();
  
  // Remove from tracker (this will save open duration)
  await removeTab(tabId);
  
  if (state.activeTabId === tabId) {
    console.log('Active tab closed:', tabId);
    await stopTracking();
    
    // Try to activate another tab if available
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0] && tabs[0].id && tabs[0].url) {
      await startTracking(tabs[0].id, tabs[0].url);
    }
  }
});

// Window focus changed
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // No window has focus
    console.log('All windows lost focus');
    await pauseTracking('windowBlur');
  } else {
    // A window gained focus
    console.log('Window gained focus:', windowId);
    
    // Get the active tab in the focused window
    const tabs = await chrome.tabs.query({ active: true, windowId });
    if (tabs[0] && tabs[0].id && tabs[0].url) {
      await resumeTracking('windowFocus');
      await startTracking(tabs[0].id, tabs[0].url);
    }
  }
});

// Idle state changed
chrome.idle.onStateChanged.addListener(async (newState) => {
  console.log('Idle state changed:', newState);
  // @ts-expect-error TS doesn't recognize async listener
  await handleIdleStateChange(newState);
});

// Handle alarms (daily rollover, time limit checks, etc.)
chrome.alarms.onAlarm.addListener(async (alarm) => {
  console.log('Alarm triggered:', alarm.name);
  
  if (alarm.name === 'dailyRollover') {
    console.log('Performing daily rollover');
    await rolloverToNewDay();
  } else if (alarm.name === 'checkTimeLimits') {
    // Check if any domains have exceeded time limits
    await checkAndUpdateTimeLimits();
  } else if (alarm.name === 'checkSchedules') {
    // Check if schedule-based blocks need to be updated
    await checkAndUpdateSchedules();
  } else if (alarm.name === 'syncBlockConfig') {
    // Fetch fresh blocking config from server
    const blockConfigSync = getBlockConfigSync();
    await blockConfigSync.fetchConfig();
    // Re-apply blocking rules with new config
    await updateBlockingRules();
  } else if (alarm.name === 'syncBlockAttempts') {
    // Sync pending block attempts to server
    const blockConfigSync = getBlockConfigSync();
    await blockConfigSync.syncBlockAttempts();
  } else if (alarm.name === 'trackTime') {
    // Only accumulate unfocused/idle time (active time is handled by content script heartbeats)
    await accumulateUnfocusedIdleTime();
    
    // Re-create alarm for sub-minute intervals (Chrome doesn't support periodInMinutes < 1)
    if (TIME_TRACKING_INTERVAL_SECONDS < 60) {
      chrome.alarms.create('trackTime', {
        delayInMinutes: TIME_TRACKING_INTERVAL_SECONDS / 60,
      });
    }
  }
});

// Helper: Get next midnight timestamp
function getNextMidnight(): number {
  const now = new Date();
  const midnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0, 0, 0, 0
  );
  return midnight.getTime();
}

// Clean shutdown - save state before service worker terminates
self.addEventListener('beforeunload', async () => {
  console.log('Service worker shutting down, saving state');
  stopBadgeTimer();
  await stopTracking();
  await endBrowserSession();
});

// Listen for messages from popup/options AND content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle content script heartbeats
  if (message.type === 'heartbeat' || message.type === 'visibilityChange') {
    const receiveTime = Date.now();
    const domain = message.domain || 'unknown';
    console.log(`[TRACKING-BG] Received ${message.type} from ${domain} at ${receiveTime} (sent at ${message.timestamp}, delay: ${receiveTime - message.timestamp}ms)`);
    handleContentScriptMessage(message, sender, sendResponse);
    return true; // Keep channel open for async response
  }
  
  if (message.type === 'AUTH_STATE_CHANGED') {
    handleAuthStateChange(message.authenticated).then(() => {
      sendResponse({ success: true });
    });
    return true; // Keep channel open for async response
  }
  
  if (message.type === 'MANUAL_SYNC') {
    handleManualSync().then((result) => {
      sendResponse(result);
    });
    return true;
  }
  
  if (message.type === 'GET_SYNC_STATUS') {
    getSyncStatus().then((status) => {
      sendResponse(status);
    });
    return true;
  }
  
  if (message.type === 'UPDATE_BLOCKING_RULES') {
    updateBlockingRules().then(() => {
      sendResponse({ success: true });
    }).catch(error => {
      console.error('Error updating blocking rules:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }
  
  if (message.type === 'GET_DEVICE_INFO') {
    getDeviceInfo().then((deviceInfo) => {
      sendResponse(deviceInfo);
    }).catch(error => {
      console.error('Error getting device info:', error);
      sendResponse({ error: error.message });
    });
    return true;
  }
  
  if (message.type === 'SET_DEVICE_NAME') {
    setDeviceName(message.deviceName).then(() => {
      sendResponse({ success: true });
    }).catch(error => {
      console.error('Error setting device name:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }
});

// Handle auth state changes
async function handleAuthStateChange(authenticated: boolean): Promise<void> {
  const syncManager = getSyncManager();
  const blockConfigSync = getBlockConfigSync();
  
  if (authenticated) {
    console.log('User logged in, starting auto-sync');
    await syncManager.startAutoSync();
    // Perform immediate sync for activity
    await syncManager.syncNow();
    // Fetch blocking config from server
    await blockConfigSync.fetchConfig();
    // Update blocking rules
    await updateBlockingRules();
  } else {
    console.log('User logged out, stopping auto-sync');
    await syncManager.stopAutoSync();
  }
}

// Handle manual sync request
async function handleManualSync() {
  const syncManager = getSyncManager();
  return await syncManager.syncNow();
}

// Get sync status
async function getSyncStatus() {
  const syncManager = getSyncManager();
  return await syncManager.getSyncStatus();
}

// Check time limits and update blocking rules
async function checkAndUpdateTimeLimits(): Promise<void> {
  try {
    const config = await getBlockConfig();
    if (!config.enabled) return;
    
    let needsUpdate = false;
    
    // Check each domain with time limit
    for (const domain of Object.keys(config.timeLimits)) {
      const usedMinutes = await getDomainMinutesUsedToday(domain);
      const limitMinutes = config.timeLimits[domain];
      
      // If just exceeded limit, update rules
      if (usedMinutes >= limitMinutes) {
        needsUpdate = true;
        console.log(`Domain ${domain} exceeded time limit: ${usedMinutes}/${limitMinutes} minutes`);
      }
    }
    
    if (needsUpdate) {
      await updateBlockingRules();
    }
  } catch (error) {
    console.error('Error checking time limits:', error);
  }
}

// Check schedules and update blocking rules
async function checkAndUpdateSchedules(): Promise<void> {
  try {
    const config = await getBlockConfig();
    if (!config.enabled || config.schedules.length === 0) return;
    
    // Always update rules to ensure schedules are current
    // (schedules might have started or ended since last check)
    await updateBlockingRules();
    console.log('Updated blocking rules based on active schedules');
  } catch (error) {
    console.error('Error checking schedules:', error);
  }
}
