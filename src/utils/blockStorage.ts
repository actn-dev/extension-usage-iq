// Storage management for website blocking configuration

import type { BlockConfig, BlockAttempt, ActiveOverride, BlockSchedule } from '../types';
import { DEFAULT_BLOCK_CONFIG } from '../types';

/**
 * Get block configuration
 */
export async function getBlockConfig(): Promise<BlockConfig> {
  const result = await chrome.storage.local.get('blockConfig');
  return result.blockConfig || DEFAULT_BLOCK_CONFIG;
}

/**
 * Update block configuration
 * NOTE: This is now READ-ONLY. All config changes must come from server.
 * Use the admin dashboard to modify blocking rules.
 */
export async function updateBlockConfig(updates: Partial<BlockConfig>): Promise<void> {
  console.warn('⚠️ updateBlockConfig() is disabled. All blocking config is managed server-side.');
  console.warn('Use the admin dashboard at http://localhost:3000/extension/blocking to manage rules.');
  // Do nothing - server is source of truth
}

/**
 * Add a domain to blocked list
 * NOTE: Disabled - use server admin dashboard
 */
export async function addBlockedDomain(domain: string): Promise<void> {
  console.warn('⚠️ addBlockedDomain() is disabled. Use admin dashboard to add domains.');
  // Server is source of truth
}

/**
 * Remove a domain from blocked list
 * NOTE: Disabled - use server admin dashboard
 */
export async function removeBlockedDomain(domain: string): Promise<void> {
  console.warn('⚠️ removeBlockedDomain() is disabled. Use admin dashboard to remove domains.');
  // Server is source of truth
}

/**
 * Set time limit for a domain (minutes per day)
 * NOTE: Disabled - use server admin dashboard
 */
export async function setDomainTimeLimit(domain: string, minutes: number): Promise<void> {
  console.warn('⚠️ setDomainTimeLimit() is disabled. Use admin dashboard to set time limits.');
  // Server is source of truth
}

/**
 * Remove time limit for a domain
 * NOTE: Disabled - use server admin dashboard
 */
export async function removeDomainTimeLimit(domain: string): Promise<void> {
  console.warn('⚠️ removeDomainTimeLimit() is disabled. Use admin dashboard to remove time limits.');
  // Server is source of truth
}

/**
 * Add a block schedule
 * NOTE: Disabled - use server admin dashboard
 */
export async function addBlockSchedule(schedule: BlockSchedule): Promise<void> {
  console.warn('⚠️ addBlockSchedule() is disabled. Use admin dashboard to add schedules.');
  // Server is source of truth
}

/**
 * Update a block schedule
 * NOTE: Disabled - use server admin dashboard
 */
export async function updateBlockSchedule(scheduleId: string, updates: Partial<BlockSchedule>): Promise<void> {
  console.warn('⚠️ updateBlockSchedule() is disabled. Use admin dashboard to update schedules.');
  // Server is source of truth
}

/**
 * Remove a block schedule
 * NOTE: Disabled - use server admin dashboard
 */
export async function removeBlockSchedule(scheduleId: string): Promise<void> {
  console.warn('⚠️ removeBlockSchedule() is disabled. Use admin dashboard to remove schedules.');
  // Server is source of truth
}

/**
 * Log a block attempt
 */
export async function logBlockAttempt(attempt: BlockAttempt): Promise<void> {
  const result = await chrome.storage.local.get('blockAttempts');
  const attempts: BlockAttempt[] = result.blockAttempts || [];
  
  attempts.push(attempt);
  
  // Keep only last 1000 attempts
  if (attempts.length > 1000) {
    attempts.splice(0, attempts.length - 1000);
  }
  
  await chrome.storage.local.set({ blockAttempts: attempts });
}

/**
 * Get recent block attempts
 */
export async function getBlockAttempts(limit: number = 100): Promise<BlockAttempt[]> {
  const result = await chrome.storage.local.get('blockAttempts');
  const attempts: BlockAttempt[] = result.blockAttempts || [];
  return attempts.slice(-limit);
}

/**
 * Clear old block attempts
 */
export async function clearOldBlockAttempts(daysToKeep: number = 7): Promise<void> {
  const result = await chrome.storage.local.get('blockAttempts');
  const attempts: BlockAttempt[] = result.blockAttempts || [];
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
  
  const filtered = attempts.filter(a => new Date(a.timestamp) > cutoffDate);
  await chrome.storage.local.set({ blockAttempts: filtered });
}

/**
 * Get active overrides
 */
export async function getActiveOverrides(): Promise<ActiveOverride[]> {
  const result = await chrome.storage.local.get('activeOverrides');
  const overrides: ActiveOverride[] = result.activeOverrides || [];
  
  // Filter out expired overrides
  const now = Date.now();
  const active = overrides.filter(o => o.expiresAt > now);
  
  // Update storage if any were expired
  if (active.length !== overrides.length) {
    await chrome.storage.local.set({ activeOverrides: active });
  }
  
  return active;
}

/**
 * Add an active override
 */
export async function addActiveOverride(override: ActiveOverride): Promise<void> {
  const overrides = await getActiveOverrides();
  
  // Remove existing override for same domain
  const filtered = overrides.filter(o => o.domain !== override.domain);
  filtered.push(override);
  
  await chrome.storage.local.set({ activeOverrides: filtered });
}

/**
 * Remove an active override
 */
export async function removeActiveOverride(domain: string): Promise<void> {
  const overrides = await getActiveOverrides();
  const filtered = overrides.filter(o => o.domain !== domain);
  await chrome.storage.local.set({ activeOverrides: filtered });
}

/**
 * Check if domain has active override
 */
export async function hasActiveOverride(domain: string): Promise<boolean> {
  const overrides = await getActiveOverrides();
  return overrides.some(o => o.domain === domain);
}

/**
 * Get minutes used today for a domain
 */
export async function getDomainMinutesUsedToday(domain: string): Promise<number> {
  const { getTodayActivity } = await import('./storage');
  const today = await getTodayActivity();
  
  const domainData = today.domains[domain];
  if (!domainData) return 0;
  
  // Convert seconds to minutes
  return Math.floor(domainData.foregroundTime / 60);
}
