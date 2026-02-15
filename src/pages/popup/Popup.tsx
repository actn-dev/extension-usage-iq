import { useEffect, useState } from 'react';
import type { ActiveOverride, BlockConfig } from '../../types';
import { formatTime, getTodayStats } from '../../utils/analytics';
import { updateBlockingRules } from '../../utils/blockManager';
import { addBlockedDomain, getActiveOverrides, getBlockConfig, removeBlockedDomain } from '../../utils/blockStorage';
import { authClient } from '@src/lib/auth/auth-client';

interface Stats {
  totalTime: number;
  foregroundTime: number;
  backgroundTime: number;
  activeTime: number;
  idleTime: number;
  chromeFocusedTime: number;
  chromeUnfocusedTime: number;
  audibleTime: number;
  topDomains: Array<{
    domain: string;
    time: number;
    foregroundTime: number;
    backgroundTime: number;
    audibleTime: number;
    percentage: number;
    foregroundPercentage: number;
  }>;
  domainCount: number;
  visitCount: number;
  currentSession?: {
    sessionId: string;
    duration: number;
    focusedTime: number;
    unfocusedTime: number;
    idleTime: number;
    openTabs: Array<{
      tabId: number;
      domain: string;
      title: string;
      active: boolean;
      audible: boolean;
      foregroundTime: number;
      currentOpenTime: number;
    }>;
  } | null;
}

