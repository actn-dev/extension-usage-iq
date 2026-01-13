/**
 * Heartbeat-based time tracking
 * Receives heartbeats from content scripts and validates before adding time
 */

import { getSessionState, updateDomainActivity, updateSessionState, incrementChromeFocusedTime } from './storage';
import { updateSessionStats } from './sessionManager';
import { extractDomain } from '../types';

interface HeartbeatMessage {
  type: 'heartbeat';
  url: string;
  domain: string;
  timestamp: number;
  visible: boolean;
}

interface VisibilityChangeMessage {
  type: 'visibilityChange';
  url: string;
  domain: string;
  visible: boolean;
  timestamp: number;
}

/**
 * Handle heartbeat from content script
 * Validates conditions and adds 1 second to domain if all checks pass
 */
export async function handleHeartbeat(
  message: HeartbeatMessage,
  sender: chrome.runtime.MessageSender
): Promise<void> {
  const state = await getSessionState();
  const senderTabId = sender.tab?.id;
  const { domain, timestamp } = message;

  console.log(`[Heartbeat] Received from tab ${senderTabId} (${domain})`);
  console.log(`[Heartbeat] State: activeTabId=${state.activeTabId}, activeDomain=${state.activeDomain}, windowFocused=${state.windowFocused}, isIdle=${state.isIdle}`);

  // Validation checks
  if (!senderTabId) {
    console.log('[Heartbeat] ❌ No tab ID');
    return;
  }

  // Check 1: Is window focused?
  if (!state.windowFocused) {
    console.log('[Heartbeat] ❌ Window not focused');
    return;
  }

  // Check 2: Is user idle?
  if (state.isIdle) {
    console.log('[Heartbeat] ❌ User is idle');
    return;
  }

  // Check 3: Is this tab the active one?
  if (state.activeTabId !== senderTabId) {
    console.log(`[Heartbeat] ❌ Not active tab (expected ${state.activeTabId}, got ${senderTabId})`);
    return;
  }

  // Check 4: Does domain match what we think is active?
  if (state.activeDomain !== domain) {
    console.warn(`[Heartbeat] ❌ Domain mismatch: expected ${state.activeDomain}, got ${domain}`);
    return;
  }

  // All checks passed - add 1 second to this domain's foreground time
  console.log(`[Heartbeat] ✅ Adding 1s to ${domain}`);
  
  // Add to domain activity (1 second of foreground time)
  await updateDomainActivity(domain, 1, true, sender.tab?.audible || false);

  // Update session stats (1 second of focused time)
  await updateSessionStats(1, 0, 0);
  
  // Update Chrome focused time
  await incrementChromeFocusedTime(1);
  
  // CRITICAL: Update lastUpdateTime so badge doesn't add duplicate elapsed time
  await updateSessionState({ lastUpdateTime: Date.now() });
}

/**
 * Handle visibility change from content script
 * Used for logging and potential future features
 */
export async function handleVisibilityChange(
  message: VisibilityChangeMessage,
  sender: chrome.runtime.MessageSender
): Promise<void> {
  const { domain, visible, timestamp } = message;
  const tabId = sender.tab?.id;

  console.log(`[Visibility] Tab ${tabId} (${domain}): ${visible ? 'visible' : 'hidden'}`);

  // Currently just logging
  // In the future, could use this for more accurate tracking
}

/**
 * Message handler for content script messages
 */
export async function handleContentScriptMessage(
  message: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
): Promise<boolean> {
  try {
    if (message.type === 'heartbeat') {
      await handleHeartbeat(message as HeartbeatMessage, sender);
      sendResponse({ success: true });
      return true;
    }

    if (message.type === 'visibilityChange') {
      await handleVisibilityChange(message as VisibilityChangeMessage, sender);
      sendResponse({ success: true });
      return true;
    }
  } catch (error) {
    console.error('[HeartbeatTracker] Error handling message:', error);
    sendResponse({ success: false, error: String(error) });
  }

  return false;
}
