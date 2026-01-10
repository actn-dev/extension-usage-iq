import React, { useState, useEffect } from 'react';
import { toast } from '../../utils/toast';
import '@pages/options/Options.css';
import { getTodayStats, getWeeklyStats, formatTime, formatTimeDetailed, calculateProductivityScore } from '../../utils/analytics';
import { getDailySummaries, getStorageInfo, getTodayActivity } from '../../utils/storage';
import type { DailySummary, BlockConfig, DomainActivity } from '../../types';
import { Login } from '@src/components/login';
import { getBlockConfig } from '../../utils/blockStorage';
import { getBlockConfigSync } from '../../utils/blockConfigSync';

interface Tab {
  id: string;
  label: string;
}

const tabs: Tab[] = [
  { id: 'today', label: 'Today' },
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading your activity data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white">
      {/* Header */}
      <header className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
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
                className={`px-6 py-3 font-medium transition-all ${
                  activeTab === tab.id
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
        {activeTab === 'week' && <WeekTab stats={weeklyStats} />}
        {activeTab === 'history' && <HistoryTab data={historicalData} />}
        {activeTab === 'settings' && <SettingsTab storageInfo={storageInfo} onExport={exportData} />}
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
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg p-6 shadow-xl">
          <div className="text-sm text-blue-200 mb-2">Total Time</div>
          <div className="text-3xl font-bold">{formatTime(stats.totalTime)}</div>
          <div className="text-xs text-blue-200 mt-2">{formatTimeDetailed(stats.totalTime)}</div>
        </div>

        <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-lg p-6 shadow-xl">
          <div className="text-sm text-green-200 mb-2">Foreground Time</div>
          <div className="text-3xl font-bold">{formatTime(stats.foregroundTime)}</div>
          <div className="text-xs text-green-200 mt-2">
            {stats.totalTime > 0 ? Math.round((stats.foregroundTime / stats.totalTime) * 100) : 0}% active viewing
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-lg p-6 shadow-xl">
          <div className="text-sm text-purple-200 mb-2">Background Time</div>
          <div className="text-3xl font-bold">{formatTime(stats.backgroundTime)}</div>
          <div className="text-xs text-purple-200 mt-2">
            {stats.totalTime > 0 ? Math.round((stats.backgroundTime / stats.totalTime) * 100) : 0}% in background
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-600 to-orange-700 rounded-lg p-6 shadow-xl">
          <div className="text-sm text-orange-200 mb-2">Sites Visited</div>
          <div className="text-3xl font-bold">{stats.domainCount}</div>
          <div className="text-xs text-orange-200 mt-2">{stats.visitCount} total visits</div>
        </div>
      </div>

      {/* Top Domains Table */}
      <div className="bg-slate-800/60 rounded-lg border border-slate-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700">
          <h2 className="text-xl font-semibold">Top Websites Today</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-700/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">#</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Domain</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Total Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Foreground</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Background</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Distribution</th>
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
                    <td className="px-6 py-4">{formatTime(domain.time)}</td>
                    <td className="px-6 py-4 text-green-400">{formatTime(domain.foregroundTime)}</td>
                    <td className="px-6 py-4 text-purple-400">{formatTime(domain.backgroundTime)}</td>
                    <td className="px-6 py-4">
                      <div className="w-full bg-slate-700 rounded-full h-2 flex overflow-hidden">
                        <div
                          className="bg-green-500 h-2"
                          style={{ width: `${domain.foregroundPercentage}%` }}
                          title={`Foreground: ${domain.foregroundPercentage.toFixed(1)}%`}
                        />
                        <div
                          className="bg-purple-500 h-2"
                          style={{ width: `${100 - domain.foregroundPercentage}%` }}
                          title={`Background: ${(100 - domain.foregroundPercentage).toFixed(1)}%`}
                        />
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

function WeekTab({ stats }: { stats: any }) {
  if (!stats) return null;

  return (
    <div className="space-y-6">
      {/* Weekly Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg p-6 shadow-xl">
          <div className="text-sm text-blue-200 mb-2">Total This Week</div>
          <div className="text-3xl font-bold">{formatTime(stats.totalTime)}</div>
        </div>

        <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-lg p-6 shadow-xl">
          <div className="text-sm text-green-200 mb-2">Daily Average</div>
          <div className="text-3xl font-bold">{formatTime(Math.round(stats.averageDailyTime))}</div>
        </div>

        <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-lg p-6 shadow-xl">
          <div className="text-sm text-purple-200 mb-2">Top Sites</div>
          <div className="text-3xl font-bold">{stats.topDomains.length}</div>
        </div>
      </div>

      {/* Daily Breakdown */}
      <div className="bg-slate-800/60 rounded-lg border border-slate-700 p-6">
        <h2 className="text-xl font-semibold mb-6">Daily Breakdown (Last 7 Days)</h2>
        <div className="space-y-3">
          {stats.dailyBreakdown.map((day: any) => (
            <div key={day.date} className="flex items-center gap-4">
              <div className="w-32 text-sm text-gray-400">
                {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </div>
              <div className="flex-1">
                <div className="w-full bg-slate-700 rounded-full h-8 relative overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-purple-500 h-8 rounded-full flex items-center px-3"
                    style={{ width: `${Math.max((day.time / stats.totalTime) * 100, 5)}%` }}
                  >
                    <span className="text-xs font-medium text-white">
                      {formatTime(day.time)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Domains This Week */}
      <div className="bg-slate-800/60 rounded-lg border border-slate-700 p-6">
        <h2 className="text-xl font-semibold mb-4">Top Websites This Week</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stats.topDomains.slice(0, 10).map((domain: any, index: number) => (
            <div key={domain.domain} className="flex items-center gap-3 bg-slate-700/30 rounded-lg p-4">
              <div className="text-2xl font-bold text-gray-500 w-8">{index + 1}</div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{domain.domain}</div>
                <div className="text-sm text-gray-400">{formatTime(domain.time)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function HistoryTab({ data }: { data: Record<string, DailySummary> }) {
  const sortedDates = Object.keys(data).sort().reverse();

  return (
    <div className="space-y-6">
      <div className="bg-slate-800/60 rounded-lg border border-slate-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700">
          <h2 className="text-xl font-semibold">Historical Data</h2>
          <p className="text-sm text-gray-400 mt-1">{sortedDates.length} days of data available</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-700/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Total Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Active Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Sessions</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Top Site</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {sortedDates.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No historical data available
                  </td>
                </tr>
              ) : (
                sortedDates.map(date => {
                  const summary = data[date];
                  return (
                    <tr key={date} className="hover:bg-slate-700/30">
                      <td className="px-6 py-4">
                        {new Date(date).toLocaleDateString('en-US', { 
                          weekday: 'short', 
                          year: 'numeric', 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </td>
                      <td className="px-6 py-4 font-medium">{formatTime(summary.totalChromeTime)}</td>
                      <td className="px-6 py-4 text-green-400">{formatTime(summary.activeTime)}</td>
                      <td className="px-6 py-4">{summary.sessionCount}</td>
                      <td className="px-6 py-4 text-blue-400">
                        {summary.topDomains[0]?.domain || 'N/A'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SettingsTab({ storageInfo, onExport }: { storageInfo: any; onExport: () => void }) {
  const [blockConfig, setBlockConfig] = useState<BlockConfig | null>(null);
  const [todayActivity, setTodayActivity] = useState<Record<string, DomainActivity>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadBlockConfig();
    loadTodayActivity();
  }, []);

  const loadBlockConfig = async () => {
    const config = await getBlockConfig();
    setBlockConfig(config);
  };

  const loadTodayActivity = async () => {
    const activity = await getTodayActivity();
    setTodayActivity(activity.domains);
  };

  const handleRefreshConfig = async () => {
    setIsRefreshing(true);
    try {
      const blockConfigSync = getBlockConfigSync();
      await blockConfigSync.fetchConfig();
      await loadBlockConfig();
      toast.success('Configuration refreshed', {
        description: 'Latest blocking rules fetched from server',
      });
    } catch (error) {
      console.error('Failed to refresh config:', error);
      toast.error('Failed to refresh', {
        description: 'Could not fetch latest rules from server',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!blockConfig) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-400">Loading settings...</p>
      </div>
    );
  }

  const blockedDomainsCount = blockConfig.blockedDomains?.length || 0;
  const schedulesCount = blockConfig.schedules?.length || 0;
  const timeLimitsCount = Object.keys(blockConfig.timeLimits || {}).length;

  return (
    <div className="space-y-6">
      {/* Blocking Status - READ-ONLY */}
      <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-lg p-6">
        <div className="text-center">
          <div className="mb-4">
            <span className="text-6xl">🛡️</span>
          </div>
          <h2 className="text-2xl font-bold mb-2">
            Website Blocking Managed Centrally
          </h2>
          <p className="text-gray-400 mb-4 max-w-2xl mx-auto">
            All website blocking rules are now managed from your admin dashboard.
            You cannot add, edit, or remove blocking rules from this extension.
          </p>
          
          {/* Current Status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 max-w-xl mx-auto">
            <div className="bg-slate-800/60 rounded-lg p-4">
              <div className="text-3xl font-bold text-blue-400">{blockedDomainsCount}</div>
              <div className="text-sm text-gray-400">Blocked Domains</div>
            </div>
            <div className="bg-slate-800/60 rounded-lg p-4">
              <div className="text-3xl font-bold text-purple-400">{timeLimitsCount}</div>
              <div className="text-sm text-gray-400">Time Limits</div>
            </div>
            <div className="bg-slate-800/60 rounded-lg p-4">
              <div className="text-3xl font-bold text-green-400">{schedulesCount}</div>
              <div className="text-sm text-gray-400">Schedules</div>
            </div>
          </div>

          <div className="flex gap-3 justify-center">
            <a
              href="http://localhost:3000/extension/blocking"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-medium transition-colors"
            >
              Manage Blocking Rules
            </a>
            <button
              onClick={handleRefreshConfig}
              disabled={isRefreshing}
              className="inline-block bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-8 py-3 rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              {isRefreshing ? (
                <>
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Refreshing...
                </>
              ) : (
                <>
                  🔄 Refresh from Server
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Active Blocked Domains List - READ-ONLY */}
      {blockedDomainsCount > 0 && (
        <div className="bg-slate-800/60 rounded-lg border border-slate-700 p-6">
          <h2 className="text-xl font-semibold mb-4">Currently Blocked Domains</h2>
          <p className="text-gray-400 text-sm mb-4">
            These domains are being blocked by your admin. To modify this list, use the admin dashboard.
          </p>
          
          <div className="space-y-2">
            {blockConfig.blockedDomains.map(domain => {
              const hasTimeLimit = blockConfig.timeLimits[domain] !== undefined;
              const hasSchedule = blockConfig.schedules.some(s => s.domains.includes(domain));
              const isPermanentBlock = !hasTimeLimit && !hasSchedule;
              
              // Get today's usage for this domain
              const domainUsage = todayActivity[domain];
              const totalMinutes = domainUsage ? Math.floor(domainUsage.totalTime / 60) : 0;
              const foregroundMinutes = domainUsage ? Math.floor(domainUsage.foregroundTime / 60) : 0;
              const timeLimit = blockConfig.timeLimits[domain];
              const usagePercentage = timeLimit ? (totalMinutes / timeLimit) * 100 : 0;
              
              return (
                <div key={domain} className="bg-slate-700/50 rounded-lg px-4 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 flex-1">
                      <span className="font-mono text-sm font-medium">{domain}</span>
                      <div className="flex gap-1 flex-wrap">
                        {hasTimeLimit && (
                          <span className="text-xs bg-blue-600/30 text-blue-400 px-2 py-0.5 rounded border border-blue-500/30">
                            ⏱️ Limit: {blockConfig.timeLimits[domain]} min/day
                          </span>
                        )}
                        {hasSchedule && (
                          <span className="text-xs bg-purple-600/30 text-purple-400 px-2 py-0.5 rounded border border-purple-500/30">
                            📅 Scheduled
                          </span>
                        )}
                        {isPermanentBlock && (
                          <span className="text-xs bg-red-600/30 text-red-400 px-2 py-0.5 rounded border border-red-500/30">
                            🚫 Permanent
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Time Usage Info */}
                  {domainUsage ? (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>Today's usage:</span>
                        <span className="font-medium">
                          {foregroundMinutes}m active / {totalMinutes}m total
                          {timeLimit && (
                            <span className={`ml-2 font-semibold ${
                              usagePercentage >= 100 ? 'text-red-400' : 
                              usagePercentage >= 80 ? 'text-yellow-400' : 
                              'text-green-400'
                            }`}>
                              ({Math.round(usagePercentage)}%)
                            </span>
                          )}
                        </span>
                      </div>
                      {timeLimit && (
                        <div className="w-full bg-slate-600 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              usagePercentage >= 100 ? 'bg-gradient-to-r from-red-500 to-red-600' :
                              usagePercentage >= 80 ? 'bg-gradient-to-r from-yellow-500 to-orange-500' :
                              'bg-gradient-to-r from-blue-500 to-purple-500'
                            }`}
                            style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500 italic">
                      Not visited today
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Active Schedules List - READ-ONLY */}
      {schedulesCount > 0 && (
        <div className="bg-slate-800/60 rounded-lg border border-slate-700 p-6">
          <h2 className="text-xl font-semibold mb-4">Active Schedules</h2>
          <p className="text-gray-400 text-sm mb-4">
            These blocking schedules are configured by your admin.
          </p>
          
          <div className="space-y-3">
            {blockConfig.schedules.map(schedule => (
              <div key={schedule.id} className="bg-slate-700/50 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-medium">{schedule.name}</h4>
                    <p className="text-sm text-gray-400">
                      {schedule.startTime} - {schedule.endTime}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded text-xs font-medium ${
                    schedule.enabled
                      ? 'bg-green-600/30 text-green-400'
                      : 'bg-slate-600/30 text-gray-400'
                  }`}>
                    {schedule.enabled ? 'Active' : 'Disabled'}
                  </span>
                </div>
                <div className="flex gap-2 flex-wrap mb-2">
                  {schedule.daysOfWeek.map(day => (
                    <span key={day} className="px-2 py-1 bg-blue-600/30 text-blue-400 rounded text-xs">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day]}
                    </span>
                  ))}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {schedule.domains.map(domain => (
                    <span key={domain} className="px-2 py-1 bg-slate-600 text-gray-300 rounded text-xs font-mono">
                      {domain}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Storage Info */}
      {storageInfo && (
        <div className="bg-slate-800/60 rounded-lg border border-slate-700 p-6">
          <h2 className="text-xl font-semibold mb-4">Storage Usage</h2>
          <p className="text-gray-400 text-sm mb-2">
            {(storageInfo.bytesInUse / 1024).toFixed(2)} KB used
          </p>
          <div className="w-full bg-slate-600 rounded-full h-2">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
              style={{ width: `${(storageInfo.bytesInUse / storageInfo.quota) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Export Data */}
      <div className="bg-slate-800/60 rounded-lg border border-slate-700 p-6">
        <h2 className="text-xl font-semibold mb-4">Export Data</h2>
        <p className="text-gray-400 mb-4 text-sm">
          Download your browsing activity data as JSON for backup or analysis.
        </p>
        <button
          onClick={onExport}
          className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
        >
          Export Data
        </button>
      </div>

      {/* About */}
      <div className="bg-slate-800/60 rounded-lg border border-slate-700 p-6">
        <h2 className="text-xl font-semibold mb-4">About UsageIQ</h2>
        <p className="text-gray-400 mb-2">Version: 1.0.0</p>
        <p className="text-gray-400 text-sm">
          UsageIQ monitors your browser activity to help you understand your browsing patterns and improve productivity.
        </p>
      </div>
    </div>
  );
}

// Helper component for time limit display - REMOVED, no longer needed in extension

// Account Tab Component
function AccountTab() {
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

  useEffect(() => {
    loadSyncStatus();
    const interval = setInterval(loadSyncStatus, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, []);

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

  return (
    <div className="space-y-6">
      {/* Account Section */}
      <div className="bg-slate-800/60 rounded-lg border border-slate-700 p-6">
        <h2 className="text-xl font-semibold mb-4">Account & Authentication</h2>
        <p className="text-gray-400 mb-6">
          Sign in with your Google account to sync your browsing activity across devices and access the web dashboard.
        </p>
        <Login />
      </div>

      {/* Sync Status Section */}
      <div className="bg-slate-800/60 rounded-lg border border-slate-700 p-6">
        <h2 className="text-xl font-semibold mb-4">Data Synchronization</h2>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg">
            <div className="flex-1">
              <p className="font-medium">Last Sync</p>
              <p className="text-sm text-gray-400">
                {formatLastSync(syncStatus.lastSync)}
              </p>
              {syncStatus.pendingRecords > 0 && (
                <p className="text-xs text-blue-400 mt-1">
                  {syncStatus.pendingRecords} records pending
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {syncStatus.syncing && (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
              )}
              <span className={`px-3 py-1 rounded text-xs font-medium ${
                syncStatus.error 
                  ? 'bg-red-600/20 text-red-400'
                  : syncStatus.syncing
                  ? 'bg-blue-600/20 text-blue-400'
                  : 'bg-green-600/20 text-green-400'
              }`}>
                {syncStatus.error ? 'Failed' : syncStatus.syncing ? 'Syncing...' : 'Synced'}
              </span>
            </div>
          </div>

          {syncStatus.error && (
            <div className="p-4 bg-red-600/10 border border-red-600/30 rounded-lg">
              <p className="text-sm text-red-400">
                <span className="font-medium">Sync Error:</span> {syncStatus.error}
              </p>
            </div>
          )}

          <button
            onClick={handleManualSync}
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
              </>
            )}
          </button>

          <p className="text-xs text-gray-400 text-center">
            Automatic sync runs every hour when signed in
          </p>
        </div>
      </div>

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
      <div className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-lg p-6">
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
