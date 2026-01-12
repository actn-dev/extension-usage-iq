import { useEffect, useState } from "react";

interface SyncStatusProps {
  onSyncClick: () => void;
}

export function SyncStatus({ onSyncClick }: SyncStatusProps) {
  const [syncStatus, setSyncStatus] = useState<{
    lastSync: number | null;
    syncing: boolean;
    error: string | null;
    pendingRecords: number;
    unsyncedSessions: number;
    currentSessionDelta: boolean;
  }>({
    lastSync: null,
    syncing: false,
    error: null,
    pendingRecords: 0,
    unsyncedSessions: 0,
    currentSessionDelta: false,
  });

  useEffect(() => {
    loadSyncStatus();
    const interval = setInterval(loadSyncStatus, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const loadSyncStatus = async () => {
    try {
      // Request sync status from background worker
      const status = await chrome.runtime.sendMessage({ type: 'GET_SYNC_STATUS' });
      
      // Count unsynced sessions
      const result = await chrome.storage.local.get(['sessions', 'currentSession']);
      const sessions = result.sessions || {};
      const currentSession = result.currentSession;
      
      const unsyncedCount = Object.values(sessions).filter(
        (s: any) => !s.syncedAt
      ).length;
      
      // Check if current session has delta to sync
      const hasCurrentDelta = currentSession && (
        currentSession.focusedTime > currentSession.focusedTimeAtLastSync ||
        currentSession.unfocusedTime > currentSession.unfocusedTimeAtLastSync ||
        currentSession.idleTime > currentSession.idleTimeAtLastSync
      );
      
      setSyncStatus({
        lastSync: status.lastSyncTime,
        syncing: status.syncing,
        error: status.error,
        pendingRecords: status.pendingRecords || 0,
        unsyncedSessions: unsyncedCount,
        currentSessionDelta: hasCurrentDelta || false,
      });
    } catch (error) {
      console.error('Error loading sync status:', error);
    }
  };

  const formatLastSync = (timestamp: number | null) => {
    if (!timestamp) return 'Never';
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
  };

  return (
    <div className="bg-slate-800/60 rounded-lg border border-slate-700 p-6">
      <h2 className="text-xl font-semibold mb-4">Data Synchronization</h2>
      
      <div className="space-y-4">
        {/* Pending Sync Items */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 bg-slate-700/30 rounded-lg border border-slate-600/50">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-gray-400">Unsynced Sessions</p>
            </div>
            <p className="text-3xl font-bold text-white">{syncStatus.unsyncedSessions}</p>
            <p className="text-xs text-gray-500 mt-1">Ended sessions pending</p>
          </div>
          
          <div className="p-4 bg-slate-700/30 rounded-lg border border-slate-600/50">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <p className="text-xs text-gray-400">Current Session</p>
            </div>
            <p className="text-sm font-semibold text-white">
              {syncStatus.currentSessionDelta ? (
                <span className="text-yellow-400 flex items-center gap-1">
                  <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></span>
                  Has new data
                </span>
              ) : (
                <span className="text-green-400 flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                  Up to date
                </span>
              )}
            </p>
            <p className="text-xs text-gray-500 mt-1">Active session status</p>
          </div>
        </div>

        {/* Last Sync Status */}
        <div className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg">
          <div className="flex-1">
            <p className="font-medium">Last Sync</p>
            <p className="text-sm text-gray-400">
              {formatLastSync(syncStatus.lastSync)}
            </p>
            {syncStatus.pendingRecords > 0 && (
              <p className="text-xs text-blue-400 mt-1">
                {syncStatus.pendingRecords} activity records pending
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {syncStatus.syncing && (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
            )}
            <span className={`px-3 py-1 rounded text-xs font-medium ${
              syncStatus.error 
                ? 'bg-red-600/20 text-red-400 border border-red-600/50'
                : syncStatus.syncing
                ? 'bg-blue-600/20 text-blue-400 border border-blue-600/50'
                : 'bg-green-600/20 text-green-400 border border-green-600/50'
            }`}>
              {syncStatus.error ? 'Failed' : syncStatus.syncing ? 'Syncing...' : 'Synced'}
            </span>
          </div>
        </div>

        {/* Error Message */}
        {syncStatus.error && (
          <div className="p-4 bg-red-600/10 border border-red-600/30 rounded-lg">
            <p className="text-sm text-red-400">
              <span className="font-medium">Sync Error:</span> {syncStatus.error}
            </p>
          </div>
        )}

        {/* Sync Button */}
        <button
          onClick={onSyncClick}
          disabled={syncStatus.syncing}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
        >
          {syncStatus.syncing ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Syncing...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Sync Now
              {(syncStatus.unsyncedSessions > 0 || syncStatus.currentSessionDelta) && (
                <span className="ml-1 px-2 py-0.5 bg-yellow-600/30 text-yellow-300 rounded text-xs">
                  {syncStatus.unsyncedSessions + (syncStatus.currentSessionDelta ? 1 : 0)} pending
                </span>
              )}
            </>
          )}
        </button>

        <p className="text-xs text-gray-400 text-center">
          Automatic sync runs every hour when signed in
        </p>
      </div>
    </div>
  );
}
