# Website Blocking Feature

## Overview

The website blocking feature is a **server-managed** system that allows administrators to control and limit user access to distracting websites through three main mechanisms:

1. **Permanent Blocking**: Completely block specific domains
2. **Time Limits**: Set daily time limits for specific domains (blocks after limit exceeded)
3. **Schedule-Based Blocking**: Block domains during specific times and days (e.g., work hours, focus time)

**🔒 Key Architecture**: The server is the **single source of truth** for all blocking rules. The browser extension is a **read-only enforcement client** that:
- Fetches configuration from the server
- Enforces blocking rules locally using declarativeNetRequest API
- Logs block attempts back to the server
- Cannot modify blocking rules (all changes must be made via admin dashboard)

## Architecture

### Core Components (Server-Managed Architecture)

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                           ADMIN DASHBOARD (Next.js)                            │
│  - Full CRUD for blocking rules                                               │
│  - Manage blocked domains, time limits, schedules                             │
│  - View block attempt logs and analytics                                      │
│  - Enable/disable blocking globally                                           │
│  URL: http://localhost:3000/extension/blocking                                │
└───────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ↓ (tRPC + REST API)
┌───────────────────────────────────────────────────────────────────────────────┐
│                           SERVER DATABASE (SQLite)                             │
│  Tables:                                                                       │
│  - extensionBlockConfig (enabled, softBlock, overrideEnabled, etc.)           │
│  - extensionBlockedDomain (domain, timeLimit, userId)                         │
│  - extensionBlockSchedule (name, times, days, domains)                        │
│  - extensionBlockAttempt (domain, timestamp, reason, overridden)              │
└───────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ↓ (REST API)
┌───────────────────────────────────────────────────────────────────────────────┐
│                      EXTENSION: Background Service Worker                      │
│  - Fetches config from server every 5 minutes (auto-sync)                     │
│  - Fetches config on startup and login                                        │
│  - Manual refresh trigger from Options UI                                     │
│  - Checks time limits every minute                                            │
│  - Checks schedules every 5 minutes                                           │
│  - Updates declarativeNetRequest rules dynamically                            │
│  - Uploads block attempt logs to server                                       │
└───────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ↓
┌───────────────────────────────────────────────────────────────────────────────┐
│                      EXTENSION: Block Config Sync                              │
│  - fetchConfig(): GET /api/extension/blocking/config                          │
│  - transformToLocalFormat(): Convert server format to extension format        │
│  - Cache config locally (read-only, max age 10 min)                           │
│  - syncBlockAttempts(): POST /api/extension/blocking/attempts                 │
#### Server-Side (Admin Dashboard)
1. **Admin Blocking Page** (`/extension/blocking`)
   - Full CRUD for blocked domains
   - Set time limits per domain
   - Enable/disable blocking globally
   - Configure soft block and override settings
   - View all blocked domains with stats

2. **Schedule Management** (`/extension/blocking/schedules`)
   - Create/edit/delete schedules
   - Set time ranges and days of week
   - Assign domains to schedules
   - Enable/disable individual schedules

3. **Analytics (Future)**
   - Block attempt history
   - Domain usage statistics
   - Override tracking

#### Extension (Client-Side - Read-Only)
1. **Options UI** (`src/pages/options/Options.tsx` - Settings Tab)
   - **READ-ONLY display** of blocked domains
   - Shows time usage vs time limits with progress bars
   - Shows which domains are permanently blocked vs time-limited vs scheduled
   - "Manage Blocking Rules" button → Opens admin dashboard
   - **"Refresh from Server"** button → Immediate config sync
   - Cannot add/remove domains (redirects to admin dashboard)

2. **Popup UI** (`src/pages/popup/Popup.tsx`)
   - View current site status
   - Quick link to admin dashboard
   - View active overrides (if enabled)

3. **Blocked Page** (`src/pages/blocked/BlockedPage.tsx`)
   - Shows when user tries to access blocked site
   - Displays block reason:
     - 🚫 Permanent block
     - ⏱️ Time limit exceeded (shows usage/limit)
     - 📅 Blocked by schedule (shows schedule name)
   - Override request interface (if enabled)
   - Link back to admin dashboard         ↓
