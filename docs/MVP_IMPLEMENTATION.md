# UsageIQ - Browser Activity Monitor

A Chrome extension that tracks and analyzes browsing activity with detailed time tracking and productivity insights.

## Features

✅ **Real-time Activity Tracking**
- Monitors active tabs and time spent on each website
- Tracks domain-level activity (groups all pages from the same site)
- **Foreground vs Background time tracking**:
  - Foreground time: When tab is actively viewed/focused
  - Background time: When tab is open but not active
  - Efficient single-timer approach with in-memory tab tracking
- Detects idle time (5-minute threshold)
- Handles multi-window and focus changes

✅ **Data Management**
- Local storage using Chrome Storage API
- Automatic daily rollover at midnight
- 30-day historical data retention
- Data export to JSON
- Efficient event-driven tab tracking (no polling)

✅ **User Interface**
- **Popup Dashboard**: Quick view of today's activity
  - Total time with foreground/background breakdown
  - Top 10 websites with dual-color progress bars
  - Visual distinction: Blue (foreground) vs Purple (background)
  - Live updates every 2 seconds
  
- **Options Page**: Detailed analytics
  - Today tab: Comprehensive daily stats with foreground/background metrics
  - Week tab: 7-day trends and aggregated data
  - History tab: Full historical data table
  - Settings tab: Storage info and data export

✅ **Analytics**
- Time formatting (hours, minutes, seconds)
- Top domains ranked by time spent
- Foreground/background time distribution
- Percentage calculations for both time types
- Weekly averages and trends

✅ **Authentication & User Management**
- Better Auth integration
- Google OAuth social login
- Session management with React hooks
- Secure user authentication flow

## Project Structure

```
src/
├── types/
│   └── index.ts                 # TypeScript interfaces and data models
├── utils/
│   ├── storage.ts              # Chrome storage manager
│   ├── timeTracker.ts          # Time tracking engine (foreground/background)
│   ├── tabTracker.ts           # In-memory tab tracking
│   └── analytics.ts            # Data aggregation and formatting
├── lib/
│   └── auth/
│       └── auth-client.ts      # Better Auth client configuration
├── components/
│   └── login.tsx               # Login/authentication component
├── pages/
│   ├── background/
│   │   └── index.ts            # Service worker (main monitoring engine)
│   ├── popup/
│   │   ├── index.html
│   │   ├── index.tsx
│   │   ├── index.css
│   │   └── Popup.tsx           # Popup dashboard UI
│   └── options/
│       ├── index.html
│       ├── index.tsx
│       ├── index.css
│       └── Options.tsx         # Detailed analytics page
└── manifest.json               # Extension configuration
```

## Technical Implementation

### Background Service Worker
The core monitoring engine runs as a Manifest V3 service worker:

- **Event Listeners**:
  - `chrome.tabs.onActivated`: Tab switches
  - `chrome.tabs.onUpdated`: URL changes
  - `chrome.tabs.onRemoved`: Tab closures
  - `chrome.windows.onFocusChanged`: Window focus
  - Single 1-second interval for all tracking (minimal CPU)
  - Foreground: Active tab gets foreground time
  - Background: All other open tabs get background time
  - In-memory Map tracks all open tabs efficiently
  - Pauses when idle or window loses focus
  - Persists state across browser restarts

- **Tab Tracking**:
  - Event-driven in-memory Map (no polling)
  - Initializes on extension startup/install
  - Updates via tab events only
  - Efficient domain grouping
  - Updates every second for active tab
  - Pauses when idle or window loses focus
  - Persists state across browser restarts

- **Data Management**:
  - Stores activity in chrome.storage.local
  - Runs daily rollover a   // seconds (foreground + background)
  foregroundTime: number;   // seconds when tab was active/focused
  backgroundTime: number;   // seconds when tab was open but not active
  visitCount: number;
  lastVisit: string;        // ISO timestamp
  date: string;   

**DomainActivity**:
```typescript
{
  domain: string;
  totalTime: number;     // seconds
  visitCount: number;
  lastVisit: string;     // ISO timestamp
  date: string;          // YYYY-MM-DD
}
```

**DailySummary**:
```typescript
{
  date: string;
  totalChromeTime: number;
  activeTime: number;
  idleTime: number;
  topDomains: Array<{ domain: string; time: number }>;
  sessionCount: number;
}
```

### Storage Structure

```typescript
{
  sessionState: {
    activeTabId: number | null;
    activeDomain: string | null;
    sessionStartTime: number | null;
    isIdle: boolean;
    windowFocused: boolean;
  },
  todayActivity: {
    date: string;
    domains: Record<string, DomainActivity>;
    totalTime: number;
    idleTime: number;
    sessionCount: number;
  },
  dailySummaries: Record<string, DailySummary>,
  config: {
    idleThresholdMinutes: number;
    excludedDomains: string[];
    syncEnabled: boolean;
  }
}
```

