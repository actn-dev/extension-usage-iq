// Data aggregation utilities

import type { DailySummary, DomainActivity } from '../types';
import { getTodayActivity, getDailySummaries, getSessionState, getAllSessionDomains, getSessionDomains } from './storage';
import { getCurrentSession } from './sessionManager';
import { extractDomain, shouldTrackUrl, getCurrentDateString } from '../types';
import { getAllTabs } from './tabTracker';

/**
 * Get all sessions from today with domain breakdown
 */
export async function getTodaySessions(): Promise<Array<{
  sessionId: string;
  startTime: number;
  endTime: number | null;
  duration: number;
  focusedTime: number;
  unfocusedTime: number;
  idleTime: number;
  isActive: boolean;
  domains: Array<{
    domain: string;
    foregroundTime: number;
    backgroundTime: number;
    audibleTime: number;
    totalOpenTime: number;
    visitCount: number;
  }>;
}>> {
  const result = await chrome.storage.local.get(['sessions', 'currentSession']);
  const sessions = result.sessions || {};
  const currentSession = result.currentSession;
  const today = getCurrentDateString();
  const allSessionDomains = await getAllSessionDomains();
  
  const todaySessions: any[] = [];
  
  // Add all completed sessions from today
  for (const [sessionId, session] of Object.entries(sessions) as [string, any][]) {
    const sessionDate = new Date(session.startTime).toISOString().split('T')[0];
    if (sessionDate === today) {
      const sessionDomains = allSessionDomains[sessionId] || {};
      const domains = Object.values(sessionDomains).map(d => ({
        domain: d.domain,
        foregroundTime: d.foregroundTime,
        backgroundTime: d.backgroundTime,
        audibleTime: d.audibleTime || 0,
        totalOpenTime: d.totalOpenTime || 0,
        visitCount: d.visitCount,
      })).sort((a, b) => b.foregroundTime - a.foregroundTime);
      
      todaySessions.push({
        sessionId,
        startTime: session.startTime,
        endTime: session.endTime,
        duration: session.totalTime,
        focusedTime: session.focusedTime,
        unfocusedTime: session.unfocusedTime,
        idleTime: session.idleTime,
        isActive: false,
        domains,
      });
    }
  }
  
  // Add current active session if it's from today
  if (currentSession) {
    const sessionDate = new Date(currentSession.startTime).toISOString().split('T')[0];
    if (sessionDate === today) {
      const sessionDomains = allSessionDomains[currentSession.sessionId] || {};
      const domains = Object.values(sessionDomains).map(d => ({
        domain: d.domain,
        foregroundTime: d.foregroundTime,
        backgroundTime: d.backgroundTime,
        audibleTime: d.audibleTime || 0,
        totalOpenTime: d.totalOpenTime || 0,
        visitCount: d.visitCount,
      })).sort((a, b) => b.foregroundTime - a.foregroundTime);
      
      todaySessions.push({
        sessionId: currentSession.sessionId,
        startTime: currentSession.startTime,
        endTime: null,
        duration: currentSession.focusedTime + currentSession.unfocusedTime + currentSession.idleTime,
        focusedTime: currentSession.focusedTime,
        unfocusedTime: currentSession.unfocusedTime,
        idleTime: currentSession.idleTime,
        isActive: true,
        domains,
      });
    }
  }
  
  return todaySessions.sort((a, b) => a.startTime - b.startTime);
}

/**
 * Get currently open tabs from Chrome with their tracking time
 */
export async function getCurrentOpenTabs(): Promise<Array<{
  tabId: number;
  domain: string;
  title: string;
  url: string;
  active: boolean;
  audible: boolean;
  foregroundTime: number;
  totalTime: number;
  totalOpenTime: number;
  currentOpenTime: number; // How long this specific tab has been open
  visitCount: number;
}>> {
  const tabs = await chrome.tabs.query({});
  const state = await getSessionState();
  const currentSession = await getCurrentSession();
  
  // Get current session domains
  const sessionDomains = currentSession ? await getSessionDomains(currentSession.sessionId) : {};
  
  // Get tab tracker info for open times
  const trackedTabs = getAllTabs();
  const trackedTabMap = new Map(trackedTabs.map(t => [t.tabId, t]));
  
  const now = Date.now();
  
  return tabs
    .filter(tab => tab.url && shouldTrackUrl(tab.url))
    .map(tab => {
      const domain = extractDomain(tab.url!) || 'unknown';
      const domainData = sessionDomains[domain];
      const trackedTab = trackedTabMap.get(tab.id || 0);
      
      // Calculate how long this specific tab has been open
      const currentOpenTime = trackedTab ? Math.floor((now - trackedTab.openedAt) / 1000) : 0;
      
      return {
        tabId: tab.id || 0,
        domain,
        title: tab.title || '',
        url: tab.url!,
        active: tab.id === state.activeTabId,
        audible: tab.audible || false,
        foregroundTime: domainData?.foregroundTime || 0,
        totalTime: domainData?.totalTime || 0,
        totalOpenTime: domainData?.totalOpenTime || 0,
        currentOpenTime,
        visitCount: domainData?.visitCount || 0,
      };
    })
    .sort((a, b) => {
      // Active tab first, then audible, then alphabetically
      if (a.active) return -1;
      if (b.active) return 1;
      if (a.audible && !b.audible) return -1;
      if (b.audible && !a.audible) return 1;
      return a.domain.localeCompare(b.domain);
    });
}

