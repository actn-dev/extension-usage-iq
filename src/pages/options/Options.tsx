import React, { useState, useEffect } from 'react';
import '@pages/options/Options.css';
import { getTodayStats, getWeeklyStats, formatTime, formatTimeDetailed, calculateProductivityScore } from '../../utils/analytics';
import { getDailySummaries, getStorageInfo, getTodayActivity } from '../../utils/storage';
import type { DailySummary, BlockConfig, BlockSchedule } from '../../types';
import { Login } from '@src/components/login';
import { getBlockConfig, addBlockedDomain, removeBlockedDomain, setDomainTimeLimit, removeDomainTimeLimit, addBlockSchedule, updateBlockSchedule, removeBlockSchedule, getDomainMinutesUsedToday } from '../../utils/blockStorage';
import { updateBlockingRules } from '../../utils/blockManager';

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
  const [newDomain, setNewDomain] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<string>('');
  const [timeLimitMinutes, setTimeLimitMinutes] = useState<number>(60);
  const [scheduleForm, setScheduleForm] = useState<Partial<BlockSchedule>>({
    startTime: '09:00',
    endTime: '17:00',
    daysOfWeek: [],
    domains: [],
  });
  const [overrideEnabled, setOverrideEnabled] = useState(true);
  const [overrideMaxDuration, setOverrideMaxDuration] = useState(30);

  useEffect(() => {
    loadBlockConfig();
  }, []);

  const loadBlockConfig = async () => {
    const config = await getBlockConfig();
    setBlockConfig(config);
    setOverrideEnabled(config.overrideEnabled);
    setOverrideMaxDuration(config.overrideMaxDuration);
  };

  const handleAddBlockedDomain = async () => {
    if (!newDomain.trim()) return;
    
    // Clean and validate domain
    let domain = newDomain.trim().toLowerCase();
    domain = domain.replace(/^(https?:\/\/)?(www\.)?/, '');
    domain = domain.split('/')[0];
    
    if (!domain) return;
    
    await addBlockedDomain(domain);
    await updateBlockingRules();
    setNewDomain('');
    loadBlockConfig();
  };

  const handleRemoveBlockedDomain = async (domain: string) => {
    await removeBlockedDomain(domain);
    await updateBlockingRules();
    loadBlockConfig();
  };

  const handleSetTimeLimit = async () => {
    if (!selectedDomain || timeLimitMinutes <= 0) return;
    
    await setDomainTimeLimit(selectedDomain, timeLimitMinutes);
    await updateBlockingRules();
    loadBlockConfig();
    setSelectedDomain('');
    setTimeLimitMinutes(60);
  };

  const handleRemoveTimeLimit = async (domain: string) => {
    await removeDomainTimeLimit(domain);
    await updateBlockingRules();
    loadBlockConfig();
  };

  const handleAddSchedule = async () => {
    if (!scheduleForm.startTime || !scheduleForm.endTime || 
        !scheduleForm.daysOfWeek?.length || !scheduleForm.domains?.length) {
      return;
    }

    const schedule: BlockSchedule = {
      id: Date.now().toString(),
      name: scheduleForm.name || `Schedule ${Date.now()}`,
      startTime: scheduleForm.startTime,
      endTime: scheduleForm.endTime,
      daysOfWeek: scheduleForm.daysOfWeek,
      domains: scheduleForm.domains,
      enabled: true,
    };

    await addBlockSchedule(schedule);
    await updateBlockingRules();
    loadBlockConfig();
    
    // Reset form
    setScheduleForm({
      startTime: '09:00',
      endTime: '17:00',
      daysOfWeek: [],
      domains: [],
    });
  };

  const handleToggleSchedule = async (scheduleId: string, enabled: boolean) => {
    if (!blockConfig) return;
    
    const schedule = blockConfig.schedules.find(s => s.id === scheduleId);
    if (!schedule) return;
    
    await updateBlockSchedule(schedule.id, { enabled });
    await updateBlockingRules();
    loadBlockConfig();
  };

  const handleRemoveSchedule = async (scheduleId: string) => {
    await removeBlockSchedule(scheduleId);
    await updateBlockingRules();
    loadBlockConfig();
  };

  const handleUpdateOverrideSettings = async () => {
    if (!blockConfig) return;
    
    const updatedConfig = {
      ...blockConfig,
      overrideEnabled,
      overrideMaxDuration,
    };
    
    await chrome.storage.local.set({ blockConfig: updatedConfig });
    loadBlockConfig();
  };

  const getDayName = (day: number): string => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[day];
  };

  if (!blockConfig) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-400">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Blocked Domains */}
      <div className="bg-slate-800/60 rounded-lg border border-slate-700 p-6">
        <h2 className="text-xl font-semibold mb-4">Blocked Websites</h2>
        <p className="text-gray-400 text-sm mb-4">
          These websites will be completely blocked and cannot be accessed.
        </p>
        
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddBlockedDomain()}
            placeholder="Enter domain (e.g., facebook.com)"
            className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleAddBlockedDomain}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
          >
            Add
          </button>
        </div>

        <div className="space-y-2">
          {blockConfig.blockedDomains.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">No blocked domains yet</p>
          ) : (
            blockConfig.blockedDomains.map(domain => (
              <div key={domain} className="flex items-center justify-between bg-slate-700/50 rounded-lg px-4 py-3">
                <span className="font-mono text-sm">{domain}</span>
                <button
                  onClick={() => handleRemoveBlockedDomain(domain)}
                  className="text-red-400 hover:text-red-300 text-sm font-medium transition-colors"
                >
                  Remove
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Time Limits */}
      <div className="bg-slate-800/60 rounded-lg border border-slate-700 p-6">
        <h2 className="text-xl font-semibold mb-4">Time Limits</h2>
        <p className="text-gray-400 text-sm mb-4">
          Set daily time limits for specific websites. Once the limit is reached, the site will be blocked for the rest of the day.
        </p>

        <div className="flex gap-2 mb-4">
          <select
            value={selectedDomain}
            onChange={(e) => setSelectedDomain(e.target.value)}
            className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select a domain...</option>
            {blockConfig.blockedDomains.map(domain => (
              <option key={domain} value={domain}>{domain}</option>
            ))}
          </select>
          <input
            type="number"
            value={timeLimitMinutes}
            onChange={(e) => setTimeLimitMinutes(Number(e.target.value))}
            min="1"
            placeholder="Minutes"
            className="w-32 bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleSetTimeLimit}
            disabled={!selectedDomain}
            className="bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-medium transition-colors"
          >
            Set Limit
          </button>
        </div>

        <div className="space-y-2">
          {Object.entries(blockConfig.timeLimits).length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">No time limits configured</p>
          ) : (
            Object.entries(blockConfig.timeLimits).map(([domain, minutes]) => (
              <DomainTimeLimitCard
                key={domain}
                domain={domain}
                limitMinutes={minutes}
                onRemove={handleRemoveTimeLimit}
              />
            ))
          )}
        </div>
      </div>

      {/* Schedules */}
      <div className="bg-slate-800/60 rounded-lg border border-slate-700 p-6">
        <h2 className="text-xl font-semibold mb-4">Block Schedules</h2>
        <p className="text-gray-400 text-sm mb-4">
          Block websites during specific times and days (e.g., during work hours or focus time).
        </p>

        {/* Add Schedule Form */}
        <div className="bg-slate-700/30 rounded-lg p-4 mb-4">
          <h3 className="font-medium mb-3">Add New Schedule</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Schedule Name</label>
              <input
                type="text"
                value={scheduleForm.name || ''}
                onChange={(e) => setScheduleForm({ ...scheduleForm, name: e.target.value })}
                placeholder="Focus Time"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Start Time</label>
                <input
                  type="time"
                  value={scheduleForm.startTime}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, startTime: e.target.value })}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">End Time</label>
                <input
                  type="time"
                  value={scheduleForm.endTime}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, endTime: e.target.value })}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="mb-3">
            <label className="block text-sm text-gray-400 mb-2">Days of Week</label>
            <div className="flex gap-2 flex-wrap">
              {[0, 1, 2, 3, 4, 5, 6].map(day => (
                <button
                  key={day}
                  onClick={() => {
                    const days = scheduleForm.daysOfWeek || [];
                    const newDays = days.includes(day)
                      ? days.filter(d => d !== day)
                      : [...days, day];
                    setScheduleForm({ ...scheduleForm, daysOfWeek: newDays });
                  }}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    scheduleForm.daysOfWeek?.includes(day)
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-gray-400 hover:bg-slate-600'
                  }`}
                >
                  {getDayName(day).slice(0, 3)}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-3">
            <label className="block text-sm text-gray-400 mb-2">Domains to Block</label>
            <div className="flex gap-2 flex-wrap">
              {blockConfig.blockedDomains.map(domain => (
                <button
                  key={domain}
                  onClick={() => {
                    const domains = scheduleForm.domains || [];
                    const newDomains = domains.includes(domain)
                      ? domains.filter(d => d !== domain)
                      : [...domains, domain];
                    setScheduleForm({ ...scheduleForm, domains: newDomains });
                  }}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    scheduleForm.domains?.includes(domain)
                      ? 'bg-green-600 text-white'
                      : 'bg-slate-700 text-gray-400 hover:bg-slate-600'
                  }`}
                >
                  {domain}
                </button>
              ))}
            </div>
            {blockConfig.blockedDomains.length === 0 && (
              <p className="text-gray-500 text-xs mt-2">Add blocked domains first</p>
            )}
          </div>

          <button
            onClick={handleAddSchedule}
            disabled={!scheduleForm.startTime || !scheduleForm.endTime || 
                     !scheduleForm.daysOfWeek?.length || !scheduleForm.domains?.length}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Add Schedule
          </button>
        </div>

        {/* Active Schedules */}
        <div className="space-y-2">
          {blockConfig.schedules.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">No schedules configured</p>
          ) : (
            blockConfig.schedules.map(schedule => (
              <div key={schedule.id} className="bg-slate-700/50 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-medium">{schedule.name}</h4>
                    <p className="text-sm text-gray-400">
                      {schedule.startTime} - {schedule.endTime}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleSchedule(schedule.id, !schedule.enabled)}
                      className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                        schedule.enabled
                          ? 'bg-green-600 text-white hover:bg-green-700'
                          : 'bg-slate-600 text-gray-300 hover:bg-slate-500'
                      }`}
                    >
                      {schedule.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                    <button
                      onClick={() => handleRemoveSchedule(schedule.id)}
                      className="text-red-400 hover:text-red-300 text-sm"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap mb-2">
                  {schedule.daysOfWeek.map(day => (
                    <span key={day} className="px-2 py-1 bg-blue-600/30 text-blue-400 rounded text-xs">
                      {getDayName(day)}
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
            ))
          )}
        </div>
      </div>

      {/* Override Settings */}
      <div className="bg-slate-800/60 rounded-lg border border-slate-700 p-6">
        <h2 className="text-xl font-semibold mb-4">Override Settings</h2>
        <p className="text-gray-400 text-sm mb-4">
          Allow temporary access to blocked sites with a reason. Useful for emergencies or urgent work.
        </p>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Enable Override Requests</p>
              <p className="text-sm text-gray-400">Allow requesting temporary access to blocked sites</p>
            </div>
            <button
              onClick={() => setOverrideEnabled(!overrideEnabled)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                overrideEnabled ? 'bg-green-600' : 'bg-slate-600'
              }`}
            >
              <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                overrideEnabled ? 'translate-x-6' : 'translate-x-0'
              }`} />
            </button>
          </div>

          <div>
            <label className="block font-medium mb-2">Maximum Override Duration (minutes)</label>
            <input
              type="number"
              value={overrideMaxDuration}
              onChange={(e) => setOverrideMaxDuration(Number(e.target.value))}
              min="5"
              max="480"
              disabled={!overrideEnabled}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-400 mt-1">
              Users can request temporary access for up to this duration
            </p>
          </div>

          <button
            onClick={handleUpdateOverrideSettings}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
          >
            Save Override Settings
          </button>
        </div>
      </div>

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

// Helper component for time limit display
function DomainTimeLimitCard({ domain, limitMinutes, onRemove }: { 
  domain: string; 
  limitMinutes: number; 
  onRemove: (domain: string) => void;
}) {
  const [usedMinutes, setUsedMinutes] = useState(0);
  
  useEffect(() => {
    loadUsage();
    const interval = setInterval(loadUsage, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, [domain]);

  const loadUsage = async () => {
    const minutes = await getDomainMinutesUsedToday(domain);
    setUsedMinutes(minutes);
  };

  const percentage = Math.min((usedMinutes / limitMinutes) * 100, 100);
  const isOverLimit = usedMinutes >= limitMinutes;

  return (
    <div className="bg-slate-700/50 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-sm">{domain}</span>
        <button
          onClick={() => onRemove(domain)}
          className="text-red-400 hover:text-red-300 text-sm font-medium transition-colors"
        >
          Remove
        </button>
      </div>
      
      <div className="flex items-center justify-between text-sm mb-2">
        <span className={isOverLimit ? 'text-red-400' : 'text-gray-400'}>
          {usedMinutes} / {limitMinutes} minutes used
        </span>
        <span className={`font-medium ${isOverLimit ? 'text-red-400' : 'text-blue-400'}`}>
          {percentage.toFixed(0)}%
        </span>
      </div>
      
      <div className="w-full bg-slate-600 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all ${
            isOverLimit ? 'bg-red-500' : 'bg-gradient-to-r from-green-500 to-blue-500'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      
      {isOverLimit && (
        <p className="text-xs text-red-400 mt-2 font-medium">
          ⚠️ Limit exceeded - site is blocked
        </p>
      )}
    </div>
  );
}

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
