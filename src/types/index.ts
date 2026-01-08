// Data models for UsageIQ Chrome Extension

/**
 * Represents activity data for a single domain
 */
export interface DomainActivity {
  domain: string;
  totalTime: number; // Total time in seconds
  visitCount: number;
  lastVisit: string; // ISO 8601 timestamp
  date: string; // YYYY-MM-DD format
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
  isIdle: boolean;
  windowFocused: boolean;
  currentDayDate: string; // YYYY-MM-DD
}

/**
 * Storage structure for chrome.storage.local
 */
export interface StorageData {
  // Current session state
  sessionState: SessionState;
  
  // Today's activity (updated in real-time)
  todayActivity: {
    date: string;
    domains: Record<string, DomainActivity>;
    totalTime: number;
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
  if (url.startsWith('chrome://') || 
      url.startsWith('chrome-extension://') ||
      url.startsWith('about:')) {
    return false;
  }
  
  return true;
}
