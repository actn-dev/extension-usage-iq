import { BlockConfig, DomainActivity } from "@src/types";
import { getBlockConfigSync } from "@src/utils/blockConfigSync";
import { getBlockConfig } from "@src/utils/blockStorage";
import { getTodayActivity } from "@src/utils/storage";
import { toast } from "@src/utils/toast";
import { useEffect, useState } from "react";

export function SettingsTab({ storageInfo, onExport }: { storageInfo: any; onExport: () => void }) {
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