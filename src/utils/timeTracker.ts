// Time tracking engine with 1-minute alarms for low CPU overhead

import { getSessionState, updateSessionState, updateDomainActivity, addIdleTime, incrementChromeActiveTime } from './storage';
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
  
  // Accumulate any time from previous tab before switching
  await accumulateTime();
  
  const now = Date.now();
  
  // Update session state with new active tab
  await updateSessionState({
    activeTabId: tabId,
    activeDomain: domain,
    sessionStartTime: now,
    lastUpdateTime: now,
    isIdle: false,
  });
  
  console.log(`Started tracking: ${domain} (tab ${tabId})`);
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
  console.log(`Paused tracking (${reason}): ${state.activeDomain}`);
  
  if (reason === 'idle') {
    await updateSessionState({ isIdle: true });
  } else {
    await updateSessionState({ windowFocused: false });
  }
}

/**
 * Resume tracking (when window regains focus or user becomes active)
 */
export async function resumeTracking(reason: 'active' | 'windowFocus'): Promise<void> {
  const now = Date.now();
  
  if (reason === 'active') {
    await updateSessionState({ isIdle: false, lastUpdateTime: now });
  } else {
    await updateSessionState({ windowFocused: true, lastUpdateTime: now });
  }
  
  const updatedState = await getSessionState();
  if (updatedState.activeTabId && updatedState.windowFocused && !updatedState.isIdle) {
    console.log(`Resumed tracking (${reason}): ${updatedState.activeDomain}`);
  }
}

/**
 * Accumulate time for the currently active domain and all background domains
 * Called by 1-minute alarm and on tab events
 */
export async function accumulateTime(): Promise<void> {
  const state = await getSessionState();
  
  // Don't accumulate if idle or window not focused
  if (state.isIdle || !state.windowFocused) {
    return;
  }
  
  // No previous update time = first tracking, skip accumulation
  if (state.lastUpdateTime === null) {
    return;
  }
  
  const now = Date.now();
  const elapsed = Math.floor((now - state.lastUpdateTime) / 1000); // Convert to seconds
  
  // Skip if less than 1 second elapsed (shouldn't happen with 1-min alarm)
  if (elapsed < 1) {
    return;
  }
  
  // Cap at 2 minutes to prevent huge gaps if service worker was down
  const cappedElapsed = Math.min(elapsed, 120);
  
  console.log(`Accumulating ${cappedElapsed}s (elapsed: ${elapsed}s)`);
  
  // Track total Chrome active time (wall-clock, once per interval)
  await incrementChromeActiveTime(cappedElapsed);
  
  // Get the active domain
  const activeDomain = state.activeDomain;
  
  // Query all currently open tabs (on-demand, no in-memory tracking)
  const allTabs = await chrome.tabs.query({});
  const openDomains = new Set<string>();
  
  for (const tab of allTabs) {
    if (tab.url && shouldTrackUrl(tab.url)) {
      const domain = extractDomain(tab.url);
      if (domain) {
        openDomains.add(domain);
      }
    }
  }
  
  // Update all domains
  const updates: Promise<void>[] = [];
  
  openDomains.forEach(domain => {
    if (domain === activeDomain) {
      // Active tab: update foreground time
      updates.push(updateDomainActivity(domain, cappedElapsed, true));
    } else {
      // Background tab: update background time
      updates.push(updateDomainActivity(domain, cappedElapsed, false));
    }
  });
  
  // Execute all updates in parallel for efficiency
  await Promise.all(updates);
  
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