┌───────────────────────────────────────────────────────────────────────────────┐
│                      EXTENSION: Block Storage (READ-ONLY)                      │
│  - getBlockConfig(): Read cached config from chrome.storage.local             │
│  - All write operations DISABLED with warnings:                               │
│    ⚠️ updateBlockConfig() → "Use admin dashboard"                             │
│    ⚠️ addBlockedDomain() → "Use admin dashboard"                              │
│    ⚠️ setDomainTimeLimit() → "Use admin dashboard"                            │
│    ⚠️ addBlockSchedule() → "Use admin dashboard"                              │
│  - Only server can modify config                                              │
└───────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ↓
┌───────────────────────────────────────────────────────────────────────────────┐
│                    Chrome Storage API (Local Cache Only)                       │
│  - blockConfig: Cached server config (refreshed every 5 min)                  │
│  - blockConfigLastFetch: Timestamp of last sync                               │
│  - activeOverrides: Local override tracking                                   │
│  - blockAttempts: Queued attempts pending upload                              │
└───────────────────────────────────────────────────────────────────────────────┘
```

### User Interface Components

1. **Settings UI** (`src/pages/options/Options.tsx`)
   - Manage blocked domains
   - Configure time limits
   - Create and manage schedules
   - Override settings

2. **Popup UI** (`src/pages/popup/Popup.tsx`)
   - Quick block/unblock current site
   - View blocked sites count
   - View active overrides
   - Override countdown timers

3. **Blocked Page** (`src/pages/blocked/BlockedPage.tsx`)
   - Shows when user tries to access blocked site
   - Displays block reason (blocked/time-limit/schedule)
   - Usage statistics for time-limited sites
   - Override request interface

## Data Models

### BlockConfig

```typescript
interface BlockConfig {
  enabled: boolean;                       // Master toggle
  blockedDomains: string[];               // List of blocked domains
  timeLimits: Record<string, number>;     // domain -> minutes per day
  schedules: BlockSchedule[];             // Time-based blocking rules
  softBlock: boolean;                     // Warning vs hard block
  overrideEnabled: boolean;               // Allow temporary access
  overrideMaxDuration: number;            // Max override duration (minutes)
}
```

### BlockSchedule

```typescript
interface BlockSchedule {
  id: string;                   // Unique identifier
  name: string;                 // User-friendly name
  enabled: boolean;             // Active/inactive toggle
  daysOfWeek: number[];        // 0-6 (Sunday-Saturday)
  startTime: string;           // HH:MM format
  endTime: string;             // HH:MM format
  domains: string[];           // Domains to block during schedule
}
```

### ActiveOverride

```typescript
interface ActiveOverride {
  id: string;              // Unique identifier
  domain: string;          // Overridden domain
  startTime: number;       // Timestamp (ms)
  expiresAt: number;       // Expiration timestamp (ms)
  reason?: string;         // User-provided reason
}
```

### BlockAttempt

```typescript
interface BlockAttempt {
  domain: string;
  timestamp: string;       // ISO 8601 format
  overridden: boolean;     // Whether block was overridden
  overrideReason?: string;
  scheduleId?: string;     // If blocked by schedule
}
```

## Implementation Details

### 1. Blocking Mechanism

**Technology**: Chrome's `declarativeNetRequest` API

**Why declarativeNetRequest?**
- DNS-level blocking before page loads
- More efficient than content scripts
- Works in Manifest V3
- Cannot be bypassed by page scripts

**How it works:**
```typescript
// Create blocking rule
const rule = {
  id: ruleId,
  priority: 1,
  action: {
    type: 'redirect',
    redirect: {
      url: 'chrome-extension://[id]/blocked.html?domain=example.com'
    }
  },
  condition: {
    urlFilter: '*://*.example.com/*',
    resourceTypes: ['main_frame']
  }
};

