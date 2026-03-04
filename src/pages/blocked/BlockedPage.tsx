import React, { useState, useEffect } from 'react';
import { grantOverride, shouldBlockDomain } from '../../utils/blockManager';
import { getDomainMinutesUsedToday, getBlockConfig } from '../../utils/blockStorage';
import { formatTime } from '../../utils/analytics';
import type { BlockSchedule } from '../../types';

export default function BlockedPage() {
  const [domain, setDomain] = useState<string>('');
  const [reason, setReason] = useState<'blocked' | 'time-limit' | 'schedule' | null>(null);
  const [loading, setLoading] = useState(true);
  const [overrideReason, setOverrideReason] = useState('');
  
  const [usedMinutes, setUsedMinutes] = useState(0);
  const [limitMinutes, setLimitMinutes] = useState(0);
  const [allowOverride, setAllowOverride] = useState(false);
  const [overrideDuration, setOverrideDuration] = useState(5);
  const [activeSchedule, setActiveSchedule] = useState<BlockSchedule | null>(null);

  useEffect(() => {
    loadBlockInfo();
  }, []);

  const loadBlockInfo = async () => {
    try {
      // Get domain from URL parameter
      const urlParams = new URLSearchParams(window.location.search);
      const blockedDomain = urlParams.get('domain') || '';
      setDomain(blockedDomain);

      // Check why it's blocked
      const blockStatus = await shouldBlockDomain(blockedDomain);
      setReason(blockStatus.reason);

      // Get config
      const config = await getBlockConfig();
      setAllowOverride(config.overrideEnabled);
      setOverrideDuration(config.overrideMaxDuration);

      // If time limit, get usage
      if (blockStatus.reason === 'time-limit') {
        const used = await getDomainMinutesUsedToday(blockedDomain);
        const limit = config.timeLimits[blockedDomain] || 0;
        setUsedMinutes(used);
        setLimitMinutes(limit);
      }

      // If schedule, find active schedule
      if (blockStatus.reason === 'schedule') {
        const now = new Date();
        const currentDay = now.getDay();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        
        for (const schedule of config.schedules) {
          if (schedule.enabled && 
              schedule.domains.includes(blockedDomain) &&
              schedule.daysOfWeek.includes(currentDay)) {
            setActiveSchedule(schedule);
            break;
          }
        }
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading block info:', error);
      setLoading(false);
    }
  };

  const handleOverride = async () => {
    try {
      await grantOverride(domain, overrideReason || undefined);
      // Redirect to the original domain
      window.location.href = `https://${domain}`;
    } catch (error) {
      console.error('Error granting override:', error);
    }
  };

  const handleGoBack = () => {
    window.history.back();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-900 to-slate-800 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-red-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 to-slate-800 text-white flex items-center justify-center p-6">
      <div className="max-w-2xl w-full">
        {/* Icon */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-red-500/20 mb-4">
            <svg className="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold mb-2">Site Blocked</h1>
          <p className="text-xl text-gray-400">{domain}</p>
        </div>

        {/* Reason */}
        <div className="bg-slate-800/60 rounded-lg border border-slate-700 p-6 mb-6">
          {reason === 'blocked' && (
            <>
              <h2 className="text-xl font-semibold mb-2">This site is blocked</h2>
              <p className="text-gray-400">
                You've configured Dilly to block this website to help you stay focused.
              </p>
            </>
          )}
          
          {reason === 'time-limit' && (
            <>
              <h2 className="text-xl font-semibold mb-2">Daily time limit reached</h2>
              <p className="text-gray-400 mb-4">
                You've reached your daily time limit for this website.
              </p>
              <div className="bg-slate-700/50 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-400">Time used today:</span>
                  <span className="text-lg font-semibold text-red-400">{formatTime(usedMinutes * 60)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Daily limit:</span>
                  <span className="text-lg font-semibold">{formatTime(limitMinutes * 60)}</span>
                </div>
                <div className="mt-3 w-full bg-slate-600 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-red-500 h-3 rounded-full"
                    style={{ width: `${Math.min((usedMinutes / limitMinutes) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </>
          )}

          {reason === 'schedule' && (
            <>
              <h2 className="text-xl font-semibold mb-2">Blocked by schedule</h2>
              <p className="text-gray-400 mb-4">
                This site is blocked during your configured focus hours.
              </p>
              {activeSchedule && (
                <div className="bg-slate-700/50 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-400">Schedule:</span>
                    <span className="text-lg font-semibold">{activeSchedule.name}</span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-400">Active hours:</span>
                    <span className="font-medium">{activeSchedule.startTime} - {activeSchedule.endTime}</span>
                  </div>
                  <div className="mt-3">
                    <span className="text-sm text-gray-400">Active days:</span>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {activeSchedule.daysOfWeek.map(day => {
                        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                        return (
                          <span key={day} className="px-2 py-1 bg-blue-600/30 text-blue-400 rounded text-xs">
                            {days[day]}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Override section */}
        {allowOverride && (
          <div className="bg-slate-800/60 rounded-lg border border-slate-700 p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4">Request temporary access</h3>
            <p className="text-sm text-gray-400 mb-4">
              You can temporarily override this block for {overrideDuration} minutes. Use this sparingly.
            </p>
            
            <input
              type="text"
              placeholder="Why do you need access? (optional)"
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 mb-4"
            />
            
            <button
              onClick={handleOverride}
              className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
            >
              Grant {overrideDuration} minute access
            </button>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-4">
          <button
            onClick={handleGoBack}
            className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium py-3 px-6 rounded-lg transition-colors"
          >
            Go Back
          </button>
          <button
            onClick={() => chrome.runtime.openOptionsPage()}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
          >
            Manage Blocked Sites
          </button>
        </div>

        {/* Tips */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Blocked sites help you stay productive and focused on what matters.</p>
        </div>
      </div>
    </div>
  );
}
