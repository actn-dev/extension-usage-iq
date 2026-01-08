// In-memory tab tracker for efficient foreground/background time tracking

import { extractDomain, shouldTrackUrl } from '../types';

interface TabInfo {
  tabId: number;
  domain: string;
  url: string;
}

// In-memory map of all currently open tabs
const openTabs = new Map<number, TabInfo>();

/**
 * Add or update a tab in the tracker
 */
export function addTab(tabId: number, url: string): void {
  const domain = extractDomain(url);
  
  if (domain && shouldTrackUrl(url)) {
    openTabs.set(tabId, { tabId, domain, url });
    console.log(`Tab tracked: ${tabId} -> ${domain} (Total: ${openTabs.size})`);
  }
}

/**
 * Remove a tab from the tracker
 */
export function removeTab(tabId: number): void {
  const removed = openTabs.delete(tabId);
  if (removed) {
    console.log(`Tab removed: ${tabId} (Remaining: ${openTabs.size})`);
  }
}

/**
 * Update a tab's URL/domain
 */
export function updateTab(tabId: number, url: string): void {
  const domain = extractDomain(url);
  
  if (domain && shouldTrackUrl(url)) {
    openTabs.set(tabId, { tabId, domain, url });
  } else {
    // URL not trackable, remove from tracking
    openTabs.delete(tabId);
  }
}

/**
 * Get domain for a specific tab
 */
export function getTabDomain(tabId: number): string | null {
  const tab = openTabs.get(tabId);
  return tab ? tab.domain : null;
}

/**
 * Get all currently tracked tabs
 */
export function getAllTabs(): TabInfo[] {
  return Array.from(openTabs.values());
}

/**
 * Get all unique domains currently open
 */
export function getAllOpenDomains(): string[] {
  const domains = new Set<string>();
  openTabs.forEach(tab => domains.add(tab.domain));
  return Array.from(domains);
}

/**
 * Get all tabs for a specific domain
 */
export function getTabsForDomain(domain: string): TabInfo[] {
  return Array.from(openTabs.values()).filter(tab => tab.domain === domain);
}

/**
 * Clear all tracked tabs
 */
export function clearAllTabs(): void {
  openTabs.clear();
  console.log('All tabs cleared from tracker');
}

/**
 * Get count of tracked tabs
 */
export function getTrackedTabCount(): number {
  return openTabs.size;
}

/**
 * Initialize tab tracker with all currently open tabs
 */
export async function initializeTabTracker(): Promise<void> {
  try {
    // Clear existing tabs
    clearAllTabs();
    
    // Query all tabs across all windows
    const tabs = await chrome.tabs.query({});
    
    // Add each tab to the tracker
    tabs.forEach(tab => {
      if (tab.id && tab.url) {
        addTab(tab.id, tab.url);
      }
    });
    
    console.log(`Tab tracker initialized with ${openTabs.size} tabs`);
  } catch (error) {
    console.error('Error initializing tab tracker:', error);
  }
}
