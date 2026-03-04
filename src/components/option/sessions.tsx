import React from 'react';
import { SessionCard } from './SessionCard';
import { toast } from '../../utils/toast';

interface SessionsTabProps {
  stats: any;
}

export function SessionsTab({ stats }: SessionsTabProps) {
  const handleNewSession = async () => {
    if (!confirm('Start a new session? This will end the current session and start fresh.')) {
      return;
    }
    
    try {
      // Dynamically import session manager functions
      const { endBrowserSession, startBrowserSession } = await import('../../utils/sessionManager');
      
      // End current session
      await endBrowserSession();
      
      // Start new session
      await startBrowserSession();
      
      toast.success('New session started successfully!');
      
      // Reload page to show new session
      setTimeout(() => window.location.reload(), 500);
    } catch (error) {
      console.error('Error starting new session:', error);
      toast.error('Failed to start new session');
    }
  };

  if (!stats || !stats.allSessions) {
    return (
      <div className="text-center text-gray-400 py-12">
        <p>No session data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with New Session Button */}
      <div className="bg-slate-800/60 rounded-lg border border-slate-700 p-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-2xl font-semibold">Browser Sessions</h2>
            <p className="text-sm text-gray-400 mt-1">
              View all your browsing sessions today with detailed domain breakdowns
            </p>
          </div>
          <button
            onClick={handleNewSession}
            className="px-4 py-2 bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg font-medium transition-all shadow-lg hover:shadow-xl"
          >
            🔄 Start New Session
          </button>
        </div>
      </div>

      {/* Current Session */}
      {stats.currentSession && (
        <div className="bg-slate-800/60 rounded-lg border border-slate-700 p-6">
          <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <span className="text-green-400">●</span> Current Session
          </h3>
          <SessionCard 
            session={{
              sessionId: stats.currentSession.sessionId,
              startTime: Date.now() - (stats.currentSession.duration * 1000),
              endTime: null,
              duration: stats.currentSession.duration,
              focusedTime: stats.currentSession.focusedTime,
              unfocusedTime: stats.currentSession.unfocusedTime,
              idleTime: stats.currentSession.idleTime,
              isActive: true,
              domains: stats.currentSession.domains || [],
            }}
          />
        </div>
      )}

      {/* All Sessions */}
      {stats.allSessions && stats.allSessions.length > 0 ? (
        <div className="bg-slate-800/60 rounded-lg border border-slate-700 p-6">
          <h3 className="text-xl font-semibold mb-4">
            All Sessions Today ({stats.allSessions.length})
          </h3>
          <div className="space-y-3">
            {stats.allSessions.map((session: any) => (
              <SessionCard key={session.sessionId} session={session} />
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-slate-800/60 rounded-lg border border-slate-700 p-6 text-center text-gray-400">
          <p>No sessions recorded today</p>
        </div>
      )}

      {/* Session Stats Summary */}
      <div className="bg-slate-800/60 rounded-lg border border-slate-700 p-6">
        <h3 className="text-xl font-semibold mb-4">Session Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-700/50 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Total Sessions</div>
            <div className="text-2xl font-bold text-white">
              {stats.allSessions ? stats.allSessions.length : 0}
            </div>
          </div>
          <div className="bg-slate-700/50 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Total Duration</div>
            <div className="text-2xl font-bold text-blue-400">
              {stats.allSessions 
                ? Math.floor(stats.allSessions.reduce((sum: number, s: any) => sum + s.duration, 0) / 60) + 'm'
                : '0m'}
            </div>
          </div>
          <div className="bg-slate-700/50 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Total Focused</div>
            <div className="text-2xl font-bold text-green-400">
              {stats.allSessions 
                ? Math.floor(stats.allSessions.reduce((sum: number, s: any) => sum + s.focusedTime, 0) / 60) + 'm'
                : '0m'}
            </div>
          </div>
          <div className="bg-slate-700/50 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Avg Session</div>
            <div className="text-2xl font-bold text-purple-400">
              {stats.allSessions && stats.allSessions.length > 0
                ? Math.floor(stats.allSessions.reduce((sum: number, s: any) => sum + s.duration, 0) / stats.allSessions.length / 60) + 'm'
                : '0m'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
