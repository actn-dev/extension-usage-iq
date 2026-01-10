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
    
    console.log('🚫 Domains to block:', domainsToBlock);
    
    // Create TWO rules per domain (with and without subdomain)
    const rules: chrome.declarativeNetRequest.Rule[] = [];
    let ruleId = RULE_ID_START;
    
    for (const domain of domainsToBlock) {
      // Rule 1: Match with subdomain (www.domain.com)
      rules.push(createBlockRule(domain, ruleId++, true));
      // Rule 2: Match without subdomain (domain.com)
      rules.push(createBlockRule(domain, ruleId++, false));
    }
    
    // Remove old rules and add new ones
    await clearAllBlockingRules();
    
    if (rules.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        addRules: rules,
      });
      console.log(`✅ Added ${rules.length} blocking rules for ${domainsToBlock.length} domains`);
    } else {
      console.log('⚠️ No blocking rules to add');
    }
  } catch (error) {
    console.error('Error updating blocking rules:', error);
  }
}

/**
 * Get list of domains that should be blocked right now
 * 
 * Priority logic:
 * 1. If domain has time limit -> block only when limit exceeded
 * 2. If domain has schedule -> block only during schedule times  
 * 3. If domain is in blocked list (no time limit/schedule) -> always block
 */
async function getDomainsToBlock(): Promise<string[]> {
  const config = await getBlockConfig();
  
  console.log('📋 Block config:', {
    enabled: config.enabled,
    blockedDomains: config.blockedDomains,
    timeLimits: config.timeLimits,
    schedules: config.schedules?.length || 0
  });
  
  if (!config.enabled) {
    console.log('⚠️ Blocking is DISABLED in config');
    return [];
  }
  
  const overrides = await getActiveOverrides();
  const overrideDomains = new Set(overrides.map(o => o.domain));
  
  const domainsToBlock: string[] = [];
  const domainsWithTimeLimits = new Set(Object.keys(config.timeLimits));
  const scheduleBlockedDomains = getScheduleBlockedDomains(config);
  const domainsWithSchedules = new Set(scheduleBlockedDomains);
  
  // Check time limits FIRST (higher priority - allows usage until limit)
  for (const [domain, limitMinutes] of Object.entries(config.timeLimits)) {
    // Skip if has active override
    if (overrideDomains.has(domain)) continue;
    
    const usedMinutes = await getDomainMinutesUsedToday(domain);
    if (usedMinutes >= limitMinutes) {
      domainsToBlock.push(domain);
    }
  }
  
  // Check schedule-based blocks SECOND
  for (const domain of scheduleBlockedDomains) {
    // Skip if already blocked or has override
    if (domainsToBlock.includes(domain) || overrideDomains.has(domain)) continue;
    
    domainsToBlock.push(domain);
  }
  
  // Check permanent blocked domains LAST (only if no time limit or schedule)
  for (const domain of config.blockedDomains) {
    // Skip if has active override
    if (overrideDomains.has(domain)) {
      console.log(`⏭️ Skipping ${domain} - has active override`);
      continue;
    }
    
    // Skip if already blocked
    if (domainsToBlock.includes(domain)) {
      console.log(`⏭️ Skipping ${domain} - already in block list`);
      continue;
    }
    
    // Skip if domain has time limit or schedule (those take priority)
    if (domainsWithTimeLimits.has(domain) || domainsWithSchedules.has(domain)) {
      console.log(`⏭️ Skipping ${domain} - has time limit or schedule (will check separately)`);
      continue;
    }
    
    // Permanently block this domain (no time limit or schedule)
    console.log(`🚫 Adding permanent block for: ${domain}`);
    domainsToBlock.push(domain);
  }
  
  console.log('✅ Final domains to block:', domainsToBlock);
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
function createBlockRule(domain: string, ruleId: number, withSubdomain: boolean): chrome.declarativeNetRequest.Rule {
  // Pattern with subdomain: *://*.domain.com/*  (matches www.domain.com, sub.domain.com)
  // Pattern without subdomain: *://domain.com/*  (matches domain.com)
  const urlFilter = withSubdomain ? `*://*.${domain}/*` : `*://${domain}/*`;
  
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
      urlFilter,
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