export default function Popup() {
  const session = authClient.useSession();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [blockConfig, setBlockConfig] = useState<BlockConfig | null>(null);
  const [activeOverrides, setActiveOverrides] = useState<ActiveOverride[]>([]);
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const [activeTab, setActiveTab] = useState<{
    domain: string;
    title: string;
    timeOnCurrent: number;
    totalTimeToday: number;
  } | null>(null);

  useEffect(() => {
    loadStats();
    loadBlockInfo();
    getCurrentTab();

    // Refresh stats every 2 seconds
    const interval = setInterval(() => {
      loadStats();
      loadBlockInfo();
      getCurrentTab();
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
        const domain = url.hostname.replace(/^www\./, '');
        setCurrentUrl(domain);

        // Find active tab info from current session
        if (stats?.currentSession?.openTabs) {
          const activeTabInfo = stats.currentSession.openTabs.find((t: any) => t.active);
          if (activeTabInfo) {
            const domainStats = stats.topDomains.find((d: any) => d.domain === domain);
            setActiveTab({
              domain,
              title: tab.title || domain,
              timeOnCurrent: activeTabInfo.currentOpenTime,
              totalTimeToday: domainStats?.foregroundTime || 0,
            });
          }
        }
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
  const openAccountPage = () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL('src/pages/options/index.html'),
    });
  };


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
            Dilly
          </h1>
          <div className="flex items-center gap-2">
            {/* Auth Status */}
            <button
              onClick={openAccountPage}
              className={`flex items-center gap-1.5 text-xs rounded px-2 py-1 transition-colors ${session.data
                ? 'bg-green-600/20 border border-green-600/50 hover:bg-green-600/30'
                : 'bg-slate-700/50 border border-slate-600 hover:bg-slate-700'
                }`}
            >
              {session.data ? (
                <>
                  <span className="text-green-400">●</span>
                  <span className="text-green-300 max-w-[80px] truncate">
                    {session.data.user.email?.split('@')[0] || 'Account'}
                  </span>
                </>
              ) : (
                <span className="text-gray-400">Login</span>
              )}
            </button>

            {/* Status Badges */}
            {blockConfig && (
              <>
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
              </>
            )}
          </div>
        </div>
        <p className="text-xs text-gray-400">
          {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* <Login /> */}

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Active Tab Card */}
        {activeTab && (
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-lg p-3 shadow-lg">
            <div className="text-xs text-emerald-100 mb-1">Currently Active</div>
            <div className="text-sm font-semibold text-white truncate mb-2" title={activeTab.title}>
              {activeTab.title}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-emerald-200">On this tab</div>
                <div className="text-lg font-bold text-white">{formatTime(activeTab.timeOnCurrent)}</div>
              </div>
              <div>
                <div className="text-emerald-200">Today total</div>
                <div className="text-lg font-bold text-white">{formatTime(activeTab.totalTimeToday)}</div>
              </div>
            </div>
          </div>
        )}

        {/* Current Session Summary */}
        {stats?.currentSession && (
          <div className="bg-slate-800/60 rounded-lg p-3 border border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-gray-400">Current Session</div>
              <div className="text-xs text-gray-500 font-mono">
                {stats.currentSession.sessionId.slice(0, 8)}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <div className="text-gray-400">Duration</div>
                <div className="text-sm font-semibold text-white">{formatTime(stats.currentSession.duration)}</div>
              </div>
              <div>
                <div className="text-gray-400">Focused</div>
                <div className="text-sm font-semibold text-green-400">{formatTime(stats.currentSession.focusedTime)}</div>
              </div>
              <div>
                <div className="text-gray-400">Open Tabs</div>
                <div className="text-sm font-semibold text-blue-400">{stats.currentSession.openTabs?.length || 0}</div>
              </div>
            </div>
          </div>
        )}

        {/* Current Site Quick Block 
        {currentUrl && (
          <div className="bg-slate-800/60 rounded-lg p-3 border border-slate-700">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="text-xs text-gray-400 mb-1">Block/Unblock</div>
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
        */}

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

        {/* Key Metrics */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg p-3 shadow-lg">
            <div className="text-xs text-blue-200 mb-1">Focused</div>
            <div className="text-xl font-bold">{formatTime(stats.chromeFocusedTime)}</div>
            <div className="text-xs text-blue-200 mt-1">Active</div>
          </div>

          {stats.chromeUnfocusedTime > 0 && (
            <div className="bg-gradient-to-br from-teal-700 to-cyan-700 rounded-lg p-3 shadow-lg">
              <div className="text-xs text-cyan-200 mb-1">Unfocused</div>
              <div className="text-xl font-bold">{formatTime(stats.chromeUnfocusedTime)}</div>
              <div className="text-xs text-cyan-200 mt-1">Inactive</div>
            </div>
          )}

          <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-lg p-3 shadow-lg">
            <div className="text-xs text-purple-200 mb-1">Sites</div>
            <div className="text-xl font-bold">{stats.domainCount}</div>
            <div className="text-xs text-purple-200 mt-1">{stats.visitCount} visits</div>
          </div>
        </div>

        {/* Top Domains */}
        <div className="bg-slate-800/60 rounded-lg p-4 border border-slate-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">Top 5 Websites Today</h2>
          {stats.topDomains.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-4">No browsing activity yet</p>
          ) : (
            <div className="space-y-2.5">
              {stats.topDomains.slice(0, 5).map((domain, index) => (
                <div key={domain.domain} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-xs font-medium text-gray-500 w-4">{index + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white truncate" title={domain.domain}>
                        {domain.domain}
                      </div>
                      <div className="text-xs text-gray-400">
                        {formatTime(domain.foregroundTime)} active
                        {domain.audibleTime > 0 && ` • 🔊 ${formatTime(domain.audibleTime)}`}
                      </div>
                    </div>
                  </div>
                  <div className="text-right ml-2">
                    <div className="text-sm font-medium text-blue-400">
                      {formatTime(domain.time)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {((domain.foregroundTime / (stats.chromeFocusedTime || 1)) * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {/* <div className="text-center py-2">
          <button
            onClick={() => chrome.runtime.openOptionsPage()}
            className="text-xs text-gray-400 hover:text-blue-400 transition-colors"
          >
            View detailed history →
          </button>
        </div> */}
      </div>
    </div>
  );
}
