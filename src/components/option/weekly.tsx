import { formatTime } from "@src/utils/analytics";

export function WeekTab({ stats }: { stats: any }) {
  if (!stats) return null;

  return (
    <div className="space-y-6">
      {/* Weekly Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-linear-to-br from-blue-600 to-blue-700 rounded-lg p-6 shadow-xl">
          <div className="text-sm text-blue-200 mb-2">Total This Week</div>
          <div className="text-3xl font-bold">{formatTime(stats.totalTime)}</div>
        </div>

        <div className="bg-linear-to-br from-green-600 to-green-700 rounded-lg p-6 shadow-xl">
          <div className="text-sm text-green-200 mb-2">Daily Average</div>
          <div className="text-3xl font-bold">{formatTime(Math.round(stats.averageDailyTime))}</div>
        </div>

        <div className="bg-linear-to-br from-purple-600 to-purple-700 rounded-lg p-6 shadow-xl">
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
                    className="bg-linear-to-r from-blue-500 to-purple-500 h-8 rounded-full flex items-center px-3"
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
