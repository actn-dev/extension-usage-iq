import React, { useState, useEffect } from 'react';
import { toast } from '../../utils/toast';
import '@pages/options/Options.css';
import { getTodayStats, getWeeklyStats, formatTime, formatTimeDetailed, calculateProductivityScore } from '../../utils/analytics';
import { getDailySummaries, getStorageInfo, getTodayActivity, clearAllData } from '../../utils/storage';
import type { DailySummary, BlockConfig, DomainActivity } from '../../types';
import { getBlockConfig } from '../../utils/blockStorage';
import { getBlockConfigSync } from '../../utils/blockConfigSync';
import { WeekTab } from '@src/components/option/weekly';
import { HistoryTab } from '@src/components/option/history';
import { SettingsTab } from '@src/components/option/settings';
import { AccountTab } from '@src/components/option/account';
import { SessionCard } from '@src/components/option/SessionCard';
import { SessionsTab } from '@src/components/option/sessions';

interface Tab {
  id: string;
  label: string;
}

const tabs: Tab[] = [
  { id: 'today', label: 'Today' },
  { id: 'sessions', label: 'Sessions' },
  { id: 'week', label: 'This Week' },
  { id: 'history', label: 'History' },
  { id: 'settings', label: 'Settings' },
  { id: 'account', label: 'Account' },
];

