// Time tracking engine

import { getSessionState, updateSessionState, updateDomainActivity, addIdleTime } from './storage';
import { extractDomain, shouldTrackUrl } from '../types';

let trackingInterval: number | null = null;
let lastUpdateTime: number = Date.now();

/**
 * Start tracking time for the current active tab
 */
export async function startTracking(tabId: number, url: string): Promise<void> {
  const domain = extractDomain(url);
  
  if (!domain || !shouldTrackUrl(url)) {
    console.log(`Not tracking URL: ${url}`);
    return;
  }
  
  // Stop any existing tracking
  await stopTracking();
  
  // Update session state
  await updateSessionState({
    activeTabId: tabId,
    activeDomain: domain,
    sessionStartTime: Date.now(),
    isIdle: false,
  });
  
  lastUpdateTime = Date.now();
  
  // Start interval to accumulate time every second
  trackingInterval = setInterval(async () => {
    await accumulateTime();
  }, 1000) as unknown as number;
  
  console.log(`Started tracking: ${domain} (tab ${tabId})`);
}

/**
 * Stop tracking the current active tab
 */
export async function stopTracking(): Promise<void> {
  if (trackingInterval !== null) {
    clearInterval(trackingInterval);
    trackingInterval = null;
  }
  
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
  });
}

/**
 * Pause tracking (when window loses focus or user goes idle)
 */
export async function pauseTracking(reason: 'idle' | 'windowBlur'): Promise<void> {
  // Accumulate time up to this point
  await accumulateTime();
  
  // Stop the interval but don't clear session state
  if (trackingInterval !== null) {
    clearInterval(trackingInterval);
    trackingInterval = null;
  }
  
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
  const state = await getSessionState();
  
  if (reason === 'active') {
    await updateSessionState({ isIdle: false });
  } else {
    await updateSessionState({ windowFocused: true });
  }
  
  // Only restart tracking if we have an active tab and window is focused and not idle
  const updatedState = await getSessionState();
  if (updatedState.activeTabId && updatedState.windowFocused && !updatedState.isIdle) {
    lastUpdateTime = Date.now();
    
    if (trackingInterval === null) {
      trackingInterval = setInterval(async () => {
        await accumulateTime();
      }, 1000) as unknown as number;
    }
    
    console.log(`Resumed tracking (${reason}): ${updatedState.activeDomain}`);
  }
}

/**
 * Accumulate time for the currently active domain
 */
async function accumulateTime(): Promise<void> {
  const state = await getSessionState();
  
  // Don't accumulate if no active domain or if idle or window not focused
  if (!state.activeDomain || state.isIdle || !state.windowFocused) {
    return;
  }
  
  const now = Date.now();
  const elapsed = Math.floor((now - lastUpdateTime) / 1000); // Convert to seconds
  
  if (elapsed > 0) {
    await updateDomainActivity(state.activeDomain, elapsed);
    lastUpdateTime = now;
  }
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
