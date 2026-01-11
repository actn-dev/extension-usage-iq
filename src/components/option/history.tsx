import { DailySummary } from "@src/types";
import { formatTime } from "@src/utils/analytics";

export function HistoryTab({ data }: { data: Record<string, DailySummary> }) {
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