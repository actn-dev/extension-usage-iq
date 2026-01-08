import React, { useState, useEffect } from 'react';
import '@pages/options/Options.css';
import { getTodayStats, getWeeklyStats, formatTime, formatTimeDetailed, calculateProductivityScore } from '../../utils/analytics';
import { getDailySummaries, getStorageInfo, getTodayActivity } from '../../utils/storage';
import type { DailySummary } from '../../types';

interface Tab {
  id: string;
  label: string;
}

const tabs: Tab[] = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This Week' },
  { id: 'history', label: 'History' },
  { id: 'settings', label: 'Settings' },
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
          <div className="text-sm text-green-200 mb-2">Active Time</div>
          <div className="text-3xl font-bold">{formatTime(stats.activeTime)}</div>
          <div className="text-xs text-green-200 mt-2">
            {stats.totalTime > 0 ? Math.round((stats.activeTime / stats.totalTime) * 100) : 0}% active
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-lg p-6 shadow-xl">
          <div className="text-sm text-purple-200 mb-2">Sites Visited</div>
          <div className="text-3xl font-bold">{stats.domainCount}</div>
          <div className="text-xs text-purple-200 mt-2">{stats.visitCount} total visits</div>
        </div>

        <div className="bg-gradient-to-br from-orange-600 to-orange-700 rounded-lg p-6 shadow-xl">
          <div className="text-sm text-orange-200 mb-2">Productivity Score</div>
          <div className="text-3xl font-bold">{productivityScore}</div>
          <div className="text-xs text-orange-200 mt-2">out of 100</div>
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Time Spent</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Percentage</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Distribution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {stats.topDomains.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No browsing activity recorded yet
                  </td>
                </tr>
              ) : (
                stats.topDomains.map((domain: any, index: number) => (
                  <tr key={domain.domain} className="hover:bg-slate-700/30">
                    <td className="px-6 py-4 text-gray-400">{index + 1}</td>
                    <td className="px-6 py-4 font-medium">{domain.domain}</td>
                    <td className="px-6 py-4">{formatTime(domain.time)}</td>
                    <td className="px-6 py-4 text-blue-400">{domain.percentage.toFixed(1)}%</td>
                    <td className="px-6 py-4">
                      <div className="w-full bg-slate-700 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full"
                          style={{ width: `${Math.min(domain.percentage, 100)}%` }}
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
  return (
    <div className="space-y-6">
      {/* Storage Info */}
      <div className="bg-slate-800/60 rounded-lg border border-slate-700 p-6">
        <h2 className="text-xl font-semibold mb-4">Storage Information</h2>
        {storageInfo && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Storage Used:</span>
              <span className="font-medium">{(storageInfo.bytesInUse / 1024).toFixed(2)} KB</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Storage Quota:</span>
              <span className="font-medium">{(storageInfo.quota / 1024 / 1024).toFixed(2)} MB</span>
            </div>
            <div className="mt-4">
              <div className="w-full bg-slate-700 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full"
                  style={{ width: `${(storageInfo.bytesInUse / storageInfo.quota) * 100}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-2">
                {((storageInfo.bytesInUse / storageInfo.quota) * 100).toFixed(2)}% used
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Export Data */}
      <div className="bg-slate-800/60 rounded-lg border border-slate-700 p-6">
        <h2 className="text-xl font-semibold mb-4">Export Data</h2>
        <p className="text-gray-400 mb-4">Download all your activity data in JSON format</p>
        <button
          onClick={onExport}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
        >
          Export to JSON
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
