// Website blocking manager using declarativeNetRequest API

import { getBlockConfig, getActiveOverrides, logBlockAttempt, getDomainMinutesUsedToday } from './blockStorage';
import type { BlockConfig } from '../types';
import { isDomainBlocked, hasExceededTimeLimit } from '../types';

// Extension URL for block page
const BLOCK_PAGE_URL = chrome.runtime.getURL('src/pages/blocked/index.html');

// Rule ID constants
const RULE_ID_START = 1000; // Start IDs from 1000 to avoid conflicts
let currentRuleId = RULE_ID_START;

/**
 * Initialize blocking system
 */
export async function initializeBlocking(): Promise<void> {
  console.log('Initializing blocking system...');
  await updateBlockingRules();
}

/**
 * Update all blocking rules based on current configuration
 */
export async function updateBlockingRules(): Promise<void> {
  try {
    const config = await getBlockConfig();
    
    if (!config.enabled) {
      // Remove all blocking rules
      await clearAllBlockingRules();
      console.log('Blocking disabled - all rules removed');
      return;
    }
    
    // Get domains that should be blocked right now
    const domainsToBlock = await getDomainsToBlock();
    
    // Create rules for each blocked domain
    const rules = domainsToBlock.map((domain, index) => createBlockRule(domain, RULE_ID_START + index));
    
    // Remove old rules and add new ones
    await clearAllBlockingRules();
    
    if (rules.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        addRules: rules,
      });
      console.log(`Added ${rules.length} blocking rules`);
    }
  } catch (error) {
    console.error('Error updating blocking rules:', error);
  }
}

/**
 * Get list of domains that should be blocked right now
 */
async function getDomainsToBlock(): Promise<string[]> {
  const config = await getBlockConfig();
  const overrides = await getActiveOverrides();
  const overrideDomains = new Set(overrides.map(o => o.domain));
  
  const domainsToBlock: string[] = [];
  
  // Check blocked domains
  for (const domain of config.blockedDomains) {
    // Skip if has active override
    if (overrideDomains.has(domain)) continue;
    
    domainsToBlock.push(domain);
  }
  
  // Check time limits
  for (const [domain, limitMinutes] of Object.entries(config.timeLimits)) {
    // Skip if already in blocked list or has override
    if (domainsToBlock.includes(domain) || overrideDomains.has(domain)) continue;
    
    const usedMinutes = await getDomainMinutesUsedToday(domain);
    if (usedMinutes >= limitMinutes) {
      domainsToBlock.push(domain);
    }
  }
  
  // Check schedule-based blocks
  const scheduleBlockedDomains = getScheduleBlockedDomains(config);
  for (const domain of scheduleBlockedDomains) {
    // Skip if already in blocked list or has override
    if (domainsToBlock.includes(domain) || overrideDomains.has(domain)) continue;
    
    domainsToBlock.push(domain);
  }
  
  return domainsToBlock;
}

/**
 * Get domains that should be blocked based on active schedules
 */
function getScheduleBlockedDomains(config: BlockConfig): string[] {
  const now = new Date();
  const currentDay = now.getDay(); // 0 = Sunday, 6 = Saturday
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  
  const blockedDomains = new Set<string>();
  
  for (const schedule of config.schedules) {
    // Skip if schedule is disabled
    if (!schedule.enabled) continue;
    
    // Check if current day is in schedule
    if (!schedule.daysOfWeek.includes(currentDay)) continue;
    
    // Check if current time is within schedule range
    if (!isTimeInRange(currentTime, schedule.startTime, schedule.endTime)) continue;
    
    // Add all domains from this schedule
    for (const domain of schedule.domains) {
      blockedDomains.add(domain);
    }
  }
  
  return Array.from(blockedDomains);
}

/**
 * Check if current time is within a time range
 */
function isTimeInRange(currentTime: string, startTime: string, endTime: string): boolean {
  // Handle overnight ranges (e.g., 22:00 - 06:00)
  if (startTime <= endTime) {
    // Normal range (e.g., 09:00 - 17:00)
    return currentTime >= startTime && currentTime <= endTime;
  } else {
    // Overnight range
    return currentTime >= startTime || currentTime <= endTime;
  }
}

