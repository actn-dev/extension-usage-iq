// Data aggregation utilities

import type { DailySummary, DomainActivity } from '../types';
import { getTodayActivity, getDailySummaries } from './storage';

/**
 * Get aggregated statistics for today
 */
export async function getTodayStats(): Promise<{
  totalTime: number;
  activeTime: number;
  idleTime: number;
  topDomains: Array<{ domain: string; time: number; percentage: number }>;
  domainCount: number;
  visitCount: number;
}> {
  const today = await getTodayActivity();
  
  const domainArray: DomainActivity[] = Object.values(today.domains);
  const totalVisits = domainArray.reduce((sum, d) => sum + d.visitCount, 0);
  
  const topDomains = domainArray
    .sort((a, b) => b.totalTime - a.totalTime)
    .slice(0, 10)
    .map(d => ({
      domain: d.domain,
      time: d.totalTime,
      percentage: today.totalTime > 0 ? (d.totalTime / today.totalTime) * 100 : 0,
    }));
  
  return {
    totalTime: today.totalTime,
    activeTime: today.totalTime - today.idleTime,
    idleTime: today.idleTime,
    topDomains,
    domainCount: domainArray.length,
    visitCount: totalVisits,
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
