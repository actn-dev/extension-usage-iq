/**
 * Badge Manager - Updates extension icon badge with active domain time
 */

import { getSessionState, getSessionDomains } from './storage';
import { getCurrentSession } from './sessionManager';

/**
 * Format seconds into compact badge text (max 4 chars)
 * Examples: "45s", "1:23", "45:32", "99m+"
 * Always shows seconds for better debugging
 */
function formatBadgeTime(seconds: number): string {
  if (seconds < 60) {
    // Less than 1 minute: show seconds
    return `${seconds}s`;
  } else if (seconds < 5940) {
    // 1-99 minutes: show M:SS (always shows seconds for debugging)
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  } else {
    // 99+ minutes: show 99m+
    return '99m+';
  }
}

/**
 * Update badge with current active domain's session time
 */
export async function updateBadge(): Promise<void> {
  try {
    const state = await getSessionState();
    
    // If no active domain or not tracking, clear badge
    if (!state.activeDomain || !state.currentSessionId || state.isIdle || !state.windowFocused) {
      await chrome.action.setBadgeText({ text: '' });
      return;
    }
    
    // Get current session domains
    const currentSession = await getCurrentSession();
    if (!currentSession) {
      await chrome.action.setBadgeText({ text: '' });
      return;
    }
    
    const sessionDomains = await getSessionDomains(currentSession.sessionId);
    const domainActivity = sessionDomains[state.activeDomain];
    
    // Get accumulated foreground time for this domain in this session
    let foregroundTime = domainActivity?.foregroundTime || 0;
    
    // Add elapsed time since last update for real-time ticking
    // Note: When heartbeats are active, lastUpdateTime is updated every second by heartbeats
    // So elapsed time will be 0-1 seconds (fractional ticking between heartbeats)
    if (state.lastUpdateTime !== null) {
      const now = Date.now();
      const elapsedSeconds = Math.floor((now - state.lastUpdateTime) / 1000);
      // Only add if elapsed time is reasonable (< 2 seconds to avoid stale data)
      if (elapsedSeconds < 2) {
        foregroundTime += elapsedSeconds;
      }
    }
    
    // Format and display
    const badgeText = formatBadgeTime(foregroundTime);
    await chrome.action.setBadgeText({ text: badgeText });
    await chrome.action.setBadgeBackgroundColor({ color: '#4F46E5' }); // Indigo color
    
    // Log state details for debugging
    const elapsedSinceUpdate = state.lastUpdateTime ? Math.floor((Date.now() - state.lastUpdateTime) / 1000) : null;
    console.log(`[TRACKING-BADGE] Updated: ${state.activeDomain} = ${badgeText} (${foregroundTime}s stored + ${elapsedSinceUpdate}s elapsed, lastUpdate: ${state.lastUpdateTime})`);
  } catch (error) {
    console.error('Error updating badge:', error);
  }
}

/**
 * Clear the badge
 */
export async function clearBadge(): Promise<void> {
  await chrome.action.setBadgeText({ text: '' });
}

let badgeInterval: NodeJS.Timeout | null = null;

/**
 * Start badge timer (updates every second)
 */
export function startBadgeTimer(): void {
  // Clear existing interval if any
  if (badgeInterval) {
    clearInterval(badgeInterval);
  }
  
  // Update immediately
  updateBadge();
  
  // Update every second
  badgeInterval = setInterval(() => {
    updateBadge();
  }, 1000);
  
  console.log('Badge timer started');
}

/**
 * Stop badge timer
 */
export function stopBadgeTimer(): void {
  if (badgeInterval) {
    clearInterval(badgeInterval);
    badgeInterval = null;
  }
  clearBadge();
  console.log('Badge timer stopped');
}
