// Extension Config Sync Manager
// Fetches blocking configuration from server and manages local cache

import { getAuthManager } from './authManager';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface ServerBlockConfig {
    enabled: boolean;
    softBlock: boolean;
    overrideEnabled: boolean;
    overrideMaxDuration: number;
    blockedDomains: Array<{
        domain: string;
        timeLimit: number | null;
    }>;
    schedules: Array<{
        id: string;
        name: string;
        enabled: boolean;
        daysOfWeek: number[];
        startTime: string;
        endTime: string;
        domains: string[];
    }>;
}

export interface BlockAttemptLog {
    domain: string;
    timestamp: string;
    reason: 'blocked' | 'time-limit' | 'schedule';
    overridden: boolean;
    overrideReason?: string;
    scheduleId?: string;
}

class BlockConfigSync {
    private static instance: BlockConfigSync;
    private pendingAttempts: BlockAttemptLog[] = [];
    private isSyncing = false;

    private constructor() {}

    static getInstance(): BlockConfigSync {
        if (!BlockConfigSync.instance) {
            BlockConfigSync.instance = new BlockConfigSync();
        }
        return BlockConfigSync.instance;
    }

    /**
     * Fetch blocking configuration from server
     */
    async fetchConfig(): Promise<ServerBlockConfig | null> {
        try {
            const authManager = getAuthManager();
            const session = await authManager.getSession();

            if (!session) {
                console.log('No session, skipping config fetch');
                return null;
            }

            const response = await fetch(`${API_BASE_URL}/api/extension/blocking/config`, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                if (response.status === 401) {
                    console.log('Unauthorized - session may have expired');
                    return null;
                }
                throw new Error(`Failed to fetch config: ${response.status}`);
            }

            const config = await response.json() as ServerBlockConfig;

            // Cache locally (read-only)
            await chrome.storage.local.set({
                blockConfig: this.transformToLocalFormat(config),
                blockConfigLastFetch: Date.now(),
            });

            console.log('Block config fetched and cached:', config);
            
            // Notify background to update blocking rules
            try {
                await chrome.runtime.sendMessage({ type: 'UPDATE_BLOCKING_RULES' });
            } catch (error) {
                console.log('Could not notify background (may not be ready):', error);
            }
            
            return config;
        } catch (error) {
            console.error('Error fetching block config:', error);
            return null;
        }
    }

    /**
     * Transform server config to local format compatible with existing code
     */
    private transformToLocalFormat(serverConfig: ServerBlockConfig) {
        // ALL domains go into blockedDomains array (server is source of truth)
        const blockedDomains = serverConfig.blockedDomains.map(d => d.domain);

        // Separate time limits
        const timeLimits: Record<string, number> = {};
        serverConfig.blockedDomains
            .filter(d => d.timeLimit !== null)
            .forEach(d => {
                timeLimits[d.domain] = d.timeLimit!;
            });

        return {
            enabled: serverConfig.enabled ?? true, // Default to enabled
            blockedDomains,
            timeLimits,
            schedules: serverConfig.schedules || [],
            softBlock: serverConfig.softBlock ?? false,
            overrideEnabled: serverConfig.overrideEnabled ?? false,
            overrideMaxDuration: serverConfig.overrideMaxDuration ?? 30,
        };
    }

    /**
     * Log a block attempt (queued for sync)
     */
    async logBlockAttempt(attempt: BlockAttemptLog): Promise<void> {
        this.pendingAttempts.push(attempt);

        // Try to sync immediately if not already syncing
        if (!this.isSyncing) {
            await this.syncBlockAttempts();
        }
    }

    /**
     * Sync pending block attempts to server
     */
    async syncBlockAttempts(): Promise<void> {
        if (this.isSyncing || this.pendingAttempts.length === 0) {
            return;
        }

        try {
            this.isSyncing = true;

            const authManager = getAuthManager();
            const session = await authManager.getSession();

            if (!session) {
                console.log('No session, cannot sync block attempts');
                return;
            }

            const attemptsToSync = [...this.pendingAttempts];
            this.pendingAttempts = [];

            const response = await fetch(`${API_BASE_URL}/api/extension/blocking/attempts`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ attempts: attemptsToSync }),
            });

            if (!response.ok) {
                // Re-queue attempts on failure
                this.pendingAttempts.unshift(...attemptsToSync);
                throw new Error(`Failed to sync attempts: ${response.status}`);
            }

            console.log(`Synced ${attemptsToSync.length} block attempts to server`);
        } catch (error) {
            console.error('Error syncing block attempts:', error);
        } finally {
            this.isSyncing = false;
        }
    }

    /**
     * Initialize periodic config sync
     */
    startPeriodicSync(): void {
        // Fetch config every 5 minutes
        chrome.alarms.create('syncBlockConfig', {
            periodInMinutes: 5,
        });

        // Sync attempts every minute if any pending
        chrome.alarms.create('syncBlockAttempts', {
            periodInMinutes: 1,
        });

        console.log('Periodic block config sync initialized');
    }

    /**
     * Get cached config (for immediate use)
     */
    async getCachedConfig(): Promise<ServerBlockConfig | null> {
        try {
            const result = await chrome.storage.local.get(['blockConfig', 'blockConfigLastFetch']);
            
            if (!result.blockConfig) {
                return null;
            }

            // Check if cache is stale (older than 10 minutes)
            const lastFetch = result.blockConfigLastFetch || 0;
            const cacheAge = Date.now() - lastFetch;
            const MAX_CACHE_AGE = 10 * 60 * 1000; // 10 minutes

            if (cacheAge > MAX_CACHE_AGE) {
                console.log('Cached config is stale, fetching fresh config');
                return await this.fetchConfig();
            }

            return result.blockConfig as ServerBlockConfig;
        } catch (error) {
            console.error('Error getting cached config:', error);
            return null;
        }
    }
}

// Singleton instance
export function getBlockConfigSync(): BlockConfigSync {
    return BlockConfigSync.getInstance();
}
