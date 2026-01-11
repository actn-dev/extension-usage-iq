import React, { useState, useEffect } from 'react';
import { toast } from '../../utils/toast';
import '@pages/options/Options.css';
import { getTodayStats, getWeeklyStats, formatTime, formatTimeDetailed, calculateProductivityScore } from '../../utils/analytics';
import { getDailySummaries, getStorageInfo, getTodayActivity } from '../../utils/storage';
import type { DailySummary, BlockConfig, DomainActivity } from '../../types';
import { Login } from '@src/components/login';
import { getBlockConfig } from '../../utils/blockStorage';
import { getBlockConfigSync } from '../../utils/blockConfigSync';
import { WeekTab } from '@src/components/option/weekly';
import { HistoryTab } from '@src/components/option/history';
import { SettingsTab } from '@src/components/option/settings';
import { AccountTab } from '@src/components/option/account';

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






// Helper component for time limit display - REMOVED, no longer needed in extension


