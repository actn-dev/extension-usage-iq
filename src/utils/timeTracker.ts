// Time tracking engine with 1-minute alarms for low CPU overhead

import { getSessionState, updateSessionState, updateDomainActivity, addIdleTime, incrementChromeFocusedTime, incrementChromeUnfocusedTime } from './storage';
import { updateSessionStats } from './sessionManager';
import { extractDomain, shouldTrackUrl } from '../types';

/**
 * Start tracking time for the current active tab
 */
export async function startTracking(tabId: number, url: string): Promise<void> {
  const domain = extractDomain(url);
  
  if (!domain || !shouldTrackUrl(url)) {
    console.log(`Not tracking URL: ${url}`);
    return;
  }
  
  const now = Date.now();
  
  // Check if current window is focused
  // Important: chrome.windows.onFocusChanged only fires when switching between apps,
  // NOT when switching tabs within Chrome, so we must check current state
  const tab = await chrome.tabs.get(tabId);
  const window = await chrome.windows.get(tab.windowId);
  const windowFocused = window.focused;
  
  console.log(`[TRACKING] Tab ${tabId} window focus state: ${windowFocused}`);
  
  // CRITICAL: Update session state IMMEDIATELY before accumulation
  // This ensures badge and UI can read the new state right away
  await updateSessionState({
    activeTabId: tabId,
    activeDomain: domain,
    sessionStartTime: now,
    lastUpdateTime: now,
    lastStateChangeTime: now,
    isIdle: false,
    windowFocused: windowFocused, // Set window focus based on actual state
  });
  
  console.log(`Started tracking: ${domain} (tab ${tabId}, focused=${windowFocused}) - state updated immediately`);
  
  // Accumulate any time from previous tab AFTER setting new state
  // This prevents blocking the UI with slow tab queries
  accumulateTime().catch(err => console.error('Error accumulating time:', err));
}

/**
 * Stop tracking the current active tab
 */
export async function stopTracking(): Promise<void> {
  // Accumulate any remaining time
  await accumulateTime();
  
  const state = await getSessionState();
  if (state.activeTabId !== null) {
    console.log(`Stopped tracking: ${state.activeDomain} (tab ${state.activeTabId})`);
  }
  
  await updateSessionState({
    activeTabId: null,
    activeDomain: null,
    sessionStartTime: null,
    lastUpdateTime: null,
  });
}

/**
 * Pause tracking (when window loses focus or user goes idle)
 */
export async function pauseTracking(reason: 'idle' | 'windowBlur'): Promise<void> {
  // Accumulate time up to this point
  await accumulateTime();
  
  const state = await getSessionState();
  const now = Date.now();
  
  console.log(`Paused tracking (${reason}): ${state.activeDomain}`);
  
  if (reason === 'idle') {
    await updateSessionState({ isIdle: true, lastStateChangeTime: now });
  } else {
    await updateSessionState({ windowFocused: false, lastStateChangeTime: now });
  }
}

/**
 * Resume tracking (when window regains focus or user becomes active)
 */
export async function resumeTracking(reason: 'active' | 'windowFocus'): Promise<void> {
  const now = Date.now();
  
  if (reason === 'active') {
    await updateSessionState({ isIdle: false, lastUpdateTime: now, lastStateChangeTime: now });
  } else {
    await updateSessionState({ windowFocused: true, lastUpdateTime: now, lastStateChangeTime: now });
  }
  
  const updatedState = await getSessionState();
  if (updatedState.activeTabId && updatedState.windowFocused && !updatedState.isIdle) {
    console.log(`Resumed tracking (${reason}): ${updatedState.activeDomain}`);
  }
}

/**
 * Accumulate time for the currently active domain and all background domains
 * Called by 1-minute alarm and on tab events
 * 
 * @deprecated This function accumulates active domain time via alarm
 * In hybrid approach, active domain time is tracked via content script heartbeats
 * Use accumulateUnfocusedIdleTime() instead for alarm-based tracking
 */