/**
 * Get aggregated statistics for today
 */
export async function getTodayStats(): Promise<{
  totalTime: number;
  foregroundTime: number;
  backgroundTime: number;
  activeTime: number;
  idleTime: number;
  chromeFocusedTime: number;
  chromeUnfocusedTime: number;
  audibleTime: number;
  topDomains: Array<{ 
    domain: string; 
    time: number; 
    foregroundTime: number;
    backgroundTime: number;
    audibleTime: number;
    totalOpenTime: number;
    percentage: number;
    foregroundPercentage: number;
  }>;
  domainCount: number;
  visitCount: number;
  allSessions: Array<{
    sessionId: string;
    startTime: number;
    endTime: number | null;
    duration: number;
    focusedTime: number;
    unfocusedTime: number;
    idleTime: number;
    isActive: boolean;
  }>;
  currentSession: {
    sessionId: string;
    duration: number;
    focusedTime: number;
    unfocusedTime: number;
    idleTime: number;
    domains: Array<{
      domain: string;
      foregroundTime: number;
      audibleTime: number;
      totalOpenTime: number;
      visitCount: number;
    }>;
    openTabs: Array<{
      tabId: number;
      domain: string;
      title: string;
      active: boolean;
      audible: boolean;
      foregroundTime: number;
      totalTime: number;
      totalOpenTime: number;
      currentOpenTime: number;
      visitCount: number;
    }>;
  } | null;
  verificationCheck: {
    sessionTimeMatch: boolean;
    foregroundSumVsFocused: number;
    message: string;
  };
}> {
  const today = await getTodayActivity();
  const currentSession = await getCurrentSession();
  const openTabs = await getCurrentOpenTabs();
  
  // Aggregate domains from all sessions today
  const allSessionDomains = await getAllSessionDomains();
  const aggregatedDomains: Record<string, DomainActivity> = {};
  
  for (const [sessionId, domains] of Object.entries(allSessionDomains)) {
    for (const [domain, activity] of Object.entries(domains)) {
      // Check if this activity is from today
      if (activity.date === today.date) {
        if (!aggregatedDomains[domain]) {
          aggregatedDomains[domain] = { ...activity };
        } else {
          // Aggregate times from multiple sessions
          aggregatedDomains[domain]!.totalTime += activity.totalTime;
          aggregatedDomains[domain]!.foregroundTime += activity.foregroundTime;
          aggregatedDomains[domain]!.backgroundTime += activity.backgroundTime;
          aggregatedDomains[domain]!.audibleTime += (activity.audibleTime || 0);
          aggregatedDomains[domain]!.visitCount += activity.visitCount;
          // Keep the most recent lastVisit
          if (new Date(activity.lastVisit) > new Date(aggregatedDomains[domain]!.lastVisit)) {
            aggregatedDomains[domain]!.lastVisit = activity.lastVisit;
          }
        }
      }
    }
  }
  
  const domainArray: DomainActivity[] = Object.values(aggregatedDomains);
  const totalVisits = domainArray.reduce((sum, d) => sum + d.visitCount, 0);
  
  // Calculate total foreground, background, and audible time
  const totalForeground = domainArray.reduce((sum, d) => sum + d.foregroundTime, 0);
  const totalBackground = domainArray.reduce((sum, d) => sum + d.backgroundTime, 0);
  const totalAudible = domainArray.reduce((sum, d) => sum + (d.audibleTime || 0), 0);
  
  const topDomains = domainArray
    .sort((a, b) => b.totalTime - a.totalTime)
    .slice(0, 10)
    .map(d => ({
      domain: d.domain,
      time: d.totalTime,
      foregroundTime: d.foregroundTime,
      backgroundTime: d.backgroundTime,
      audibleTime: d.audibleTime || 0,
      totalOpenTime: d.totalOpenTime || 0,
      percentage: today.totalTime > 0 ? (d.totalTime / today.totalTime) * 100 : 0,
      foregroundPercentage: d.totalTime > 0 ? (d.foregroundTime / d.totalTime) * 100 : 0,
    }));
  
  // Verification check
  const foregroundSumVsFocused = totalForeground - today.chromeFocusedTime;
  const sessionTimeMatch = currentSession ? 
    Math.abs(currentSession.focusedTime - today.chromeFocusedTime) < 120 : // 2 min tolerance
    true;
  
  let verificationMessage = '✅ Tracking is accurate';
  if (Math.abs(foregroundSumVsFocused) > 60) {
    verificationMessage = `⚠️ Foreground time mismatch: ${Math.abs(foregroundSumVsFocused)}s difference`;
  }
  if (!sessionTimeMatch) {
    verificationMessage = '⚠️ Session time calculation mismatch';
  }
  
  // Get all sessions from today
  const allSessions = await getTodaySessions();
  
  return {
    totalTime: today.totalTime,
    foregroundTime: totalForeground,
    backgroundTime: totalBackground,
    activeTime: today.totalTime - today.idleTime,
    idleTime: today.idleTime,
    chromeFocusedTime: today.chromeFocusedTime,
    chromeUnfocusedTime: today.chromeUnfocusedTime,
    audibleTime: totalAudible,
    topDomains,
    domainCount: domainArray.length,
    visitCount: totalVisits,
    allSessions,
    currentSession: currentSession ? await (async () => {
      // Get domains for current session only
      const sessionDomains = await getSessionDomains(currentSession.sessionId);
      const sessionDomainArray = Object.values(sessionDomains);
      
      return {
        sessionId: currentSession.sessionId,
        duration: currentSession.focusedTime + currentSession.unfocusedTime + currentSession.idleTime,
        focusedTime: currentSession.focusedTime,
        unfocusedTime: currentSession.unfocusedTime,
        idleTime: currentSession.idleTime,
        domains: sessionDomainArray
          .map(d => ({
            domain: d.domain,
            foregroundTime: d.foregroundTime,
            audibleTime: d.audibleTime || 0,
            totalOpenTime: d.totalOpenTime || 0,
            visitCount: d.visitCount,
          }))
          .sort((a, b) => b.foregroundTime - a.foregroundTime),
        openTabs: openTabs.map(t => ({
          tabId: t.tabId,
          domain: t.domain,
          title: t.title,
          active: t.active,
          audible: t.audible,
          foregroundTime: t.foregroundTime,
          totalTime: t.totalTime,
          totalOpenTime: t.totalOpenTime,
          currentOpenTime: t.currentOpenTime,
          visitCount: t.visitCount,
        })),
      };
    })() : null,
    verificationCheck: {
      sessionTimeMatch,
      foregroundSumVsFocused,
      message: verificationMessage,
    },
  };
}

