// In-memory tab tracker for efficient foreground/background time tracking

import { extractDomain, shouldTrackUrl } from '../types';
import { updateDomainOpenTime } from './storage';

interface TabInfo {
  tabId: number;
  domain: string;
  url: string;
  openedAt: number; // Timestamp when tab was created/opened (ms)
}

// In-memory map of all currently open tabs
const openTabs = new Map<number, TabInfo>();

/**
 * Add or update a tab in the tracker
 */
export function addTab(tabId: number, url: string, openedAt?: number): void {
  const domain = extractDomain(url);
  
  if (domain && shouldTrackUrl(url)) {
    const existingTab = openTabs.get(tabId);
    
    openTabs.set(tabId, { 
      tabId, 
      domain, 
      url,
      // Preserve existing openedAt if tab already tracked, otherwise use provided or current time
      openedAt: existingTab?.openedAt || openedAt || Date.now()
    });
    console.log(`Tab tracked: ${tabId} -> ${domain} (Total: ${openTabs.size})`);
  }
}

/**
 * Remove a tab from the tracker
 */
export async function removeTab(tabId: number): Promise<void> {
  const tab = openTabs.get(tabId);
  
  if (tab) {
    // Calculate how long the tab was open
    const openDuration = Math.floor((Date.now() - tab.openedAt) / 1000); // seconds
    
    // Store the open time for this domain
    await updateDomainOpenTime(tab.domain, openDuration);
    
    console.log(`Tab closed: ${tabId} (${tab.domain}), was open for ${openDuration}s`);
  }
  
  openTabs.delete(tabId);
  console.log(`Tab removed: ${tabId} (Remaining: ${openTabs.size})`);
}

/**
 * Update a tab's URL/domain
 */
export function updateTab(tabId: number, url: string): void {
  const existingTab = openTabs.get(tabId);
  const domain = extractDomain(url);
  
  if (domain && shouldTrackUrl(url)) {
    openTabs.set(tabId, { 
      tabId, 
      domain, 
      url,
      // Preserve openedAt if same domain, otherwise reset
      openedAt: existingTab?.domain === domain ? existingTab.openedAt : Date.now()
    });
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
 * Finalize all open tabs (calculate and store their open time)
 * Called when Chrome closes or session ends
 */
export async function finalizeAllOpenTabs(): Promise<void> {
  const now = Date.now();
  const tabsToFinalize = Array.from(openTabs.values());
  
  console.log(`Finalizing ${tabsToFinalize.length} open tabs before session end`);
  
  // Process all tabs
  for (const tab of tabsToFinalize) {
    const openDuration = Math.floor((now - tab.openedAt) / 1000);
    await updateDomainOpenTime(tab.domain, openDuration);
    console.log(`  Finalized ${tab.domain}: ${openDuration}s`);
  }
  
  // Clear the tracker
  openTabs.clear();
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
