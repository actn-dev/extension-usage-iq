// UsageIQ Background Service Worker
// Monitors browser activity and tracks time spent on websites

import { initializeStorage, getSessionState, updateSessionState, incrementVisitCount, rolloverToNewDay, getTodayActivity } from '../../utils/storage';
import { startTracking, stopTracking, pauseTracking, resumeTracking, handleIdleStateChange } from '../../utils/timeTracker';
import { extractDomain, shouldTrackUrl, getCurrentDateString } from '../../types';
import { initializeTabTracker, addTab, removeTab, updateTab } from '../../utils/tabTracker';

console.log('UsageIQ background service worker loaded');

// Initialize extension
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Extension installed/updated:', details.reason);
  await initializeStorage();
  
  // Initialize tab tracker with all open tabs
  await initializeTabTracker();
  
  // Set up idle detection (5 minutes = 300 seconds)
  chrome.idle.setDetectionInterval(300);
  
  // Set up daily rollover alarm (runs at midnight)
  chrome.alarms.create('dailyRollover', {
    when: getNextMidnight(),
    periodInMinutes: 24 * 60, // Once per day
  });
  
  console.log('UsageIQ initialized successfully');
});

// Handle extension startup (browser restart)
chrome.runtime.onStartup.addListener(async () => {
  console.log('Browser started, resuming UsageIQ monitoring');
  await initializeStorage();
  
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
});

// Tab activated (user switched to different tab)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  console.log('Tab activated:', activeInfo.tabId);
  
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url) {
      // Add/update tab in tracker
      addTab(activeInfo.tabId, tab.url);
      
      const domain = extractDomain(tab.url);
      if (domain && shouldTrackUrl(tab.url)) {
        await incrementVisitCount(domain);
      }
      await startTracking(activeInfo.tabId, tab.url);
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
  
  // Remove from tracker
  removeTab(tabId);
  
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
  await handleIdleStateChange(newState);
});

// Handle alarms (daily rollover, etc.)
chrome.alarms.onAlarm.addListener(async (alarm) => {
  console.log('Alarm triggered:', alarm.name);
  
  if (alarm.name === 'dailyRollover') {
    console.log('Performing daily rollover');
    await rolloverToNewDay();
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
  await stopTracking();
});
