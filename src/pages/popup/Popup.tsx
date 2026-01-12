import { useEffect, useState } from 'react';
import type { ActiveOverride, BlockConfig } from '../../types';
import { formatTime, getTodayStats } from '../../utils/analytics';
import { updateBlockingRules } from '../../utils/blockManager';
import { addBlockedDomain, getActiveOverrides, getBlockConfig, removeBlockedDomain } from '../../utils/blockStorage';

interface Stats {
  totalTime: number;
  foregroundTime: number;
  backgroundTime: number;
  activeTime: number;
  idleTime: number;
  topDomains: Array<{ 
    domain: string; 
    time: number; 
    foregroundTime: number;
    backgroundTime: number;
    percentage: number;
    foregroundPercentage: number;
  }>;
  domainCount: number;
  visitCount: number;
}

export default function Popup() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [blockConfig, setBlockConfig] = useState<BlockConfig | null>(null);
  const [activeOverrides, setActiveOverrides] = useState<ActiveOverride[]>([]);
  const [currentUrl, setCurrentUrl] = useState<string>('');

  useEffect(() => {
    loadStats();
    loadBlockInfo();
    getCurrentTab();
    
    // Refresh stats every 2 seconds
    const interval = setInterval(() => {
      loadStats();
      loadBlockInfo();
      setCurrentTime(new Date());
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const loadStats = async () => {
    try {
      const todayStats = await getTodayStats();
      setStats(todayStats);
      setLoading(false);
    } catch (error) {
      console.error('Error loading stats:', error);
      setLoading(false);
    }
  };

  const loadBlockInfo = async () => {
    try {
      const [config, overrides] = await Promise.all([
        getBlockConfig(),
        getActiveOverrides(),
      ]);
      setBlockConfig(config);
      setActiveOverrides(overrides);
    } catch (error) {
      console.error('Error loading block info:', error);
    }
  };

  const getCurrentTab = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.url) {
        const url = new URL(tab.url);
        setCurrentUrl(url.hostname.replace(/^www\./, ''));
      }
    } catch (error) {
      console.error('Error getting current tab:', error);
    }
  };

  const handleToggleBlockCurrentSite = async () => {
    if (!currentUrl || !blockConfig) return;
    
    const isBlocked = blockConfig.blockedDomains.includes(currentUrl);
    
    if (isBlocked) {
      await removeBlockedDomain(currentUrl);
    } else {
      await addBlockedDomain(currentUrl);
    }
    
    await updateBlockingRules();
    await loadBlockInfo();
  };

  const isCurrentSiteBlocked = blockConfig?.blockedDomains.includes(currentUrl) || false;

  if (loading) {
    return (
      <div className="w-96 h-[500px] bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading stats...</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="w-96 h-[500px] bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-gray-400 mb-4">No data available</p>
          <button
            onClick={() => chrome.runtime.openOptionsPage()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
          >
            Open Dashboard
          </button>
          <p className="text-xs text-gray-500 mt-2">
            Start browsing to see your activity stats
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-96 h-[500px] bg-gradient-to-br from-slate-900 to-slate-800 text-white overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-slate-800/50 backdrop-blur-sm p-4 border-b border-slate-700">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
            UsageIQ
          </h1>
          {blockConfig && (
            <div className="flex items-center gap-2">
              {!blockConfig.enabled && (
                <div className="bg-orange-600/20 border border-orange-600/50 rounded px-2 py-1">
                  <span className="text-xs text-orange-400 font-medium">
                    ⚠️ Blocking OFF
                  </span>
                </div>
              )}
              {activeOverrides.length > 0 && (
                <div className="bg-yellow-600/20 border border-yellow-600/50 rounded px-2 py-1">
                  <span className="text-xs text-yellow-400 font-medium">
                    {activeOverrides.length} Override{activeOverrides.length > 1 ? 's' : ''}
                  </span>
                </div>
              )}
              {blockConfig.blockedDomains.length > 0 && blockConfig.enabled && (
                <div className="bg-red-600/20 border border-red-600/50 rounded px-2 py-1">
                  <span className="text-xs text-red-400 font-medium">
                    {blockConfig.blockedDomains.length} Blocked
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
        <p className="text-xs text-gray-400">
          {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* <Login /> */}

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Current Site Quick Block */}
        {currentUrl && (
          <div className="bg-slate-800/60 rounded-lg p-3 border border-slate-700">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="text-xs text-gray-400 mb-1">Current Site</div>
                <div className="text-sm font-medium text-white truncate" title={currentUrl}>
                  {currentUrl}
                </div>
                {!blockConfig?.enabled && (
                  <div className="text-xs text-orange-400 mt-1">
                    ⚠️ Blocking is disabled in settings
                  </div>
                )}
              </div>
              <button
                onClick={handleToggleBlockCurrentSite}
                disabled={!blockConfig?.enabled && !isCurrentSiteBlocked}
                className={`ml-3 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  isCurrentSiteBlocked
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : blockConfig?.enabled
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-slate-600 cursor-not-allowed text-gray-400'
                }`}
              >
                {isCurrentSiteBlocked ? 'Unblock' : 'Block'}
              </button>
            </div>
          </div>
        )}

        {/* Active Overrides */}
        {activeOverrides.length > 0 && (
          <div className="bg-yellow-600/10 border border-yellow-600/30 rounded-lg p-3">
            <div className="text-xs font-semibold text-yellow-400 mb-2">Active Overrides</div>
            <div className="space-y-2">
              {activeOverrides.map(override => {
                const expiresIn = Math.max(0, override.expiresAt - Date.now());
                const minutesLeft = Math.ceil(expiresIn / 60000);
                return (
                  <div key={override.id} className="flex items-center justify-between">
                    <span className="text-xs text-yellow-300 font-mono">{override.domain}</span>
                    <span className="text-xs text-yellow-400">{minutesLeft}m left</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Total Time Card */}
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg p-4 shadow-lg">
          <div className="text-sm text-blue-200 mb-1">Today's Total Time</div>
          <div className="text-3xl font-bold">{formatTime(stats.totalTime)}</div>
          <div className="text-xs text-blue-200 mt-2 space-y-1">
            <div className="flex justify-between">
              <span>Foreground:</span>
              <span className="font-medium">{formatTime(stats.foregroundTime)}</span>
            </div>
            <div className="flex justify-between">
              <span>Background:</span>
              <span className="font-medium">{formatTime(stats.backgroundTime)}</span>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-800/60 rounded-lg p-3 border border-slate-700">
            <div className="text-xs text-gray-400 mb-1">Sites Visited</div>
            <div className="text-2xl font-bold text-purple-400">{stats.domainCount}</div>
          </div>
          <div className="bg-slate-800/60 rounded-lg p-3 border border-slate-700">
            <div className="text-xs text-gray-400 mb-1">Total Visits</div>
            <div className="text-2xl font-bold text-green-400">{stats.visitCount}</div>
          </div>
        </div>

        {/* Top Domains */}
        <div className="bg-slate-800/60 rounded-lg p-4 border border-slate-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">Top Websites</h2>
          {stats.topDomains.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-4">No browsing activity yet</p>
          ) : (
            <div className="space-y-2">
              {stats.topDomains.slice(0, 8).map((domain, index) => (
                <div key={domain.domain} className="group">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-xs font-medium text-gray-500 w-4">{index + 1}</span>
                      <span className="text-sm text-white truncate flex-1" title={domain.domain}>
                        {domain.domain}
                      </span>
                    </div>
                    <div className="flex flex-col items-end ml-2">
                      <span className="text-xs font-medium text-blue-400">
                        {formatTime(domain.time)}
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatTime(domain.foregroundTime)}f / {formatTime(domain.backgroundTime)}b
                      </span>
                    </div>
                  </div>
                  <div className="ml-6">
                    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full flex">
                        <div
                          className="bg-blue-500 rounded-l-full transition-all duration-300"
                          style={{ width: `${(domain.foregroundTime / domain.time) * domain.percentage}%` }}
                          title={`Foreground: ${domain.foregroundPercentage.toFixed(1)}%`}
                        />
                        <div
                          className="bg-purple-500 rounded-r-full transition-all duration-300"
                          style={{ width: `${(domain.backgroundTime / domain.time) * domain.percentage}%` }}
                          title={`Background: ${(100 - domain.foregroundPercentage).toFixed(1)}%`}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center py-2">
          <button
            onClick={() => chrome.runtime.openOptionsPage()}
            className="text-xs text-gray-400 hover:text-blue-400 transition-colors"
          >
            View detailed history →
          </button>
        </div>
      </div>
    </div>
  );
}
