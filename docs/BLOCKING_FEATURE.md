# Website Blocking Feature

## Overview

The website blocking feature allows users to control and limit their access to distracting websites through three main mechanisms:

1. **Permanent Blocking**: Completely block specific domains
2. **Time Limits**: Set daily time limits for specific domains
3. **Schedule-Based Blocking**: Block domains during specific times and days (e.g., work hours, focus time)

## Architecture

### Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Background Service Worker                 │
│  - Initializes blocking system on startup                    │
│  - Checks time limits every minute                           │
│  - Checks schedules every 5 minutes                          │
│  - Updates blocking rules dynamically                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                      Block Manager                            │
│  - Manages declarativeNetRequest rules                       │
│  - Determines which domains to block                         │
│  - Handles override grants/revocations                       │
│  - Schedule-based blocking logic                             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                      Block Storage                            │
│  - CRUD operations for block configuration                   │
│  - Manages blocked domains list                              │
│  - Manages time limits                                       │
│  - Manages schedules                                         │
│  - Tracks block attempts and overrides                       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    Chrome Storage API                         │
│  - Persists block configuration                              │
│  - Stores active overrides                                   │
│  - Logs block attempts                                       │
└─────────────────────────────────────────────────────────────┘
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
  
  await addActiveOverride({
    id: `${domain}-${Date.now()}`,
    domain,
    startTime: Date.now(),
    expiresAt,
    reason
  });
  
  // Update rules to unblock
  await updateBlockingRules();
  
  // Log for tracking
  await logBlockAttempt({
    domain,
    timestamp: new Date().toISOString(),
    overridden: true,
    overrideReason: reason
  });
}
```

## File Structure

```
src/
├── types/index.ts                    # Type definitions
├── utils/
│   ├── blockStorage.ts              # Storage operations
│   └── blockManager.ts              # Blocking logic
├── pages/
│   ├── background/index.ts          # Service worker with alarms
│   ├── blocked/
│   │   ├── index.html
│   │   ├── BlockedPage.tsx          # Blocked page UI
│   │   └── index.css
│   ├── options/Options.tsx          # Settings UI (Settings tab)
│   └── popup/Popup.tsx              # Popup with quick controls
└── manifest.json                     # Permissions & config
```

## API Reference

### Block Storage (`blockStorage.ts`)

#### Configuration Management
- `getBlockConfig(): Promise<BlockConfig>` - Get current configuration
- `updateBlockConfig(updates: Partial<BlockConfig>): Promise<void>` - Update configuration

#### Domain Management
- `addBlockedDomain(domain: string): Promise<void>` - Add domain to block list
- `removeBlockedDomain(domain: string): Promise<void>` - Remove from block list

#### Time Limits
- `setDomainTimeLimit(domain: string, minutes: number): Promise<void>` - Set time limit
- `removeDomainTimeLimit(domain: string): Promise<void>` - Remove time limit
- `getDomainMinutesUsedToday(domain: string): Promise<number>` - Get usage

#### Schedules
- `addBlockSchedule(schedule: BlockSchedule): Promise<void>` - Add schedule
- `updateBlockSchedule(scheduleId: string, updates: Partial<BlockSchedule>): Promise<void>` - Update schedule
- `removeBlockSchedule(scheduleId: string): Promise<void>` - Remove schedule

#### Overrides
- `getActiveOverrides(): Promise<ActiveOverride[]>` - Get active overrides
- `addActiveOverride(override: ActiveOverride): Promise<void>` - Grant override
- `removeActiveOverride(domain: string): Promise<void>` - Revoke override
- `hasActiveOverride(domain: string): Promise<boolean>` - Check override status

#### Logging
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
   - **End Time**: 17:00
   - **Days**: Mon, Tue, Wed, Thu, Fri
   - **Domains**: Select facebook.com, twitter.com, etc.
4. Click "Add Schedule"

**Schedule Features:**
- Can have multiple schedules
- Enable/disable schedules individually
- Supports overnight ranges (e.g., 22:00 - 06:00)

### 4. Request Override

**When blocked:**
1. Try to visit blocked site
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