/**
 * Get statistics for a specific date
 */
export async function getDateStats(date: string): Promise<DailySummary | null> {
  const summaries = await getDailySummaries();
  return summaries[date] || null;
}

/**
 * Get weekly statistics (last 7 days)
 */
export async function getWeeklyStats(): Promise<{
  totalTime: number;
  averageDailyTime: number;
  topDomains: Array<{ domain: string; time: number }>;
  dailyBreakdown: Array<{ date: string; time: number }>;
}> {
  const summaries = await getDailySummaries();
  const today = await getTodayActivity();
  
  // Get last 7 days including today
  const dates: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    dates.push(date.toISOString().split('T')[0]);
  }
  
  let totalTime = 0;
  const dailyBreakdown: Array<{ date: string; time: number }> = [];
  const domainTotals: Record<string, number> = {};
  
  dates.forEach(date => {
    if (date === today.date) {
      // Include today's data
      totalTime += today.totalTime;
      dailyBreakdown.push({ date, time: today.totalTime });
      
      Object.values(today.domains).forEach(d => {
        domainTotals[d.domain] = (domainTotals[d.domain] || 0) + d.totalTime;
      });
    } else if (summaries[date]) {
      // Include historical data
      const summary = summaries[date];
      totalTime += summary.totalChromeTime;
      dailyBreakdown.push({ date, time: summary.totalChromeTime });
      
      summary.topDomains.forEach(d => {
        domainTotals[d.domain] = (domainTotals[d.domain] || 0) + d.time;
      });
    } else {
      dailyBreakdown.push({ date, time: 0 });
    }
  });
  
  const topDomains = Object.entries(domainTotals)
    .map(([domain, time]) => ({ domain, time }))
    .sort((a, b) => b.time - a.time)
    .slice(0, 10);
  
  return {
    totalTime,
    averageDailyTime: totalTime / 7,
    topDomains,
    dailyBreakdown,
  };
}

/**
 * Format time in seconds to human readable string
 */
export function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

/**
 * Format time to detailed string (e.g., "2 hours, 34 minutes, 12 seconds")
 */
export function formatTimeDetailed(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  const parts: string[] = [];
  
  if (hours > 0) {
    parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
  }
  if (minutes > 0) {
    parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
  }
  if (secs > 0 || parts.length === 0) {
    parts.push(`${secs} second${secs !== 1 ? 's' : ''}`);
  }
  
  return parts.join(', ');
}

/**
 * Calculate productivity score (0-100)
 * Based on time distribution and focus patterns
 */
export function calculateProductivityScore(domains: DomainActivity[]): number {
  if (domains.length === 0) return 0;
  
  const totalTime = domains.reduce((sum, d) => sum + d.totalTime, 0);
  if (totalTime === 0) return 0;
  
  // Simple heuristic: higher score for more focused work (fewer domain switches)
  const focusScore = Math.max(0, 100 - (domains.length * 2));
  
  // Higher score for longer sessions per domain
  const avgSessionTime = totalTime / domains.reduce((sum, d) => sum + d.visitCount, 1);
  const sessionScore = Math.min(100, (avgSessionTime / 600) * 50); // 10 min = 50 points
  
  return Math.round((focusScore + sessionScore) / 2);
}
