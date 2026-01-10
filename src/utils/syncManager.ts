/**
 * Sync Manager for Extension
 * Handles automatic and manual synchronization of activity data
 */

import { getTodayActivity, getDailySummaries } from './storage';
import { getApiClient } from './apiClient';
import { getAuthManager } from './authManager';
// import type { DomainActivity } from '../types';

interface SyncResult {
	success: boolean;
	syncedCount: number;
	failedCount: number;
	error?: string;
}

interface SyncStatus {
	lastSyncTime: number | null;
	syncing: boolean;
	pendingRecords: number;
	error: string | null;
}

export class SyncManager {
	private static SYNC_ALARM_NAME = 'auto-sync';
	private static SYNC_INTERVAL_MINUTES = 60; // 1 hour
	private static STORAGE_KEY_LAST_SYNC = 'lastSyncTime';
	private static STORAGE_KEY_SYNC_ERROR = 'syncError';
	private syncing = false;

	/**
	 * Initialize sync manager
	 */
	async initialize(): Promise<void> {
		// Check if user is authenticated
		const authManager = getAuthManager();
		const isAuthenticated = await authManager.isAuthenticated();

		if (isAuthenticated) {
			await this.startAutoSync();
		}
	}

	/**
	 * Start automatic sync
	 */
	async startAutoSync(): Promise<void> {
		// Clear existing alarm
		await chrome.alarms.clear(SyncManager.SYNC_ALARM_NAME);

		// Create new alarm
		await chrome.alarms.create(SyncManager.SYNC_ALARM_NAME, {
			periodInMinutes: SyncManager.SYNC_INTERVAL_MINUTES,
		});

		console.log('Auto-sync started: every', SyncManager.SYNC_INTERVAL_MINUTES, 'minutes');
	}

	/**
	 * Stop automatic sync
	 */
	async stopAutoSync(): Promise<void> {
		await chrome.alarms.clear(SyncManager.SYNC_ALARM_NAME);
		console.log('Auto-sync stopped');
	}

	/**
	 * Perform sync now
	 */
	async syncNow(): Promise<SyncResult> {
		if (this.syncing) {
			return {
				success: false,
				syncedCount: 0,
				failedCount: 0,
				error: 'Sync already in progress',
			};
		}

		this.syncing = true;

		try {
			// Check authentication
			const authManager = getAuthManager();
			// const token = await authManager.getAuthToken();

			

			// Get API client and set token
			const apiClient = getApiClient();
			

			// Collect data to sync
			const activitiesToSync = await this.collectDataForSync();

			if (activitiesToSync.length === 0) {
				console.log('No data to sync');
				return {
					success: true,
					syncedCount: 0,
					failedCount: 0,
				};
			}

			// Send data to server
			console.log('Syncing', activitiesToSync.length, 'activity records...');
			const result = await apiClient.syncActivities(activitiesToSync);

			// Update last sync time
			await chrome.storage.local.set({
				[SyncManager.STORAGE_KEY_LAST_SYNC]: Date.now(),
				[SyncManager.STORAGE_KEY_SYNC_ERROR]: null,
			});

			console.log('Sync completed:', result);

			return {
				success: result.success,
				syncedCount: result.syncedCount,
				failedCount: result.failedCount,
			};
		} catch (error) {
			console.error('Sync failed:', error);
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';

			// Store error
			await chrome.storage.local.set({
				[SyncManager.STORAGE_KEY_SYNC_ERROR]: errorMessage,
			});

			return {
				success: false,
				syncedCount: 0,
				failedCount: 0,
				error: errorMessage,
			};
		} finally {
			this.syncing = false;
		}
	}

	/**
	 * Collect data for sync
	 */
	private async collectDataForSync() {
		const activities: Array<{
			date: string;
			domain: string;
			totalTime: number;
			foregroundTime: number;
			backgroundTime: number;
			visitCount: number;
			lastVisit: string;
		}> = [];

		// Get today's activity
		const todayActivity = await getTodayActivity();
		if (todayActivity && todayActivity.domains) {
			for (const [domain, activity] of Object.entries(todayActivity.domains)) {
				activities.push({
					date: todayActivity.date,
					domain,
					totalTime: activity.totalTime,
					foregroundTime: activity.foregroundTime || 0,
					backgroundTime: activity.backgroundTime || 0,
					visitCount: activity.visitCount,
					lastVisit: activity.lastVisit,
				});
			}
		}

		// Get historical summaries (last 7 days)
		const summaries = await getDailySummaries();
		const sevenDaysAgo = new Date();
		sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
		const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0]!;

		for (const [date, summary] of Object.entries(summaries)) {
			// Skip today (already added) and dates older than 7 days
			if (date === todayActivity.date || date < sevenDaysAgoStr) {
				continue;
			}

			// Add top domains from summary
			if (summary.topDomains) {
				for (const domainData of summary.topDomains) {
					activities.push({
						date,
						domain: domainData.domain,
						totalTime: domainData.time,
						foregroundTime: 0, // Historical data might not have this
						backgroundTime: 0,
						visitCount: 1, // Estimated
						lastVisit: new Date(date).toISOString(),
					});
				}
			}
		}

		return activities;
	}

	/**
	 * Get sync status
	 */
	async getSyncStatus(): Promise<SyncStatus> {
		const result = await chrome.storage.local.get([
			SyncManager.STORAGE_KEY_LAST_SYNC,
			SyncManager.STORAGE_KEY_SYNC_ERROR,
		]);

		// Count pending records
		const activities = await this.collectDataForSync();

		return {
			lastSyncTime: result[SyncManager.STORAGE_KEY_LAST_SYNC] || null,
			syncing: this.syncing,
			pendingRecords: activities.length,
			error: result[SyncManager.STORAGE_KEY_SYNC_ERROR] || null,
		};
	}

	/**
	 * Clear sync error
	 */
	async clearSyncError(): Promise<void> {
		await chrome.storage.local.remove(SyncManager.STORAGE_KEY_SYNC_ERROR);
	}
}

// Singleton instance
let syncManagerInstance: SyncManager | null = null;

export function getSyncManager(): SyncManager {
	if (!syncManagerInstance) {
		syncManagerInstance = new SyncManager();
	}
	return syncManagerInstance;
}

// Handle sync alarm
chrome.alarms?.onAlarm.addListener((alarm) => {
	if (alarm.name === 'auto-sync') {
		console.log('Auto-sync triggered');
		const syncManager = getSyncManager();
		syncManager.syncNow().catch((error) => {
			console.error('Auto-sync failed:', error);
		});
	}
});
