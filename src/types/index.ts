// Data models for UsageIQ Chrome Extension

/**
 * Browser session (Chrome open → close)
 */
export interface BrowserSession {
  sessionId: string; // UUID
  startTime: number; // Timestamp in ms
  endTime: number | null; // Timestamp in ms (null if ongoing)
  focusedTime: number; // Seconds Chrome window was focused
  unfocusedTime: number; // Seconds Chrome open but other app active
  idleTime: number; // Seconds user was idle
  totalTime: number; // focusedTime + unfocusedTime + idleTime
  tabCount: number; // Peak tab count
  domainCount: number; // Unique domains visited
  
  // Sync management fields
  syncedAt: number | null; // Timestamp when session was last synced (null = never synced)
  lastSyncCheckpoint: number | null; // Timestamp of last partial sync for ongoing sessions
  focusedTimeAtLastSync: number; // Values at last sync checkpoint (for delta calculation)
  unfocusedTimeAtLastSync: number;
  idleTimeAtLastSync: number;
}

/**
 * Represents activity data for a single domain
 */
export interface DomainActivity {
  domain: string;
  totalTime: number; // Total time in seconds (foreground + audible)
  foregroundTime: number; // Time when tab was active/focused (seconds)
  backgroundTime: number; // Time when tab was open but not active (seconds)
  audibleTime: number; // Time when audio/video was playing (seconds)
  visitCount: number;
  lastVisit: string; // ISO 8601 timestamp
  date: string; // YYYY-MM-DD format
  sessionId: string; // Link to session
}

/**
 * Daily summary of all browsing activity
 */
export interface DailySummary {
  date: string; // YYYY-MM-DD format
  totalChromeTime: number; // Total time Chrome was active (seconds)
  activeTime: number; // Time user was actively browsing (seconds)
  idleTime: number; // Time user was idle (seconds)
  topDomains: Array<{ domain: string; time: number }>;
  sessionCount: number;
  firstOpen?: string; // ISO 8601 timestamp
  lastClose?: string; // ISO 8601 timestamp
}

/**
 * Individual tab event for detailed tracking
 */
export interface TabEvent {
  timestamp: string; // ISO 8601 timestamp
  eventType: 'activated' | 'updated' | 'removed' | 'created';
  tabId: number;
  url?: string;
  title?: string;
  domain?: string;
}

/**
 * Current session state (in-memory)
 */
export interface SessionState {
  activeTabId: number | null;
  activeDomain: string | null;
  sessionStartTime: number | null; // Timestamp in ms
  lastUpdateTime: number | null; // Last time tracking update (ms) - persisted
  lastStateChangeTime: number | null; // When focus/idle state last changed
  isIdle: boolean;
  windowFocused: boolean;
  currentDayDate: string; // YYYY-MM-DD
  currentSessionId: string | null; // Current browser session ID
}

/**
 * Storage structure for chrome.storage.local
 */
export interface StorageData {
  // Current session state
  sessionState: SessionState;
  
  // Current browser session (Chrome open → close)
  currentSession: BrowserSession | null;
  
  // Historical sessions
  sessions: Record<string, BrowserSession>; // Key: sessionId
  
  // Per-session domain activity (NEW)
  sessionDomains: Record<string, Record<string, DomainActivity>>; // Key: sessionId -> domain -> activity
  
  // Today's activity (updated in real-time)
  todayActivity: {
    date: string;
    domains: Record<string, DomainActivity>; // DEPRECATED - kept for migration
    totalTime: number; // Wall-clock Chrome focused time (verifiable)
    chromeActiveTime: number; // Same as totalTime (for clarity)
    chromeFocusedTime: number; // Time Chrome was focused
    chromeUnfocusedTime: number; // Time Chrome open but not focused
    idleTime: number;
    sessionCount: number;
  };
  
  // Historical daily summaries (last 30 days)
  dailySummaries: Record<string, DailySummary>; // Key: YYYY-MM-DD
  
  // Configuration
  config: {
    idleThresholdMinutes: number;
    excludedDomains: string[];
    syncEnabled: boolean;
    lastSyncTime?: string;
  };
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG = {
  idleThresholdMinutes: 5,
  excludedDomains: [] as string[],
  syncEnabled: false,
};

/**
 * Helper to get current date in YYYY-MM-DD format
 */
export function getCurrentDateString(): string {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

/**
 * Helper to extract domain from URL
 */
export function extractDomain(url: string): string | null {
  try {
    const urlObj = new URL(url);
    // Remove www. prefix if present
    return urlObj.hostname.replace(/^www\./, '');
  } catch (error) {
    return null;
  }
}

/**
 * Helper to check if URL should be tracked
 */
export function shouldTrackUrl(url: string): boolean {
  if (!url) return false;
  
  // Exclude chrome:// and extension pages
  // if (url.startsWith('chrome://') || 
  //     url.startsWith('chrome-extension://') ||
  //     url.startsWith('about:')) {
  //   return false;
  // }
  
  return true;
}

/**
 * Block configuration for website limiting and blocking
 */
export interface BlockConfig {
  enabled: boolean;
  blockedDomains: string[];
  timeLimits: Record<string, number>; // domain -> minutes per day
  schedules: BlockSchedule[];
  softBlock: boolean; // Show warning instead of hard block
  overrideEnabled: boolean; // Allow user to bypass block temporarily
  overrideMaxDuration: number; // How long override lasts (minutes)
}

/**
 * Block schedule for time-based blocking
 */
export interface BlockSchedule {
  id: string;
  name: string;
  enabled: boolean;
  daysOfWeek: number[]; // 0 = Sunday, 6 = Saturday
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
  domains: string[]; // Domains to block during this schedule
}

/**
 * Block attempt tracking
 */
export interface BlockAttempt {
  domain: string;
  timestamp: string;
  overridden: boolean;
  overrideReason?: string;
  scheduleId?: string;
}

/**
 * Active override for a blocked domain
 */
export interface ActiveOverride {
  id: string;
  domain: string;
  startTime: number; // Timestamp in ms
  expiresAt: number; // Timestamp in ms
  reason?: string;
}

/**
 * Default block configuration
 */
export const DEFAULT_BLOCK_CONFIG: BlockConfig = {
  enabled: true,
  blockedDomains: [],
  timeLimits: {},
  schedules: [],
  softBlock: true,
  overrideEnabled: true,
  overrideMaxDuration: 30,
};

/**
 * Check if a domain is currently blocked
 */
export function isDomainBlocked(domain: string, config: BlockConfig): boolean {
  if (!config.enabled) return false;
  return config.blockedDomains.includes(domain);
}

/**
 * Check if domain has exceeded time limit today
 */
export function hasExceededTimeLimit(
  domain: string,
  usedMinutes: number,
  config: BlockConfig
): boolean {
  if (!config.timeLimits[domain]) return false;
  return usedMinutes >= config.timeLimits[domain];
}
