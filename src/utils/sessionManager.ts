/**
 * Session Manager - Tracks browser sessions (Chrome open → close)
 */

import type { BrowserSession } from '../types';
import { getSessionState, updateSessionState, getTodayActivity } from './storage';
import { finalizeAllOpenTabs } from './tabTracker';

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Start a new browser session
 */
export async function startBrowserSession(): Promise<string> {
  const sessionId = generateSessionId();
  const now = Date.now();
  
  const session: BrowserSession = {
    sessionId,
    startTime: now,
    endTime: null,
    focusedTime: 0,
    unfocusedTime: 0,
    idleTime: 0,
    totalTime: 0,
    tabCount: 0,
    domainCount: 0,
    // Sync fields
    syncedAt: null,
    lastSyncCheckpoint: null,
    focusedTimeAtLastSync: 0,
    unfocusedTimeAtLastSync: 0,
    idleTimeAtLastSync: 0,
  };
  
  // Store current session
  await chrome.storage.local.set({ currentSession: session });
  
  // Update session state
  await updateSessionState({
    currentSessionId: sessionId,
    sessionStartTime: now,
    lastUpdateTime: now,
    lastStateChangeTime: now,
  });
  
  // Increment session count
  const today = await getTodayActivity();
  today.sessionCount++;
  await chrome.storage.local.set({ todayActivity: today });
  
  console.log(`Browser session started: ${sessionId}`);
  
  return sessionId;
}

/**
 * End the current browser session
 */
export async function endBrowserSession(): Promise<void> {
  const result = await chrome.storage.local.get(['currentSession', 'sessions']);
  const currentSession: BrowserSession | null = result.currentSession;
  
  if (!currentSession) {
    console.log('No active session to end');
    return;
  }
  
  // IMPORTANT: Finalize all currently open tabs before ending session
  // This captures open time for tabs that won't get onRemoved events
  await finalizeAllOpenTabs();
  
  // Update session end time and calculate total from components
  const now = Date.now();
  currentSession.endTime = now;
  currentSession.totalTime = currentSession.focusedTime + currentSession.unfocusedTime + currentSession.idleTime;
  
  // Get final stats
  const today = await getTodayActivity();
  currentSession.tabCount = Object.keys(today.domains).length;
  currentSession.domainCount = Object.keys(today.domains).length;
  
  // CRITICAL: Save with endTime set FIRST (in case service worker is killed)
  // This ensures we can detect ended sessions on resume
  await chrome.storage.local.set({
    currentSession: currentSession,  // Save with endTime set
  });
  
  // Store in sessions history
  const sessions: Record<string, BrowserSession> = result.sessions || {};
  sessions[currentSession.sessionId] = currentSession;
  
  // Clean up old sessions (keep last 30 days)
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  Object.keys(sessions).forEach(sessionId => {
    if (sessions[sessionId]!.startTime < thirtyDaysAgo) {
      delete sessions[sessionId];
    }
  });
  
  // Save to history and try to clear currentSession
  await chrome.storage.local.set({
    sessions,
    currentSession: null,  // Try to clear, but endTime is already set if this fails
  });
  
  await updateSessionState({
    currentSessionId: null,
  });
  
  console.log(`Browser session ended: ${currentSession.sessionId}, duration: ${currentSession.totalTime}s`);
}

/**
 * Update current session stats
 */
export async function updateSessionStats(
  focusedTime?: number,
  unfocusedTime?: number,
  idleTime?: number
): Promise<void> {
  const result = await chrome.storage.local.get('currentSession');
  const currentSession: BrowserSession | null = result.currentSession;
  
  if (!currentSession) {
    console.log('No active session to update');
    return;
  }
  
  if (focusedTime !== undefined) {
    currentSession.focusedTime += focusedTime;
  }
  
  if (unfocusedTime !== undefined) {
    currentSession.unfocusedTime += unfocusedTime;
  }
  
  if (idleTime !== undefined) {
    currentSession.idleTime += idleTime;
  }
  
  await chrome.storage.local.set({ currentSession });
}

/**
 * Get current session
 */
export async function getCurrentSession(): Promise<BrowserSession | null> {
  const result = await chrome.storage.local.get('currentSession');
  return result.currentSession || null;
}

/**
 * Get all sessions
 */
export async function getAllSessions(): Promise<Record<string, BrowserSession>> {
  const result = await chrome.storage.local.get('sessions');
  return result.sessions || {};
}

/**
 * Resume session tracking after service worker restart
 */
export async function resumeSessionIfExists(): Promise<void> {
  const currentSession = await getCurrentSession();
  const sessionState = await getSessionState();
  
  // Check if there's a current session
  if (currentSession) {
    // If session has endTime, it was already ended (even if still in storage)
    if (currentSession.endTime) {
      console.log('Found ended session in storage, moving to history and starting fresh');
      // Move to history
      const result = await chrome.storage.local.get('sessions');
      const sessions: Record<string, BrowserSession> = result.sessions || {};
      sessions[currentSession.sessionId] = currentSession;
      await chrome.storage.local.set({ 
        sessions,
        currentSession: null 
      });
      // Start new session
      await startBrowserSession();
      return;
    }
    
    // Session is still active (no endTime)
    const now = Date.now();
    const timeSinceLastUpdate = sessionState.lastUpdateTime 
      ? now - sessionState.lastUpdateTime 
      : Infinity;
    
    // If more than 5 minutes passed, consider it a new browser launch
    const BROWSER_CLOSE_THRESHOLD = 5 * 60 * 1000; // 5 minutes
    
    if (timeSinceLastUpdate > BROWSER_CLOSE_THRESHOLD) {
      // Chrome was closed, end old session and start new one
      console.log('Time gap > 5min, ending old session and starting new');
      await endBrowserSession();
      await startBrowserSession();
    } else {
      // Service worker just restarted, resume session
      await updateSessionState({
        currentSessionId: currentSession.sessionId,
      });
      console.log(`Resumed session: ${currentSession.sessionId}`);
    }
  } else {
    // No active session, start new one
    await startBrowserSession();
  }
}