export async function accumulateTime(): Promise<void> {
  const state = await getSessionState();
  
  // No previous update time = first tracking, skip accumulation
  if (state.lastUpdateTime === null) {
    return;
  }
  
  const now = Date.now();
  const elapsed = Math.floor((now - state.lastUpdateTime) / 1000); // Convert to seconds
  
  // Skip if less than 1 second elapsed
  if (elapsed < 1) {
    return;
  }
  
  // Cap at 2 minutes to prevent huge gaps if service worker was down
  const cappedElapsed = Math.min(elapsed, 120);
  
  console.log(`Accumulating ${cappedElapsed}s (elapsed: ${elapsed}s, focused: ${state.windowFocused}, idle: ${state.isIdle})`);
  
  // Track Chrome time based on state
  if (state.isIdle) {
    // User is idle - track as idle time
    await addIdleTime(cappedElapsed);
    await updateSessionStats(0, 0, cappedElapsed);
  } else if (!state.windowFocused) {
    // Chrome open but not focused (user in VSCode, etc.)
    await incrementChromeUnfocusedTime(cappedElapsed);
    await updateSessionStats(0, cappedElapsed, 0);
  } else {
    // Chrome is focused - track as focused time
    await incrementChromeFocusedTime(cappedElapsed);
    await updateSessionStats(cappedElapsed, 0, 0);
    
    // NOTE: Active domain time is now tracked via content script heartbeats
    // This section is kept for backward compatibility but not actively used
    const activeDomain = state.activeDomain;
    
    // Query all currently open tabs (on-demand)
    const allTabs = await chrome.tabs.query({});
    const openDomains = new Set<string>();
    const audibleDomains = new Set<string>();
    
    for (const tab of allTabs) {
      if (tab.url && shouldTrackUrl(tab.url)) {
        const domain = extractDomain(tab.url);
        if (domain) {
          openDomains.add(domain);
          // Check if tab is playing audio/video
          if (tab.audible) {
            audibleDomains.add(domain);
          }
        }
      }
    }
    
    // Update only foreground time (remove background accumulation)
    if (activeDomain && openDomains.has(activeDomain)) {
      const isAudible = audibleDomains.has(activeDomain);
      await updateDomainActivity(activeDomain, cappedElapsed, true, isAudible);
    }
  }
  
  // Update lastUpdateTime in storage
  await updateSessionState({ lastUpdateTime: now });
}

/**
 * Accumulate only unfocused and idle time
 * Active domain time is handled by content script heartbeats
 * This function is called by the alarm to track time when Chrome is not focused or user is idle
 */
export async function accumulateUnfocusedIdleTime(): Promise<void> {
  const state = await getSessionState();
  
  // No previous update time = first tracking, skip accumulation
  if (state.lastUpdateTime === null) {
    await updateSessionState({ lastUpdateTime: Date.now() });
    return;
  }
  
  const now = Date.now();
  const elapsed = Math.floor((now - state.lastUpdateTime) / 1000); // Convert to seconds
  
  // Skip if less than 1 second elapsed
  if (elapsed < 1) {
    return;
  }
  
  // Cap at 2 minutes to prevent huge gaps if service worker was down
  const cappedElapsed = Math.min(elapsed, 120);
  
  console.log(`[UnfocusedIdle] Accumulating ${cappedElapsed}s (focused: ${state.windowFocused}, idle: ${state.isIdle})`);
  
  // Only track unfocused and idle time (active domain time comes from heartbeats)
  if (state.isIdle) {
    // User is idle - track as idle time
    await addIdleTime(cappedElapsed);
    await updateSessionStats(0, 0, cappedElapsed);
  } else if (!state.windowFocused) {
    // Chrome open but not focused (user in VSCode, etc.)
    await incrementChromeUnfocusedTime(cappedElapsed);
    await updateSessionStats(0, cappedElapsed, 0);
  }
  // If windowFocused AND not idle: active domain time is tracked by content script heartbeats
  
  // Update lastUpdateTime in storage
  await updateSessionState({ lastUpdateTime: now });
}

/**
 * Handle idle state change
 */
export async function handleIdleStateChange(newState: chrome.idle.IdleState): Promise<void> {
  const sessionState = await getSessionState();
  
  if (newState === 'idle' || newState === 'locked') {
    if (!sessionState.isIdle) {
      await pauseTracking('idle');
      console.log(`User went idle/locked`);
    }
  } else if (newState === 'active') {
    if (sessionState.isIdle) {
      await resumeTracking('active');
      console.log(`User became active`);
    }
  }
}

/**
 * Get current tracking status
 */
export async function getTrackingStatus(): Promise<{
  isTracking: boolean;
  currentDomain: string | null;
  timeTracked: number;
}> {
  const state = await getSessionState();
  
  return {
    isTracking: state.activeTabId !== null && !state.isIdle && state.windowFocused,
    currentDomain: state.activeDomain,
    timeTracked: state.sessionStartTime ? Math.floor((Date.now() - state.sessionStartTime) / 1000) : 0,
  };
}
