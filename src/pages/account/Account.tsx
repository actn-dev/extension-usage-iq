import { useEffect, useState } from 'react';
import { hasOrgKey } from '@src/utils/managedConfig';

interface SyncStatus {
    lastSync: number | null;
    syncing: boolean;
    error: string | null;
    pendingRecords: number;
}

export default function Account() {
    const [isOrgConfigured, setIsOrgConfigured] = useState(false);
    const [syncStatus, setSyncStatus] = useState<SyncStatus>({
        lastSync: null,
        syncing: false,
        error: null,
        pendingRecords: 0,
    });

    useEffect(() => {
        hasOrgKey().then(setIsOrgConfigured);
        loadSyncStatus();
        const interval = setInterval(loadSyncStatus, 5000);
        return () => clearInterval(interval);
    }, []);

    async function loadSyncStatus() {
        try {
            const status = await chrome.runtime.sendMessage({ type: 'GET_SYNC_STATUS' });
            setSyncStatus({
                lastSync: status.lastSyncTime,
                syncing: status.syncing,
                error: status.error,
                pendingRecords: status.pendingRecords || 0,
            });
        } catch (error) {
            console.error('Error loading sync status:', error);
        }
    }

    async function handleManualSync() {
        setSyncStatus(prev => ({ ...prev, syncing: true, error: null }));
        try {
            const result = await chrome.runtime.sendMessage({ type: 'MANUAL_SYNC' });

            if (result.success) {
                setSyncStatus({
                    lastSync: Date.now(),
                    syncing: false,
                    error: null,
                    pendingRecords: 0,
                });
            } else {
                setSyncStatus(prev => ({
                    ...prev,
                    syncing: false,
                    error: result.error || 'Sync failed',
                }));
            }

            await loadSyncStatus();
        } catch (error) {
            console.error('Sync error:', error);
            setSyncStatus(prev => ({
                ...prev,
                syncing: false,
                error: error instanceof Error ? error.message : 'Sync failed',
            }));
        }
    }

    const formatLastSync = (timestamp: number | null) => {
        if (!timestamp) return 'Never';
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / 60000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    };

    return (
        <div className="min-h-screen bg-linear-to-br from-slate-900 to-slate-800 flex items-center justify-center p-6">
            <div className="w-full max-w-md">

                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-linear-to-r from-blue-400 to-purple-500 mb-2">
                        Dilly Account
                    </h1>
                    <p className="text-gray-400 text-sm">Managed by your organization</p>
                </div>

                {/* Main Card */}
                <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 shadow-2xl overflow-hidden p-6 space-y-6">

                    {/* Org Configuration Status */}
                    {isOrgConfigured ? (
                        <div className="p-4 bg-green-600/10 border border-green-600/30 rounded-lg">
                            <div className="flex items-center gap-2 mb-1">
                                <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <span className="text-sm font-medium text-green-400">Organization Configured</span>
                            </div>
                            <p className="text-xs text-green-300">Your activity is being tracked and synced by your admin.</p>
                        </div>
                    ) : (
                        <div className="p-4 bg-yellow-600/10 border border-yellow-600/30 rounded-lg">
                            <div className="flex items-center gap-2 mb-1">
                                <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                <span className="text-sm font-medium text-yellow-400">Not Configured</span>
                            </div>
                            <p className="text-xs text-yellow-300">Organization key not found. Contact your admin to configure this extension via Google Admin Console.</p>
                        </div>
                    )}

                    {/* Sync Status */}
                    <div>
                        <h3 className="text-sm font-medium text-gray-300 mb-3">Sync Status</h3>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-400">Last Sync</span>
                                <span className="text-white font-medium">{formatLastSync(syncStatus.lastSync)}</span>
                            </div>
                            {syncStatus.syncing && (
                                <div className="text-xs text-blue-400">Syncing in progress...</div>
                            )}
                            {syncStatus.error && (
                                <div className="text-xs text-red-400 bg-red-600/10 border border-red-600/30 rounded p-2">
                                    {syncStatus.error}
                                </div>
                            )}
                        </div>

                        <button
                            onClick={handleManualSync}
                            disabled={syncStatus.syncing || !isOrgConfigured}
                            className={`w-full mt-4 px-4 py-2.5 rounded-lg font-medium transition-all ${syncStatus.syncing || !isOrgConfigured
                                ? 'bg-slate-700 text-gray-500 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl'
                                }`}
                        >
                            {syncStatus.syncing ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Syncing...
                                </span>
                            ) : (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    Sync Now
                                </span>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