// Apply rule
chrome.declarativeNetRequest.updateDynamicRules({
  addRules: [rule]
});
```

### 2. Time Limit Enforcement

**Check Frequency**: Every 1 minute

**Process:**
1. Background service runs alarm every minute
2. For each domain with time limit:
   - Query today's usage from storage
   - Compare with configured limit
   - If exceeded, add to blocking rules
3. Update declarativeNetRequest rules if changes detected

**Usage Calculation:**
```typescript
// Get today's activity for domain
const activity = todayActivity.domains[domain];
const usedMinutes = Math.floor(activity.totalTime / 60);

// Check against limit
if (usedMinutes >= config.timeLimits[domain]) {
  // Add to block list
}
```

### 3. Schedule-Based Blocking

**Check Frequency**: Every 5 minutes

**Logic:**
```typescript
function isScheduleActive(schedule: BlockSchedule): boolean {
  const now = new Date();
  const currentDay = now.getDay();
  const currentTime = 'HH:MM';
  
  // Check day of week
  if (!schedule.daysOfWeek.includes(currentDay)) return false;
  
  // Check time range (handles overnight ranges)
  if (schedule.startTime <= schedule.endTime) {
    // Normal range (e.g., 09:00 - 17:00)
    return currentTime >= schedule.startTime && 
           currentTime <= schedule.endTime;
  } else {
    // Overnight range (e.g., 22:00 - 06:00)
    return currentTime >= schedule.startTime || 
           currentTime <= schedule.endTime;
  }
}
```

### 4. Override System

**Purpose**: Allow temporary access for urgent needs

**Features:**
- User must provide reason (optional but encouraged)
- Configurable max duration (default: 30 minutes)
- Automatically expires
- All overrides logged for accountability

**Grant Override:**
```typescript
async function grantOverride(domain: string, reason?: string) {
  const config = await getBlockConfig();
  const expiresAt = Date.now() + (config.overrideMaxDuration * 60 * 1000);
### Server (Next.js - Admin Dashboard)
```
apps/nextjs/src/
├── server/
│   ├── db/
│   │   └── schema.ts                           # Database tables (extensionBlock*)
│   └── api/
│       └── routers/
│           └── extension-blocking.ts           # tRPC router (13 procedures)
├── app/
│   ├── api/extension/blocking/
│   │   ├── config/route.ts                     # GET config for extension
│   │   └── attempts/route.ts                   # POST block attempts
│   └── extension/blocking/
│       ├── page.tsx                            # Main blocking management
│       ├── schedules/page.tsx                  # Schedule management
│       └── _components/
│           ├── block-config-form.tsx           # Enable/disable toggles
│           ├── domain-list.tsx                 # Domain CRUD
│           └── schedule-list.tsx               # Schedule CRUD
```

### Extension (Browser Extension - Read-Only Client)
```
UsageIQ/src/
├── types/index.ts                              # Type definitions
├── utils/
│   ├── blockConfigSync.ts                      # NEW: Server sync manager
│   ├── blockStorage.ts                         # READ-ONLY storage ops
│   ├── blockManager.ts                         # Blocking enforcement
│   └── toast.ts                                # NEW: Custom toast (no deps)
├── pages/
│   ├── background/index.ts                     # Service worker + alarms
│   ├── blocked/
│   │   ├── index.html
│   │   ├── BlockedPage.tsx                     # Blocked page UI
│   │   └── index.css
│   ├── options/Options.tsx                     # READ-ONLY settings UI
│   └── popup/Popup.tsx                         # Popup with quick links
└── manifest.json           
    timestamp: new Date().toISOString(),
    overridden: true,
    overrideReason: reason
  })Server API (REST Endpoints)

#### GET `/api/extension/blocking/config`
**Purpose**: Extension fetches blocking configuration
**Auth**: Cookie-based session (Better Auth)
**Response**:
```json
{
  "enabled": true,
  "softBlock": false,
  "overrideEnabled": false,
  "overrideMaxDuration": 30,
  "blockedDomains": [
    { "domain": "chatgpt.com", "timeLimit": null },
    { "domain": "youtube.com", "timeLimit": 10 }
  ],
  "schedules": [
    {
      "id": "abc123",
      "name": "Work Hours",
      "enabled": true,
      "daysOfWeek": [1, 2, 3, 4, 5],
      "startTime": "09:00",
      "endTime": "17:00",
      "domains": ["facebook.com", "twitter.com"]
    }
  ]
}
```

#### POST `/api/extension/blocking/attempts`
**Purpose**: Extension uploads block attempt logs
**Auth**: Cookie-based session
**Request Body**:
```json
{
  "attempts": [
    {
      "domain": "youtube.com",
      "timestamp": "2026-01-10T15:30:00Z",
      "reason": "time-limit",
      "overridden": false
    }
  ]
}
```

### Server API (tRPC Procedures)

All tRPC procedures in `extensionBlocking` router (admin dashboard only):
Admin Dashboard (Server-Side Management)

#### 1. Access Admin Dashboard
- URL: `http://localhost:3000/extension/blocking`
- Login required (Better Auth)
- Must be authenticated as extension user

#### 2. Block a Website Permanently

**Steps:**
1. Go to admin dashboard
2. In "Add Blocked Domain" section, enter domain (e.g., `chatgpt.com`)
3. Leave "Time Limit" empty for permanent block
4. Click "Add Domain"
5. Domain appears in "Blocked Domains" list

**Result**: Site is blocked immediately (may take up to 5 min for extension to sync)

#### 3. Set Time Limit

**Steps:**
1. Go to admin dashboard
2. In "Add Blocked Domain" section, enter domain (e.g., `youtube.com`)
3. Enter time limit in minutes (e.g., `10` for 10 minutes per day)
4. Click "Add Domain"

**How it works:**
- Extension tracks total time spent on domain
- Domain is **accessible until limit is reached**
- When limit exceeded, domain is blocked for rest of day
- Resets at midnight

#### 4. Create Block Schedule

**Example: Block social media during work hours**

1. Go to admin dashboard → Schedules page
2. Click "Add New Schedule"
3. Fill in form:
   - **Name**: "Work Hours"
   - **Start Time**: 09:00
   - **End Time**: 17:00
   - **Days**: Check Mon, Tue, Wed, Thu, Fri
   - **Domains**: Enter `facebook.com`, `twitter.com`, etc.
   - **Enabled**: Check to activate
4. Click "Add Schedule"

**Schedule Features:**
- Can have multiple schedules
- Enable/disable schedules individually
- Supports overnight ranges (e.g., 22:00 - 06:00)
- Domains blocked ONLY during schedule times

#### 5. Enable/Disable Blocking

**Master Toggle:**
1. Go to admin dashboard
2. Find "Block Configuration" section
3. Toggle "Enable Blocking" switch
4. Click "Save Configuration"

**Result**: When disabled, all blocking rules are removed (even if domains are in list)

### Extension (Client-Side - View Only)

#### 1. View Current Blocking Rules

**Steps:**
1. Right-click extension icon → Options
2. Go to "Settings" tab
3. Scroll to "Website Blocking Managed Centrally" section

**What you see:**
- Count of blocked domains, time limits, schedules
- List of all blocked domains with:
  - 🚫 Permanent blocks (red badge)
  - ⏱️ Time limits (blue badge with limit)
  - 📅 Scheduled blocks (purple badge)
- Today's usage for each domain:
  - "Xm active / Xm total"
  - Progress bar (green → yellow → red as limit approached)
  - Usage percentage

#### 2. Manually Refresh from Server

**When to use:**
- Just added a rule in admin dashboard
- Want to get latest rules immediately (instead of waiting 5 min)

**Steps:**
1. Open extension options → Settings tab
2. Click "🔄 Refresh from Server" button
3. Wait for "Configuration refreshed" toast notification

**Result**: Latest rules fetched and applied within seconds

#### 3. Access Admin Dashboard

**From Extension:**
1. Open extension options → Settings tab
2. Click "Manage Blocking Rules" button
3. Admin dashboard opens in new tab

**From Popup:**
1. Click extension icon
2. Click link to admin dashboard

### When Site is Blocked

**What happens:**
1. Try to visit blocked site (e.g., chatgpt.com)
2. Redirected to block page showing:
   - Domain name
   - Block reason (permanent / time limit / schedule)
   - Usage stats (for time limits)
   - Override request form (if enabled)

**Request Override** (if enabled):
1. Enter reason (optional but encouraged)
2. Click "Grant [X] minute access"
3. Site becomes accessible for configured duration
4. Override logged to server for accountability

**Checklist:**
1. ✅ Check admin dashboard - is domain in blocked list?
2. ✅ Check "Enable Blocking" toggle in admin dashboard
3. ✅ Click "Refresh from Server" in extension options
4. ✅ Wait 30 seconds after refresh for rules to apply
5. ✅ Open new tab and try again (existing tabs may need reload)
6. ✅ Check for active override (if enabled)

**Debug:**
- Open extension Service Worker DevTools (chrome://extensions → service worker)
- Look for logs:
  - `📋 Block config: { enabled: true, blockedDomains: [...] }`
  - `🚫 Adding permanent block for: domain.com`
  - `✅ Added N blocking rules for N domains`
- If you see `⚠️ Blocking is DISABLED`, check admin dashboard toggle

### Rules not syncing after admin dashboard changes

**Cause**: Extension syncs every 5 minutes automatically

**Solutions:**
1. **Immediate sync**: Click "Refresh from Server" in extension options
2. **Or wait**: Auto-sync runs every 5 minutes
3. **Or re-login**: Logout/login triggers immediate sync

**Check sync status:**
- Service Worker console should show: "Block config fetched and cached"

### Time limit not working

**Checklist:**
1. Domain must be in blocked list (with time limit set)
2. Time limit is **"minutes per day"**, not total time
3. Time limit allows access **until exceeded**, then blocks
4. Extension tracks `foregroundTime` (active usage)
5. Resets at midnight (browser local time)

**Debug:**
- Check today's usage in extension options
- Compare against time limit
- If usage < limit, domain should be accessible
- If usage >= limit, domain should be blocked

### Schedule not triggering

**Checklist:**
1. Schedule is enabled (check in admin dashboard)
2. Current day is in schedule's "Days of Week"
3. Current time is within sc (Server-Side Management)

**Admin Dashboard:**
- [ ] Login to http://localhost:3000/extension/blocking
- [ ] Toggle "Enable Blocking" → verify extension receives update
- [ ] Add domain to block list → verify appears in list
- [ ] Set time limit on domain → verify limit shows in UI
- [ ] Create schedule → verify appears in schedules page
- [ ] Remove domain → verify removed from extension

**Extension Sync:**
- [ ] Add rule in dashboard → click "Refresh from Server" → verify rule applies within 30s
- [ ] Wait 5 minutes → verify auto-sync fetches latest config
- [ ] Check Service Worker console → verify sync logs appear
- [ ] Verify "blockConfigLastFetch" timestamp updates

**Blocking Enforcement:**
- [ ] Add `example.com` to block list → try to visit → verify redirect to blocked page
- [ ] Visit both `example.com` and `www.example.com` → verify both blocked
- [ ] Set 5 min limit on `test.com` → use for 5+ min → verify blocks
- [ ] Create schedule for current time → verify blocks immediately (within 5 min)

**Time Limits:**
- [ ] Add domain with 10 min limit
- [ ] Use domain for 5 min → verify still accessible
- [ ] Use domain for 10+ min → verify blocked
- [ ] Check extension options → verify usage shows correct time/percentage
- [ ] Wait until midnight → verify limit resets

**Schedules:**
- [ ] Create schedule for next hour → wait → verify blocks at start time
- [ ] Create schedule with overnight range (22:00-06:00) → verify works
- [ ] Disable schedule → verify unblocks
- [ ] Add multiple domains to schedule → verify all blocked during time

**Override System (if enabled):**
- [ ] Get blocked → request override → verify temporary access granted
- [ ] Wait for override expiration → verify re-blocks
- [ ] Check server → verify override logged in database

**Read-Only Extension:✅ **IMPLEMENTED**
- ✅ Admin-defined block lists (server-managed)
- ✅ Central management dashboard (Next.js admin panel)
- ✅ Server as single source of truth
- ✅ Read-only extension enforcement
- ✅ Block attempt logging for compliance
- 🔄 Multi-user support (per-user configs)
- 📋 Compliance reporting (partially - logs available)d (up to 5 min)

### Override not expiring

**Checklist:**
1. Check browser time is correct
2. Overrides auto-expire when duration ends
3. Page may need reload to re-block
4. Check override duration in admin dashboard settings

**Manual revoke:**
- Use admin dashboard (if override management implemented)
- Or clear extension storage

### Changes in admin dashboard not reflected in extension

**Cause**: Cache or sync delay

**Solution:**
1. Click "Refresh from Server" in extension options
2. Check "blockConfigLastFetch" timestamp in storage
3. Max cache age is 10 minutes
4. Auto-sync alarm runs every 5 minutes

### "Could not notify background" error in console

**Cause**: Service worker not ready when config fetched

**Impact**: None - this is informational only
**Fix**: Service worker will update rules on next alarm (within 5 min)

### Extension shows old rules after dashboard changes

**Solution:**
1. Force refresh: Click "Refresh from Server"
2. Or reload extension: chrome://extensions → Reload
3. Or re-login to extension

### Database / Server Errors

**Symptom**: "Failed to get session" or "Failed to fetch config"
**Causes:**
- Not logged in to extension
- Server not running (check `bun dev`)
- Database connection issue (check Turso connection)
- CORS issue (check API_BASE_URL in blockConfigSync.ts)

**Solution:**
1. Ensure server running at http://localhost:3000
2. Login to extension via Options page
3. Check server logs for errors
4. Verify database migration ran (`bun db:push`)
- `logBlockAttempt(attempt: BlockAttempt): Promise<void>` - Log block attempt
- `getBlockAttempts(limit?: number): Promise<BlockAttempt[]>` - Get attempt history

### Block Manager (`blockManager.ts`)

#### Core Functions
- `initializeBlocking(): Promise<void>` - Initialize blocking system
- `updateBlockingRules(): Promise<void>` - Update all declarativeNetRequest rules
- `shouldBlockDomain(domain: string): Promise<{blocked: boolean, reason: string | null}>` - Check block status

#### Domain Control
- `blockDomain(domain: string): Promise<void>` - Block a domain
- `unblockDomain(domain: string): Promise<void>` - Unblock a domain

#### Override Management
- `grantOverride(domain: string, reason?: string): Promise<void>` - Grant temporary access
- `revokeOverride(domain: string): Promise<void>` - Revoke override

#### Status
- `getBlockingStatus(): Promise<{enabled: boolean, blockedCount: number, activeOverrides: number}>` - Get current status

## Usage Guide

### 1. Block a Website Permanently

**Via Settings:**
1. Open extension options (right-click → Options)
2. Go to Settings tab
3. Enter domain in "Blocked Websites" section
4. Click "Add"

**Via Popup:**
1. Navigate to the site you want to block
2. Click extension icon
3. Click "Block" button next to current site

### 2. Set Time Limit

**Steps:**
1. Open extension options → Settings tab
2. Scroll to "Time Limits" section
3. Select a domain from dropdown (must be blocked first)
4. Enter minutes per day
5. Click "Set Limit"

**How it works:**
- Extension tracks total time spent on domain
- When limit reached, domain is blocked for rest of day
- Resets at midnight

### 3. Create Block Schedule

**Example: Block social media during work hours**

1. Open extension options → Settings tab
2. Scroll to "Block Schedules" section
3. Fill in form:
   - **Name**: "Work Hours"
   - **Start Time**: 09:00
   - **End Time* & Flow
- **Server**: All blocking config stored in SQLite database (per-user)
- **Extension**: Read-only cache in `chrome.storage.local` (synced every 5 min)
- **Authentication**: Cookie-based sessions (Better Auth)
- **Block attempts**: Logged to server for compliance and accountability

### Extension Security
- Extension cannot modify its own blocking rules (read-only)
- All config changes require server authentication
- No localStorage or local write operations for config
- Config cache has 10-minute max age (forces refresh)

### Bypass Prevention
- Uses declarativeNetRequest API (enforced by browser engine)
- Rules applied at network level before page loads
- Cannot be bypassed by:
  - Page scripts / JavaScript
  - DevTools manipulation
  - Content script injection
  - Extension console commands (writes disabled)
- Two rules per domain (covers both with/without subdomain)

### Admin Access Control
- Only authenticated users can access admin dashboard
- Session-based authentication (cookie-only, no tokens in extension)
- tRPC procedures are protected (require auth)
- REST endpoints validate session before serving config

### Override Logging & Accountability
- All overrides logged to server with:
  - Domain
  - Timestamp
  - Reason (user-provided)
  - User ID
- Cannot be deleted from extension (server-side only)
- Provides audit trail for compliance

### Privacy
- Each user has separate blocking configuration
- Block attempts not shared between users
- Server access requires authentication
- No telemetry or analytics sent to external servic
2. See blocked page with override option
3. Enter reason (optional)
4. Click "Grant [X] minute access"
5. Site becomes accessible for configured duration

**Override expires automatically** - no need to revoke manually.

## Permissions Required

```json
{
  "permissions": [
    "storage",
    "tabs",
    "alarms",
    "declarativeNetRequest",
    "declarativeNetRequestFeedback"
  ],
  "host_permissions": [
    "<all_urls>"
  ]
}
```

## Performance Considerations

### CPU Usage
- **Idle**: ~0% (event-driven architecture)
- **Active tracking**: <1% (efficient alarms instead of intervals)
- **Rule updates**: <0.1% (only when configuration changes)

### Memory Usage
- Block config: ~5-10 KB
- Active overrides: ~1 KB per override
- Block attempts log: ~100 bytes per attempt

### Storage Usage
- Typical: 20-50 KB
- With extensive history: Up to 200 KB

## Future Enhancements

### Planned Features
1. **Analytics Dashboard**
   - Track block attempts over time
   - See most blocked sites
   - Override usage patterns

2. **Focus Modes**
   - Predefined blocking profiles
   - Quick toggle between modes
   - "Do Not Disturb" mode

3. **Import/Export**
   - Share configurations
   - Backup settings
   - Sync across devices (via organization)

4. **Smart Blocking**
   - ML-based distraction detection
   - Automatic suggestions
   - Adaptive time limits

### Organization Sync (Planned)
- Admin-defined block lists
- Organization-wide policies
- Central management dashboard
- Compliance reporting

## Troubleshooting

### Site not being blocked
1. Check if blocking is enabled (Settings → master toggle)
2. Verify domain is in blocked list
3. Check for active override (popup shows override count)
4. Try reloading the extension

### Time limit not working
1. Verify time tracking is working (check popup stats)
2. Ensure domain is both blocked AND has time limit
3. Check if override is active
4. Time resets at midnight

### Schedule not triggering
1. Check schedule is enabled
2. Verify current day is in schedule days
3. Check time format is HH:MM (24-hour)
4. Schedules check every 5 minutes - may have slight delay

### Override not expiring
1. Check browser time is correct
2. Overrides auto-expire when page reloads or new tab opens
3. Manual revoke: Settings → remove from active overrides

## Testing

### Manual Testing Checklist
- [ ] Block domain → verify redirect to blocked page
- [ ] Set time limit → verify blocks when exceeded
- [ ] Create schedule → verify blocks during active times
- [ ] Grant override → verify temporary access
- [ ] Override expires → verify re-blocks automatically
- [ ] Remove from block list → verify accessible
- [ ] Disable blocking → verify all sites accessible

### Test Domains
Use these for testing (low-risk):
- `example.com`
- `test.com`
- `placeholder.com`

## Security & Privacy

### Data Storage
- All data stored locally in `chrome.storage.local`
- No data sent to external servers (unless org sync enabled)
- Block configuration is private to user

### Override Logging
- Overrides are logged for accountability
- Logs include timestamp and reason
- Can be cleared from storage

### Bypass Prevention
- Uses declarativeNetRequest (cannot be bypassed by page scripts)
- Blocks at DNS level before page loads
- No content script dependencies

## License

See main LICENSE file in repository root.
