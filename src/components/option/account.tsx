import { useEffect, useState } from "react";
import { hasOrgKey } from "@src/utils/managedConfig";
import { SyncStatus } from "./sync-status";

interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  browserName: string;
  browserVersion: string;
  osName: string;
  osVersion: string;
}

// Account Tab Component
export function AccountTab() {
  const [isOrgConfigured, setIsOrgConfigured] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{
    lastSync: number | null;
    syncing: boolean;
    error: string | null;
    pendingRecords: number;
  }>({
    lastSync: null,
    syncing: false,
    error: null,
    pendingRecords: 0,
  });

  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [editingDeviceName, setEditingDeviceName] = useState(false);
  const [newDeviceName, setNewDeviceName] = useState('');

  useEffect(() => {
    hasOrgKey().then(setIsOrgConfigured);
    loadSyncStatus();
    loadDeviceInfo();
    const interval = setInterval(loadSyncStatus, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const loadDeviceInfo = async () => {
    try {
      const info = await chrome.runtime.sendMessage({ type: 'GET_DEVICE_INFO' });
      setDeviceInfo(info);
      setNewDeviceName(info.deviceName);
    } catch (error) {
      console.error('Error loading device info:', error);
    }
  };

  const loadSyncStatus = async () => {
    try {
      // Request sync status from background worker
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
  };

  const handleManualSync = async () => {
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

      // Reload status
      await loadSyncStatus();
    } catch (error) {
      console.error('Sync error:', error);
      setSyncStatus(prev => ({
        ...prev,
        syncing: false,
        error: error instanceof Error ? error.message : 'Sync failed',
      }));
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

  const handleSaveDeviceName = async () => {
    if (!newDeviceName.trim()) return;

    try {
      await chrome.runtime.sendMessage({
        type: 'SET_DEVICE_NAME',
        deviceName: newDeviceName.trim()
      });
      await loadDeviceInfo();
      setEditingDeviceName(false);
    } catch (error) {
      console.error('Error saving device name:', error);
    }
  };

  const handleCancelEdit = () => {
    setNewDeviceName(deviceInfo?.deviceName || '');
    setEditingDeviceName(false);
  };

  return (
    <div className="space-y-6">
      {/* Account Section */}
      <div className="bg-slate-800/60 rounded-lg border border-slate-700 p-6">
        <h2 className="text-xl font-semibold mb-4">Organization Status</h2>
        {isOrgConfigured ? (
          <div className="flex items-center gap-2 text-green-400">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="text-sm">Organization configured by admin. Tracking is active.</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-yellow-400">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span className="text-sm">Not configured. Contact your admin to set up this extension via Google Admin Console.</span>
          </div>
        )}
      </div>

      {/* Device Information Section */}
      {deviceInfo && (
        <div className="bg-slate-800/60 rounded-lg border border-slate-700 p-6">
          <h2 className="text-xl font-semibold mb-4">Device Information</h2>
          <p className="text-gray-400 mb-4 text-sm">
            This device is identified separately in your activity reports, allowing you to track usage across multiple devices.
          </p>

          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-slate-700/30 rounded-lg">
              <span className="text-gray-400">Device Name</span>
              {editingDeviceName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newDeviceName}
                    onChange={(e) => setNewDeviceName(e.target.value)}
                    className="bg-slate-900 border border-slate-600 rounded px-3 py-1 text-white text-sm focus:border-blue-500 focus:outline-none"
                    placeholder="Device name"
                    autoFocus
                  />
                  <button
                    onClick={handleSaveDeviceName}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
                  >
                    Save
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="bg-slate-600 hover:bg-slate-500 text-white px-3 py-1 rounded text-sm"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="font-medium">{deviceInfo.deviceName}</span>
                  <button
                    onClick={() => setEditingDeviceName(true)}
                    className="text-blue-400 hover:text-blue-300 text-sm"
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center p-3 bg-slate-700/30 rounded-lg">
              <span className="text-gray-400">Browser</span>
              <span className="font-medium">{deviceInfo.browserName}</span>
            </div>

            <div className="flex justify-between items-center p-3 bg-slate-700/30 rounded-lg">
              <span className="text-gray-400">Operating System</span>
              <span className="font-medium">{deviceInfo.osName}</span>
            </div>

            <div className="flex justify-between items-center p-3 bg-slate-700/30 rounded-lg">
              <span className="text-gray-400">Device ID</span>
              <code className="text-xs text-blue-400 font-mono">{deviceInfo.deviceId.slice(0, 8)}...</code>
            </div>
          </div>

          <div className="mt-4 p-3 bg-blue-600/10 border border-blue-600/30 rounded-lg">
            <p className="text-sm text-blue-300">
              ℹ️ Your activity data is tracked separately for each device. You can view per-device reports on the web dashboard.
            </p>
          </div>
        </div>
      )}

      {/* Sync Status Section */}
      <SyncStatus onSyncClick={handleManualSync} />

      {/* Sync Settings */}
      <div className="bg-slate-800/60 rounded-lg border border-slate-700 p-6">
        <h2 className="text-xl font-semibold mb-4">Sync Settings</h2>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg">
            <div>
              <p className="font-medium">Auto Sync</p>
              <p className="text-sm text-gray-400">
                Automatically sync data every hour
              </p>
            </div>
            <button className="relative w-12 h-6 rounded-full bg-green-600">
              <div className="absolute top-1 right-1 w-4 h-4 bg-white rounded-full"></div>
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg">
            <div>
              <p className="font-medium">Sync on Login</p>
              <p className="text-sm text-gray-400">
                Sync immediately after signing in
              </p>
            </div>
            <button className="relative w-12 h-6 rounded-full bg-green-600">
              <div className="absolute top-1 right-1 w-4 h-4 bg-white rounded-full"></div>
            </button>
          </div>
        </div>
      </div>

      {/* Dashboard Link */}
      <div className="bg-linear-to-br from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-2">Web Dashboard</h2>
        <p className="text-gray-300 mb-4">
          View detailed analytics and reports on the web dashboard
        </p>
        <a
          href="https://dodily-nextjs.vercel.app/extension/report"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
        >
          <span>Open Web Dashboard</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>
    </div>
  );
}