## Development Setup

### Prerequisites
- Node.js 16+ or Bun
- Chrome browser

### Installation

```bash
# Install dependencies
bun install
# or
npm install

# Development mode (with hot reload)
bun run dev
# or
npm run dev

# Build for production
bun run build
# or
npm run build
```

### Load in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `dist` folder from your build

### Development Workflow

1. Run `bun run dev` to start development server with hot reload
2. Make changes to source files
3. Extension auto-reloads in Chrome
4. View console logs in:
   - Background: `chrome://extensions/` → "service worker"
   - Popup: Right-click extension icon → "Inspect popup"
   - Options: Right-click options page → "Inspect"

## Usage

### Viewing Statistics

**Popup (Quick View)**:
- Click extension icon in toolbar
- See today's total time and top websites
- Click "View detailed history →" for full dashboard

**Options Page (Detailed View)**:
- Right-click extension icon → "Options"
- Or navigate to `chrome://extensions/` → UsageIQ → "Details" → "Extension options"

### Exporting Data

1. Open Options page
2. Navigate to "Settings" tab
3. Click "Export to JSON"
4. Data downloads as `usageiq-export-YYYY-MM-DD.json`

## Permissions

Required Chrome permissions:

- `tabs`: Read tab information and detect changes
- `storage`: Store activity data locally
- `idle`: Detect user idle state (5 min threshold)
- `alarms`: Schedule periodic tasks (daily rollover)
- `<all_urls>`: Access to all website URLs for tracking

## Privacy & Security

- **No sensitive data collection**: Only tracks URLs and page titles
- **Local storage only**: All data stored locally in Chrome
- **No network requests**: No data sent to external servers
- **Excludes**: `chrome://`, `chrome-extension://`, `about:` pages
- **Incognito mode**: Not monitored (Chrome restriction)

## Performance (including in-memory tab tracker)
- **CPU usage**: <1% (steady state, even with 50+ tabs)
- **Storage**: ~100-500 KB for 30 days of data
- **Update frequency**: 1-second intervals for all tracking
- **Background tracking overhead**: Minimal (pure memory operations)
- **UI refresh**: 2-5 seconds for dashboard updates
- **Tab tracking**: Event-driven (no polling overhead)
- **Update frequency**: 1-second intervals for active tracking
- **UI refresh**: 2-5 seconds for dashboard updates

## Known Limitations

1. Cannot track incognito mode (Chrome restriction)
## Recent Updates

### Version 1.1.0 (January 9, 2026)
- ✅ Added foreground vs background time tracking
- ✅ Implemented efficient in-memory tab tracker
- ✅ Updated UI to show dual time metrics
- ✅ Enhanced analytics with foreground/background distribution
- ✅ Optimized for minimal CPU usage with multiple tabs
- ✅ Integrated Better Auth for user authentication
- ✅ Implemented Google OAuth social login
- ✅ Added session management with React hooks

## Future Enhancements

- [ ] Cloud sync with authenticated backend
- [ ] Domain exclusion list (configurable)
- [ ] Custom idle threshold
- [ ] Working hours filter
- [ ] Server sync for organization-wide analytics
- [ ] Advanced productivity algorithms
- [ ] Category-based site classification
- [ ] Multi-device data synchronization
- [ ] Chrome Web Store publication
- [ ] Firefox support

## Troubleshooting

**Extension not tracking time?**
- Check service worker is active: `chrome://extensions/` → "service worker"
- Look for console errors in service worker inspector
- Ensure permissions are granted

**Data not persisting?**
- Check storage quota: Options → Settings → Storage Information
- Clear old data if approaching quota

**UI not updating?**
- Force refresh the popup/options page
- Check browser console for errors

## License

MIT License - S1.0  
**Last Updated**: January 9, 2026

## Changelog

### v1.1.0 - January 9, 2026
- Added foreground/background time tracking
- Implemented in-memory tab tracker for efficiency
- Updated popup and options UI with dual-time metrics
- Enhanced analytics with foreground percentage calculations
- Optimized CPU usage for multi-tab scenarios
- Integrated Better Auth for authentication
- Implemented Google OAuth social login
- Added Login component with session management

### v1.0.0 - January 8, 2026
- Initial release
- Basic time tracking for active tabs
- Popup dashboard and options page
- Daily rollover and data retention
- Idle detection and window focus handling
## Credits

Built with:
- React 19
- TypeScript 5
- Tailwind CSS 4
- Vite 6
- Chrome Extension Manifest V3

---

**Version**: 1.0.0  
**Last Updated**: January 8, 2026