export default function Options() {
  const [activeTab, setActiveTab] = useState('today');
  const [todayStats, setTodayStats] = useState<any>(null);
  const [weeklyStats, setWeeklyStats] = useState<any>(null);
  const [historicalData, setHistoricalData] = useState<Record<string, DailySummary>>({});
  const [storageInfo, setStorageInfo] = useState<{ bytesInUse: number; quota: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [today, weekly, historical, storage] = await Promise.all([
        getTodayStats(),
        getWeeklyStats(),
        getDailySummaries(),
        getStorageInfo(),
      ]);

      setTodayStats(today);
      setWeeklyStats(weekly);
      setHistoricalData(historical);
      setStorageInfo(storage);
      setLoading(false);
    } catch (error) {
      console.error('Error loading data:', error);
      setLoading(false);
    }
  };

  const exportData = async () => {
    try {
      const data = {
        today: await getTodayActivity(),
        summaries: await getDailySummaries(),
        exportDate: new Date().toISOString(),
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `usageiq-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting data:', error);
    }
  };

  const clearData = async () => {
    if (confirm('⚠️ This will delete ALL tracking data and cannot be undone. Continue?')) {
      try {
        await clearAllData();
        await loadData();
        toast.success('All data cleared successfully');
      } catch (error) {
        console.error('Error clearing data:', error);
        toast.error('Failed to clear data');
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-900 to-slate-800 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading your activity data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 to-slate-800 text-white">
      {/* Header */}
      <header className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-linear-to-r from-blue-400 to-purple-500">
            UsageIQ Dashboard
          </h1>
          <p className="text-sm text-gray-400 mt-1">Analyze your browsing patterns and productivity</p>
        </div>
      </header>

      {/* <Login /> */}
      {/* Tabs */}
      <div className="bg-slate-800/30 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3 font-medium transition-all ${activeTab === tab.id
                    ? 'text-blue-400 border-b-2 border-blue-400'
                    : 'text-gray-400 hover:text-gray-300'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'today' && <TodayTab stats={todayStats} />}
        {activeTab === 'sessions' && <SessionsTab stats={todayStats} />}
        {activeTab === 'week' && <WeekTab stats={weeklyStats} />}
        {activeTab === 'history' && <HistoryTab data={historicalData} />}
        {activeTab === 'settings' && <SettingsTab storageInfo={storageInfo} onExport={exportData} onClear={clearData} />}
        {activeTab === 'account' && <AccountTab />}
      </div>
    </div>
  );
}

function TodayTab({ stats }: { stats: any }) {
  if (!stats) return null;

  const productivityScore = calculateProductivityScore(
    Object.values(stats.topDomains.map((d: any) => ({
      domain: d.domain,
      totalTime: d.time,
      visitCount: 1,
      lastVisit: new Date().toISOString(),
      date: new Date().toISOString().split('T')[0],
    })))
  );

  return (
    <div className="space-y-6">
      {/* Session Info & Verification */}
      {stats.currentSession && (
        <div className="bg-linear-to-r from-indigo-600 to-purple-600 rounded-lg p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Current Browser Session</h3>
            <span className="text-xs bg-white/20 px-3 py-1 rounded-full">
              {stats.currentSession.sessionId.slice(0, 8)}...
            </span>
          </div>

          <div className="grid grid-cols-4 gap-4 mb-4">
            <div>
              <div className="text-xs text-indigo-200">Duration</div>
              <div className="text-2xl font-bold text-white">{formatTime(stats.currentSession.duration)}</div>
            </div>
            <div>
              <div className="text-xs text-indigo-200">Focused</div>
              <div className="text-2xl font-bold text-green-300">{formatTime(stats.currentSession.focusedTime)}</div>
            </div>
            <div>
              <div className="text-xs text-indigo-200">Unfocused</div>
              <div className="text-2xl font-bold text-yellow-300">{formatTime(stats.currentSession.unfocusedTime)}</div>
            </div>
            <div>
              <div className="text-xs text-indigo-200">Idle</div>
              <div className="text-2xl font-bold text-gray-300">{formatTime(stats.currentSession.idleTime)}</div>
            </div>
          </div>

          {/* Verification */}
          <div className="bg-white/10 rounded p-3">
            <div className="flex items-center gap-2 text-sm">
              <span>{stats.verificationCheck.message}</span>
              {Math.abs(stats.verificationCheck.foregroundSumVsFocused) > 0 && (
                <span className="text-xs text-gray-300">
                  (Σforeground - focused = {stats.verificationCheck.foregroundSumVsFocused}s)
                </span>
              )}
            </div>
          </div>

          {/* Session Domains */}
          <div className="mt-4 bg-white/5 rounded p-4">
            <h4 className="text-sm font-semibold text-white mb-3">
              Domains Used This Session
              {stats.currentSession.domains.length > 0 && (
                <span className="ml-2 text-xs text-gray-400">({stats.currentSession.domains.length})</span>
              )}
            </h4>
            <div className="flex items-center gap-4 mb-2 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <span className="text-green-300">●</span> Active time
              </span>
              <span className="flex items-center gap-1">
                <span className="text-blue-300">📂</span> Total open time
              </span>
            </div>
            {stats.currentSession.domains.length === 0 ? (
              <p className="text-sm text-gray-400">No domains visited yet in this session</p>
            ) : (
              <>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {stats.currentSession.domains.map((domain: any) => (
                    <div key={domain.domain} className="flex items-center justify-between text-sm bg-white/5 rounded px-3 py-2">
                      <span className="text-white truncate flex-1">{domain.domain}</span>
                      <div className="flex items-center gap-3">
                        {domain.audibleTime > 0 && (
                          <span className="text-pink-300 text-xs">🔊 {formatTime(domain.audibleTime)}</span>
                        )}
                        <span className="text-green-300 font-medium" title="Active time">{formatTime(domain.foregroundTime)}</span>
                        <span className="text-blue-300 text-xs" title="Total open time">📂 {formatTime(domain.totalOpenTime)}</span>
                        <span className="text-xs text-gray-400">({domain.visitCount} visits)</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-white/10 flex justify-between text-xs text-gray-300">
                  <span>{stats.currentSession.domains.length} domains</span>
                  <span>Total: {formatTime(stats.currentSession.domains.reduce((sum: number, d: any) => sum + d.foregroundTime, 0))}</span>
                </div>
              </>
            )}
          </div>

          {/* Currently Open Tabs */}
          {stats.currentSession.openTabs && stats.currentSession.openTabs.length > 0 && (
            <div className="mt-4 bg-white/5 rounded p-4">
              <h4 className="text-sm font-semibold text-white mb-3">
                Currently Open Tabs
                <span className="ml-2 text-xs text-gray-400">({stats.currentSession.openTabs.length})</span>
              </h4>
              <div className="flex items-center gap-4 mb-2 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <span className="text-green-300">●</span> Active time
                </span>
                <span className="flex items-center gap-1">
                  <span className="text-blue-300">⏱️</span> Open for
                </span>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {stats.currentSession.openTabs.map((tab: any) => (
                  <div
                    key={tab.tabId}
                    className={`flex items-center justify-between text-sm rounded px-3 py-2 ${tab.active ? 'bg-green-500/20 border border-green-500/30' : 'bg-white/5'
                      }`}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {tab.active && <span className="text-green-400 text-xs">●</span>}
                      {tab.audible && <span className="text-pink-400">🔊</span>}
                      <span className="text-white truncate">{tab.title || tab.domain}</span>
                    </div>
                    <div className="flex items-center gap-3 ml-2">
                      {tab.foregroundTime > 0 && (
                        <span className="text-xs text-green-300" title="Active time">{formatTime(tab.foregroundTime)}</span>
                      )}
                      <span className="text-xs text-blue-300" title="Open for">{formatTime(tab.currentOpenTime)}</span>
                      <span className="text-xs text-gray-400">{tab.domain}</span>
                      {tab.active && (
                        <span className="text-xs bg-green-500/30 text-green-300 px-2 py-0.5 rounded">Active</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-linear-to-br from-blue-600 to-blue-700 rounded-lg p-6 shadow-xl">
          <div className="text-sm text-blue-200 mb-2">Chrome Focused</div>
          <div className="text-3xl font-bold">{formatTime(stats.chromeFocusedTime)}</div>
          <div className="text-xs text-blue-200 mt-2">Window was active</div>
        </div>

        <div className="bg-linear-to-br from-yellow-600 to-yellow-700 rounded-lg p-6 shadow-xl">
          <div className="text-sm text-yellow-200 mb-2">Chrome Unfocused</div>
          <div className="text-3xl font-bold">{formatTime(stats.chromeUnfocusedTime)}</div>
          <div className="text-xs text-yellow-200 mt-2">Open but in other app</div>
        </div>

        <div className="bg-linear-to-br from-green-600 to-green-700 rounded-lg p-6 shadow-xl">
          <div className="text-sm text-green-200 mb-2">Foreground Time</div>
          <div className="text-3xl font-bold">{formatTime(stats.foregroundTime)}</div>
          <div className="text-xs text-green-200 mt-2">
            Active viewing
          </div>
        </div>

        <div className="bg-linear-to-br from-pink-600 to-pink-700 rounded-lg p-6 shadow-xl">
          <div className="text-sm text-pink-200 mb-2">Audible Time</div>
          <div className="text-3xl font-bold">{formatTime(stats.audibleTime)}</div>
          <div className="text-xs text-pink-200 mt-2">
            Audio/video playing
          </div>
        </div>

        <div className="bg-linear-to-br from-orange-600 to-orange-700 rounded-lg p-6 shadow-xl">
          <div className="text-sm text-orange-200 mb-2">Sites Visited</div>
          <div className="text-3xl font-bold">{stats.domainCount}</div>
          <div className="text-xs text-orange-200 mt-2">{stats.visitCount} total visits</div>
        </div>
      </div>

      {/* All Domains Today Table */}
      <div className="bg-slate-800/60 rounded-lg border border-slate-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700">
          <h2 className="text-xl font-semibold">All Domains Today</h2>
          <p className="text-sm text-gray-400 mt-1">Combined data from all sessions today</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-700/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">#</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Domain</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Foreground</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Audible</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Total</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">% of Focused</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {stats.topDomains.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No browsing activity recorded yet
                  </td>
                </tr>
              ) : (
                stats.topDomains.map((domain: any, index: number) => (
                  <tr key={domain.domain} className="hover:bg-slate-700/30">
                    <td className="px-6 py-4 text-gray-400">{index + 1}</td>
                    <td className="px-6 py-4 font-medium">{domain.domain}</td>
                    <td className="px-6 py-4 text-green-400">{formatTime(domain.foregroundTime)}</td>
                    <td className="px-6 py-4 text-pink-400">
                      {domain.audibleTime > 0 ? `${formatTime(domain.audibleTime)} 🔊` : '-'}
                    </td>
                    <td className="px-6 py-4">{formatTime(domain.time)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-slate-700 rounded-full h-2">
                          <div
                            className="bg-green-500 h-2 rounded-full"
                            style={{ width: `${(domain.foregroundTime / stats.chromeFocusedTime) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400">
                          {((domain.foregroundTime / stats.chromeFocusedTime) * 100).toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}






// Helper component for time limit display - REMOVED, no longer needed in extension