/**
 * Create a block rule for a domain
 */
function createBlockRule(domain: string, ruleId: number): chrome.declarativeNetRequest.Rule {
  return {
    id: ruleId,
    priority: 1,
    action: {
      type: chrome.declarativeNetRequest.RuleActionType.REDIRECT,
      redirect: {
        url: `${BLOCK_PAGE_URL}?domain=${encodeURIComponent(domain)}`,
      },
    },
    condition: {
      urlFilter: `*://*.${domain}/*`,
      resourceTypes: [
        chrome.declarativeNetRequest.ResourceType.MAIN_FRAME,
      ],
    },
  };
}

/**
 * Clear all dynamic blocking rules
 */
async function clearAllBlockingRules(): Promise<void> {
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const ruleIds = existingRules.map(rule => rule.id);
  
  if (ruleIds.length > 0) {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: ruleIds,
    });
  }
}

/**
 * Block a specific domain
 */
export async function blockDomain(domain: string): Promise<void> {
  const { addBlockedDomain } = await import('./blockStorage');
  await addBlockedDomain(domain);
  await updateBlockingRules();
  
  console.log(`Blocked domain: ${domain}`);
}

/**
 * Unblock a specific domain
 */
export async function unblockDomain(domain: string): Promise<void> {
  const { removeBlockedDomain } = await import('./blockStorage');
  await removeBlockedDomain(domain);
  await updateBlockingRules();
  
  console.log(`Unblocked domain: ${domain}`);
}

/**
 * Check if a domain should be blocked right now
 */
export async function shouldBlockDomain(domain: string): Promise<{
  blocked: boolean;
  reason: 'blocked' | 'time-limit' | 'schedule' | null;
}> {
  const config = await getBlockConfig();
  
  if (!config.enabled) {
    return { blocked: false, reason: null };
  }
  
  // Check for active override
  const overrides = await getActiveOverrides();
  if (overrides.some(o => o.domain === domain)) {
    return { blocked: false, reason: null };
  }
  
  // Check if in blocked list
  if (isDomainBlocked(domain, config)) {
    return { blocked: true, reason: 'blocked' };
  }
  
  // Check time limit
  if (config.timeLimits[domain]) {
    const usedMinutes = await getDomainMinutesUsedToday(domain);
    if (hasExceededTimeLimit(domain, usedMinutes, config)) {
      return { blocked: true, reason: 'time-limit' };
    }
  }
  
  // TODO: Check schedule
  
  return { blocked: false, reason: null };
}

/**
 * Grant temporary override for a domain
 */
export async function grantOverride(domain: string, reason?: string): Promise<void> {
  const { addActiveOverride } = await import('./blockStorage');
  const config = await getBlockConfig();
  
  const now = Date.now();
  const expiresAt = now + (config.overrideMaxDuration * 60 * 1000);
  
  await addActiveOverride({
    id: `${domain}-${now}`,
    domain,
    startTime: now,
    expiresAt,
    reason,
  });
  
  // Log the override
  await logBlockAttempt({
    domain,
    timestamp: new Date().toISOString(),
    overridden: true,
    overrideReason: reason,
  });
  
  // Update rules to unblock
  await updateBlockingRules();
  
  console.log(`Granted ${config.overrideMaxDuration} minute override for ${domain}`);
}

/**
 * Revoke override for a domain
 */
export async function revokeOverride(domain: string): Promise<void> {
  const { removeActiveOverride } = await import('./blockStorage');
  await removeActiveOverride(domain);
  await updateBlockingRules();
  
  console.log(`Revoked override for ${domain}`);
}

/**
 * Get current blocking status
 */
export async function getBlockingStatus(): Promise<{
  enabled: boolean;
  blockedCount: number;
  activeOverrides: number;
}> {
  const config = await getBlockConfig();
  const overrides = await getActiveOverrides();
  const domainsToBlock = await getDomainsToBlock();
  
  return {
    enabled: config.enabled,
    blockedCount: domainsToBlock.length,
    activeOverrides: overrides.length,
  };
}
