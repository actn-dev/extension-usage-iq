import React, { useState } from 'react';
import { formatTime } from '../../utils/analytics';

interface SessionDomain {
  domain: string;
  foregroundTime: number;
  backgroundTime: number;
  audibleTime: number;
  totalOpenTime: number;
  visitCount: number;
}

interface SessionCardProps {
  session: {
    sessionId: string;
    startTime: number;
    endTime: number | null;
    duration: number;
    focusedTime: number;
    unfocusedTime: number;
    idleTime: number;
    isActive: boolean;
    domains?: SessionDomain[];
  };
}

export function SessionCard({ session }: SessionCardProps) {
  const [expanded, setExpanded] = useState(false);
  
  const startTime = new Date(session.startTime).toLocaleTimeString();
  const endTime = session.endTime ? new Date(session.endTime).toLocaleTimeString() : 'Ongoing';
  
  return (
    <div 
      className={`rounded p-4 ${session.isActive ? 'bg-indigo-600/30 border border-indigo-500' : 'bg-slate-700/50'}`}
    >
      {/* Session Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{startTime} - {endTime}</span>
          {session.isActive && (
            <span className="text-xs bg-green-500/30 text-green-300 px-2 py-0.5 rounded">Active</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{session.sessionId.slice(0, 8)}...</span>
          {session.domains && session.domains.length > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              {expanded ? '▲ Hide' : '▼ Show'} Domains ({session.domains.length})
            </button>
          )}
        </div>
      </div>
      
      {/* Session Stats */}
      <div className="grid grid-cols-4 gap-3 text-sm">
        <div>
          <div className="text-xs text-gray-400">Duration</div>
          <div className="font-medium">{formatTime(session.duration)}</div>
        </div>
        <div>
          <div className="text-xs text-gray-400">Focused</div>
          <div className="font-medium text-green-400">{formatTime(session.focusedTime)}</div>
        </div>
        <div>
          <div className="text-xs text-gray-400">Unfocused</div>
          <div className="font-medium text-yellow-400">{formatTime(session.unfocusedTime)}</div>
        </div>
        <div>
          <div className="text-xs text-gray-400">Idle</div>
          <div className="font-medium text-gray-400">{formatTime(session.idleTime)}</div>
        </div>
      </div>
      
      {/* Domain Breakdown (Expandable) */}
      {expanded && session.domains && session.domains.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-600">
          <div className="flex items-center gap-4 mb-3 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <span className="text-green-300">●</span> Foreground
            </span>
            <span className="flex items-center gap-1">
              <span className="text-yellow-300">●</span> Background
            </span>
            <span className="flex items-center gap-1">
              <span className="text-blue-300">📂</span> Open time
            </span>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {session.domains.map((domain) => (
              <div 
                key={domain.domain} 
                className="flex items-center justify-between text-sm bg-slate-600/30 rounded px-3 py-2"
              >
                <span className="text-white truncate flex-1">{domain.domain}</span>
                <div className="flex items-center gap-3 text-xs">
                  {domain.audibleTime > 0 && (
                    <span className="text-pink-300">🔊 {formatTime(domain.audibleTime)}</span>
                  )}
                  <span className="text-green-300" title="Foreground time">
                    {formatTime(domain.foregroundTime)}
                  </span>
                  {domain.backgroundTime > 0 && (
                    <span className="text-yellow-300" title="Background time">
                      {formatTime(domain.backgroundTime)}
                    </span>
                  )}
                  <span className="text-blue-300" title="Total open time">
                    📂 {formatTime(domain.totalOpenTime)}
                  </span>
                  <span className="text-gray-400">
                    ({domain.visitCount} {domain.visitCount === 1 ? 'visit' : 'visits'})
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-600 flex justify-between text-xs text-gray-400">
            <span>{session.domains.length} domains</span>
            <span>
              Total active: {formatTime(session.domains.reduce((sum, d) => sum + d.foregroundTime, 0))}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
