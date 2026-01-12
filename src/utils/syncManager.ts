/**
 * Sync Manager for Extension
 * Handles automatic and manual synchronization of activity data
 */

import { getTodayActivity, getDailySummaries, getAllSessionDomains } from './storage';
import { getAllSessions } from './sessionManager';
import { getApiClient } from './apiClient';
import { getAuthManager } from './authManager';
import { getDeviceInfo } from './deviceManager';
import type { BrowserSession } from '../types';

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
			const sessionsToSync = await this.collectSessionsForSync();

			if (activitiesToSync.length === 0 && sessionsToSync.length === 0) {
				console.log('No data to sync');
				return {
					success: true,
					syncedCount: 0,
					failedCount: 0,
				};
			}

			// Send data to server
			console.log('Syncing', activitiesToSync.length, 'activity records and', sessionsToSync.length, 'sessions...');
			
			// Send everything in ONE request
			const result = await apiClient.syncActivities(activitiesToSync, sessionsToSync);

			// Mark synced sessions after successful sync
			await this.markSessionsAsSynced(sessionsToSync);

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
	 * Collect data for sync (per-session domains)
	 */
	private async collectDataForSync() {
		const activities: Array<{
			date: string;
			domain: string;
			totalTime: number;
			foregroundTime: number;
			backgroundTime: number;
			audibleTime: number;
			visitCount: number;
			lastVisit: string;
			deviceId: string;
			deviceName?: string;
			browserName?: string;
			browserVersion?: string;
			osName?: string;
			osVersion?: string;
			sessionId: string;
		}> = [];

		// Get device info once
		const deviceInfo = await getDeviceInfo();
		const todayActivity = await getTodayActivity();

		// Get per-session domains (last 7 days)
		const allSessionDomains = await getAllSessionDomains();
		const sevenDaysAgo = new Date();
		sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
		const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0]!;

		// Iterate through all sessions and their domains
		for (const [sessionId, domains] of Object.entries(allSessionDomains)) {
			for (const [domain, activity] of Object.entries(domains)) {
				// Only sync recent data (last 7 days)
				if (activity.date >= sevenDaysAgoStr) {
					activities.push({
						date: activity.date,
						domain,
						totalTime: activity.totalTime,
						foregroundTime: activity.foregroundTime || 0,
						backgroundTime: activity.backgroundTime || 0,
						audibleTime: activity.audibleTime || 0,
						visitCount: activity.visitCount,
						lastVisit: activity.lastVisit,
						sessionId: activity.sessionId,
						// Device info
						deviceId: deviceInfo.deviceId,
						deviceName: deviceInfo.deviceName,
						browserName: deviceInfo.browserName,
						browserVersion: deviceInfo.browserVersion,
						osName: deviceInfo.osName,
						osVersion: deviceInfo.osVersion,
					});
				}
			}
		}

		// Get historical summaries (last 7 days) for any missing data
		const summaries = await getDailySummaries();

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
						audibleTime: 0,
						visitCount: 1, // Estimated
						lastVisit: new Date(date).toISOString(),
						sessionId: 'historical',
						// Device info
						deviceId: deviceInfo.deviceId,
						deviceName: deviceInfo.deviceName,
						browserName: deviceInfo.browserName,
						browserVersion: deviceInfo.browserVersion,
						osName: deviceInfo.osName,
						osVersion: deviceInfo.osVersion,
					});
				}
			}
		}

		return activities;
	}

	/**
	 * Collect sessions for sync
	 */
	private async collectSessionsForSync() {
		const sessions: Array<{
			sessionId: string;
			startTime: number;
			endTime: number | null;
			focusedTime: number;
			unfocusedTime: number;
			idleTime: number;
			totalTime: number;
			tabCount: number;
			domainCount: number;
			deviceId: string;
			deviceName?: string;
		}> = [];

		// Get device info
		const deviceInfo = await getDeviceInfo();

		// Get all sessions (last 7 days)
		const allSessions = await getAllSessions();
		const currentSessionData = await chrome.storage.local.get('currentSession');
		const currentSession = currentSessionData.currentSession as BrowserSession | null;
		
		const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

		// Collect ended sessions that haven't been synced yet
		for (const [sessionId, session] of Object.entries(allSessions)) {
			// Only sync recent sessions that haven't been synced
			if (session.startTime >= sevenDaysAgo && !session.syncedAt) {
				sessions.push({
					...session,
					deviceId: deviceInfo.deviceId,
					deviceName: deviceInfo.deviceName,
				});
			}
		}

		// Handle current ongoing session (partial sync with delta)
		if (currentSession && currentSession.startTime >= sevenDaysAgo) {
			// Calculate delta since last sync
			const deltaFocusedTime = currentSession.focusedTime - currentSession.focusedTimeAtLastSync;
			const deltaUnfocusedTime = currentSession.unfocusedTime - currentSession.unfocusedTimeAtLastSync;
			const deltaIdleTime = currentSession.idleTime - currentSession.idleTimeAtLastSync;
			
			// Only include if there's new data to sync
			if (deltaFocusedTime > 0 || deltaUnfocusedTime > 0 || deltaIdleTime > 0) {
				sessions.push({
					sessionId: currentSession.sessionId,
					startTime: currentSession.startTime,
					endTime: null, // Still ongoing
					focusedTime: deltaFocusedTime,
					unfocusedTime: deltaUnfocusedTime,
					idleTime: deltaIdleTime,
					totalTime: deltaFocusedTime + deltaUnfocusedTime + deltaIdleTime,
					tabCount: currentSession.tabCount,
					domainCount: currentSession.domainCount,
					deviceId: deviceInfo.deviceId,
					deviceName: deviceInfo.deviceName,
				});
			}
		}

		return sessions;
	}

	/**
	 * Mark sessions as synced after successful sync
	 */
	private async markSessionsAsSynced(syncedSessions: Array<{ sessionId: string; endTime: number | null }>) {
		const allSessions = await getAllSessions();
		const currentSessionData = await chrome.storage.local.get('currentSession');
		const currentSession = currentSessionData.currentSession as BrowserSession | null;
		const now = Date.now();
		
		for (const syncedSession of syncedSessions) {
			if (syncedSession.endTime === null && currentSession?.sessionId === syncedSession.sessionId) {
				// This is the current ongoing session - update checkpoint
				currentSession.lastSyncCheckpoint = now;
				currentSession.focusedTimeAtLastSync = currentSession.focusedTime;
				currentSession.unfocusedTimeAtLastSync = currentSession.unfocusedTime;
				currentSession.idleTimeAtLastSync = currentSession.idleTime;
				await chrome.storage.local.set({ currentSession });
			} else if (allSessions[syncedSession.sessionId]) {
				// This is an ended session - mark as fully synced
				allSessions[syncedSession.sessionId].syncedAt = now;
			}
		}
		
		// Save updated sessions
		await chrome.storage.local.set({ sessions: allSessions });
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
