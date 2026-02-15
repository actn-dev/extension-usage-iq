import { useEffect, useState } from 'react';
import { authClient } from '@src/lib/auth/auth-client';
import { getAuthManager } from '@src/utils/authManager';
import { OrganizationSelector } from '@src/components/organization-selector';

interface SyncStatus {
    lastSync: number | null;
    syncing: boolean;
    error: string | null;
    pendingRecords: number;
}

export default function Account() {
    const session = authClient.useSession();
    const [showOrgSelector, setShowOrgSelector] = useState(false);
    const [hasActiveOrg, setHasActiveOrg] = useState(false);
    const [syncStatus, setSyncStatus] = useState<SyncStatus>({
        lastSync: null,
        syncing: false,
        error: null,
        pendingRecords: 0,
    });

    useEffect(() => {
        checkActiveOrganization();
        loadSyncStatus();
        const interval = setInterval(loadSyncStatus, 5000);
        return () => clearInterval(interval);
    }, [session.data]);

    async function checkActiveOrganization() {
        if (session.data) {
            const authManager = getAuthManager();
            const hasOrg = await authManager.hasActiveOrganization();
            setHasActiveOrg(hasOrg);
            setShowOrgSelector(!hasOrg);
        }
    }

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

    async function handleLogin() {
        await authClient.signIn.social({
            provider: 'google',
        });
    }

    async function handleLogout() {
        await authClient.signOut();
        const authManager = getAuthManager();
        await authManager.clearActiveOrganization();
        setHasActiveOrg(false);
        setShowOrgSelector(false);
    }

    function handleOrganizationSelected() {
        setHasActiveOrg(true);
        setShowOrgSelector(false);
    }

    function handleChangeOrganization() {
        setShowOrgSelector(true);
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

    if (session.isPending) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-gray-400">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-6">
            <div className="w-full max-w-md">

                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 mb-2">
                        Dilly Account
                    </h1>
                    <p className="text-gray-400 text-sm">Manage your account & sync</p>
                </div>

                {/* Main Card */}
                <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 shadow-2xl overflow-hidden">

                    {/* Not Logged In */}
                    {!session.data && (
                        <div className="p-8 text-center">
                            <div className="mb-6">
                                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full mx-auto mb-4 flex items-center justify-center">
                                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                </div>
                                <p className="text-gray-300 mb-2">Sign in to sync your data</p>
                                <p className="text-sm text-gray-500">Track activity across devices</p>
                            </div>

                            <button
                                onClick={handleLogin}
                                className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl"
                            >
                                Sign in with Google
                            </button>
                        </div>
                    )}

                    {/* Logged In */}
                    {session.data && (
                        <div className="p-6">

                            {/* User Info */}
                            {!showOrgSelector && (
                                <>
                                    <div className="flex items-center gap-4 mb-6 pb-6 border-b border-slate-700">
                                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                                            {session.data.user.email?.[0].toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-white font-medium truncate">{session.data.user.email}</p>
                                            <p className="text-sm text-gray-400">Signed in</p>
                                        </div>
                                        <div className="flex-shrink-0">
                                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                        </div>
                                    </div>

                                    {/* Organization Status */}
                                    {hasActiveOrg ? (
                                        <div className="mb-6 p-4 bg-green-600/10 border border-green-600/30 rounded-lg">
                                            <div className="flex items-center gap-2 mb-2">
                                                <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                </svg>
                                                <span className="text-sm font-medium text-green-400">Organization Active</span>
                                            </div>
                                            <p className="text-xs text-green-300">Your activity is being tracked and synced</p>
                                        </div>
                                    ) : (
                                        <div className="mb-6 p-4 bg-yellow-600/10 border border-yellow-600/30 rounded-lg">
                                            <div className="flex items-center gap-2 mb-2">
                                                <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                </svg>
                                                <span className="text-sm font-medium text-yellow-400">No Organization</span>
                                            </div>
                                            <p className="text-xs text-yellow-300">Select an organization to enable sync</p>
                                        </div>
                                    )}

                                    {/* Sync Status */}
                                    <div className="mb-6">
                                        <h3 className="text-sm font-medium text-gray-300 mb-3">Sync Status</h3>
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-gray-400">Last Sync</span>
                                                <span className="text-white font-medium">{formatLastSync(syncStatus.lastSync)}</span>
                                            </div>
                                            {/* <div className="flex items-center justify-between text-sm">
                                                <span className="text-gray-400">Pending Records</span>
                                                <span className={`font-medium ${syncStatus.pendingRecords > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                                                    {syncStatus.pendingRecords}
                                                </span>
                                            </div> */}
                                            {syncStatus.error && (
                                                <div className="text-xs text-red-400 bg-red-600/10 border border-red-600/30 rounded p-2">
                                                    {syncStatus.error}
                                                </div>
                                            )}
                                        </div>

                                        <button
                                            onClick={handleManualSync}
                                            disabled={syncStatus.syncing || !hasActiveOrg}
                                            className={`w-full mt-4 px-4 py-2.5 rounded-lg font-medium transition-all ${syncStatus.syncing || !hasActiveOrg
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

                                    {/* Actions */}
                                    <div className="space-y-2 pt-4 border-t border-slate-700">
                                        <button
                                            onClick={handleChangeOrganization}
                                            className="w-full px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
                                        >
                                            Change Organization
                                        </button>
                                        <button
                                            onClick={handleLogout}
                                            className="w-full px-4 py-2.5 bg-slate-700 hover:bg-red-600 text-gray-300 hover:text-white rounded-lg font-medium transition-colors"
                                        >
                                            Sign Out
                                        </button>
                                    </div>
                                </>
                            )}

                            {/* Organization Selector */}
                            {showOrgSelector && (
                                <div>
                                    <div className="mb-4 flex items-center justify-between">
                                        <h3 className="text-lg font-semibold text-white">Select Organization</h3>
                                        {hasActiveOrg && (
                                            <button
                                                onClick={() => setShowOrgSelector(false)}
                                                className="text-sm text-gray-400 hover:text-white"
                                            >
                                                Cancel
                                            </button>
                                        )}
                                    </div>
                                    <OrganizationSelector onOrganizationSelected={handleOrganizationSelected} />
                                    <button
                                        onClick={handleLogout}
                                        className="w-full mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-gray-300 rounded-lg text-sm"
                                    >
                                        Sign Out
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Link */}
                {/* <div className="text-center mt-6">
                    <button
                        onClick={() => chrome.runtime.openOptionsPage()}
                        className="text-sm text-gray-400 hover:text-blue-400 transition-colors"
                    >
                        Open Dashboard →
                    </button>
                </div> */}
            </div>
        </div>
    );
}
