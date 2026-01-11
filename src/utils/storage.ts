// Storage manager for chrome.storage.local

import type { StorageData, DomainActivity, DailySummary, SessionState } from '../types';
import { getCurrentDateString, DEFAULT_CONFIG } from '../types';

/**
 * Initialize storage with default values if not present
 */
export async function initializeStorage(): Promise<void> {
  const data = await chrome.storage.local.get(null);
  
  if (Object.keys(data).length === 0) {
    const initialData: StorageData = {
      sessionState: {
        activeTabId: null,
        activeDomain: null,
        sessionStartTime: null,
        lastUpdateTime: null,
        isIdle: false,
        windowFocused: true,
        currentDayDate: getCurrentDateString(),
      },
      todayActivity: {
        date: getCurrentDateString(),
        domains: {},
        totalTime: 0,
        chromeActiveTime: 0,
        idleTime: 0,
        sessionCount: 0,
      },
      dailySummaries: {},
      config: DEFAULT_CONFIG,
    };
    
    await chrome.storage.local.set(initialData);
    console.log('Storage initialized with default values');
  } else {
    console.log('Storage already initialized');
  }
}

/**
 * Get session state
 */
export async function getSessionState(): Promise<SessionState> {
  const result = await chrome.storage.local.get('sessionState');
  return result.sessionState;
}

/**
 * Update session state
 */
export async function updateSessionState(updates: Partial<SessionState>): Promise<void> {
  const currentState = await getSessionState();
  const newState = { ...currentState, ...updates };
  await chrome.storage.local.set({ sessionState: newState });
}

/**
 * Get today's activity data
 */
export async function getTodayActivity(): Promise<{
  date: string;
  domains: Record<string, DomainActivity>;
  totalTime: number;
  chromeActiveTime: number;
  idleTime: number;
  sessionCount: number;
}> {
  const result = await chrome.storage.local.get('todayActivity');
  return result.todayActivity;
}

/**
 * Update domain activity for today
 */
export async function updateDomainActivity(
  domain: string,
  timeToAdd: number,
  isForeground: boolean = true
): Promise<void> {
  const today = await getTodayActivity();
  const currentDate = getCurrentDateString();
  
  // Check if day changed - if so, roll over to new day
  if (today.date !== currentDate) {
    await rolloverToNewDay();
    return updateDomainActivity(domain, timeToAdd, isForeground);
  }
  
  if (!today.domains[domain]) {
    today.domains[domain] = {
      domain,
      totalTime: 0,
      foregroundTime: 0,
      backgroundTime: 0,
      visitCount: 1,
      lastVisit: new Date().toISOString(),
      date: currentDate,
    };
  }
  
  // Update the appropriate time counter
  if (isForeground) {
    today.domains[domain].foregroundTime += timeToAdd;
  } else {
    today.domains[domain].backgroundTime += timeToAdd;
  }
  
  // Update total time and last visit
  today.domains[domain].totalTime += timeToAdd;
  today.domains[domain].lastVisit = new Date().toISOString();
  
  await chrome.storage.local.set({ todayActivity: today });
}

/**
 * Increment Chrome active time (wall-clock, not per-domain)
 */
export async function incrementChromeActiveTime(seconds: number): Promise<void> {
  const today = await getTodayActivity();
  const currentDate = getCurrentDateString();
  
  if (today.date !== currentDate) {
    await rolloverToNewDay();
    return incrementChromeActiveTime(seconds);
  }
  
  today.totalTime += seconds;
  today.chromeActiveTime += seconds;
  
  await chrome.storage.local.set({ todayActivity: today });
}

/**
 * Increment visit count for a domain
 */
export async function incrementVisitCount(domain: string): Promise<void> {
  const today = await getTodayActivity();
  const currentDate = getCurrentDateString();
  
  if (today.date !== currentDate) {
    await rolloverToNewDay();
    return incrementVisitCount(domain);
  }
  
  if (!today.domains[domain]) {
    today.domains[domain] = {
      domain,
      totalTime: 0,
      foregroundTime: 0,
      backgroundTime: 0,
      visitCount: 0,
      lastVisit: new Date().toISOString(),
      date: currentDate,
    };
  }
  
  today.domains[domain].visitCount++;
  
  await chrome.storage.local.set({ todayActivity: today });
}

/**
 * Add idle time to today's total
 */
export async function addIdleTime(seconds: number): Promise<void> {
  const today = await getTodayActivity();
  today.idleTime += seconds;
  await chrome.storage.local.set({ todayActivity: today });
}

/**
 * Roll over today's data to daily summary and start fresh day
 */
export async function rolloverToNewDay(): Promise<void> {
  const today = await getTodayActivity();
  const summaries = await getDailySummaries();
  
  // Create daily summary from today's data
  const topDomains = Object.values(today.domains)
    .sort((a, b) => b.totalTime - a.totalTime)
    .slice(0, 20)
    .map(d => ({ domain: d.domain, time: d.totalTime }));
  
  const summary: DailySummary = {
    date: today.date,
    totalChromeTime: today.totalTime,
    activeTime: today.totalTime - today.idleTime,
    idleTime: today.idleTime,
    topDomains,
    sessionCount: today.sessionCount,
  };
  
  summaries[today.date] = summary;
  
  // Clean up old summaries (keep only last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoffDate = thirtyDaysAgo.toISOString().split('T')[0];
  
  Object.keys(summaries).forEach(date => {
    if (date < cutoffDate) {
      delete summaries[date];
    }
  });
  
  // Start fresh day
  const newDayData = {
    date: getCurrentDateString(),
    domains: {},
    totalTime: 0,
    chromeActiveTime: 0,
    idleTime: 0,
    sessionCount: 0,
  };
  
  await chrome.storage.local.set({
    dailySummaries: summaries,
    todayActivity: newDayData,
  });
  
  console.log(`Rolled over to new day: ${getCurrentDateString()}`);
}

/**
 * Get all daily summaries
 */
export async function getDailySummaries(): Promise<Record<string, DailySummary>> {
  const result = await chrome.storage.local.get('dailySummaries');
  return result.dailySummaries || {};
}

/**
 * Get configuration
 */
export async function getConfig(): Promise<typeof DEFAULT_CONFIG> {
  const result = await chrome.storage.local.get('config');
  return result.config || DEFAULT_CONFIG;
}

/**
 * Update configuration
 */
export async function updateConfig(updates: Partial<typeof DEFAULT_CONFIG>): Promise<void> {
  const currentConfig = await getConfig();
  const newConfig = { ...currentConfig, ...updates };
  await chrome.storage.local.set({ config: newConfig });
}

/**
 * Get storage usage info
 */
export async function getStorageInfo(): Promise<{ bytesInUse: number; quota: number }> {
  const bytesInUse = await chrome.storage.local.getBytesInUse(null);
  const quota = chrome.storage.local.QUOTA_BYTES;
  return { bytesInUse, quota };
}
