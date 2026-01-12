# Session-Based Time Tracking Implementation

## Overview
Implemented comprehensive browser session tracking with focused/unfocused time, audible media tracking, and proper time accounting that can be verified mathematically.

---

## ✅ What Was Implemented

### 1. **Extension - Session Tracking**

#### New Data Structures:
- **`BrowserSession`**: Tracks Chrome open → close lifecycle
  - `sessionId`: Unique identifier per browser session
  - `startTime`, `endTime`: Session boundaries
  - `focusedTime`: Chrome window was active/focused (seconds)
  - `unfocusedTime`: Chrome open but user in other app (seconds)
  - `idleTime`: User inactive (seconds)
  - `totalTime`: Verifiable sum = focused + unfocused + idle
  - `tabCount`, `domainCount`: Session stats

#### Updated `DomainActivity`:
- Added `sessionId`: Links activity to specific session
- Added `audibleTime`: Tracks audio/video playing (seconds)
- Kept `foregroundTime`: Active viewing time
- Kept `backgroundTime`: For historical data only (no longer accumulated)

#### Updated `SessionState`:
- Added `currentSessionId`: Current browser session
- Added `lastStateChangeTime`: When focus/idle changed
- Added time tracking for focused/unfocused states

---

### 2. **Extension - Time Tracking Logic**

#### Key Changes in `timeTracker.ts`:

**Old Behavior (Broken):**
```typescript
// Every 1 minute:
// - ALL open tabs got background time (inflated total)
// - Only tracked when Chrome focused
// - No tracking when in VSCode, etc.
```

**New Behavior (Correct):**
```typescript
// Every 1 minute:
if (user is idle) {
    → Track idle time (added to session.idleTime)
} else if (Chrome not focused) {
    → Track unfocused time (user in VSCode, etc.)
} else {
    → Track focused time
    → Update ONLY active tab's foreground time
    → Check if tab is audible (audio/video playing)
}
```

**Removal:**
- ❌ Removed background time accumulation loop
- ❌ Removed in-memory tab tracker dependency (queries on-demand)

**Verification Math:**
```
✓ session.totalTime = focusedTime + unfocusedTime + idleTime
✓ Σ(all domain.foregroundTime) ≤ session.focusedTime (approximately equal)
```

---

### 3. **Extension - Session Manager**

New file: `src/utils/sessionManager.ts`

**Functions:**
- `startBrowserSession()`: Called on Chrome open/extension install
- `endBrowserSession()`: Called on Chrome close (service worker shutdown)
- `resumeSessionIfExists()`: Handles service worker restarts
- `updateSessionStats()`: Accumulates focused/unfocused/idle time
- `getCurrentSession()`, `getAllSessions()`: Data access

**Session Lifecycle:**
```
Chrome Opens → startBrowserSession()
  ↓
[Service Worker Restarts] → resumeSessionIfExists()
  ↓
Chrome Closes → endBrowserSession()
  ↓
Session saved to storage.sessions[sessionId]
```

---

### 4. **Extension - Background Worker Updates**

Updated `src/pages/background/index.ts`:

```typescript
onInstalled → startBrowserSession()
onStartup → resumeSessionIfExists()
beforeunload → endBrowserSession()
```

**Time Tracking Hooks:**
- Tab switch → Accumulate time immediately
- Window blur → Track as unfocused time
- Idle state → Track as idle time
- Every 1 minute → Accumulate all time types

---

### 5. **Extension - Sync Updates**

Updated `src/utils/syncManager.ts`:

**Activity Sync:**
- Added `audibleTime` field
- Added `sessionId` field

**Session Sync (NEW):**
- `collectSessionsForSync()`: Gathers last 7 days of sessions
- Syncs sessions separately from activities
- Includes device metadata

---

### 6. **Backend - Database Schema**

Updated `apps/nextjs/src/server/db/schema.ts`:

#### New Table: `extension_session`
```sql
CREATE TABLE extension_session (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  deviceId TEXT NOT NULL,
  sessionId TEXT UNIQUE NOT NULL,
  startTime TIMESTAMP NOT NULL,
  endTime TIMESTAMP,
  focusedTime INTEGER DEFAULT 0,
  unfocusedTime INTEGER DEFAULT 0,
  idleTime INTEGER DEFAULT 0,
  totalTime INTEGER DEFAULT 0,
  tabCount INTEGER DEFAULT 0,
  domainCount INTEGER DEFAULT 0,
  deviceName TEXT,
  ...
)
```

#### Updated Table: `extension_activity`
- Added `sessionId TEXT` (FK to extension_session)
- Added `audibleTime INTEGER DEFAULT 0`
- Updated relations to link to sessions

---

### 7. **Backend - API Endpoints**

#### Updated: `/api/extension/sync` (Activities)
- Added `audibleTime` validation and storage
- Added `sessionId` validation and storage
- Merges audible time on duplicate records

#### NEW: `/api/extension/sync/sessions`
File: `apps/nextjs/src/app/api/extension/sync/sessions/route.ts`

**Features:**
- Validates session data with Zod
- Upserts sessions (insert new or update existing)
- Handles ongoing sessions (endTime = null)
- Updates max tab/domain counts
- Returns sync stats

---

## 🎯 Verification & Benefits

### Verification Math (Now Possible):

```javascript
// Session Level:
assert(session.totalTime === 
  session.focusedTime + session.unfocusedTime + session.idleTime)

// Domain Level:
const sumForeground = domains.reduce((sum, d) => sum + d.foregroundTime, 0)
assert(sumForeground <= session.focusedTime + TOLERANCE)
```

### Benefits:

1. **Accurate Total Time**: Wall-clock Chrome active time (not inflated)
2. **Unfocused Tracking**: Knows when you're in VSCode, not just "paused"
3. **Session Context**: Can analyze per-session behavior
4. **Audible Tracking**: Identifies video/audio consumption
5. **Verifiable**: Math adds up, can debug tracking issues
6. **Multi-Device**: Sessions track per device

---

## 📊 Data Flow

```
Extension:
  Browser Opens → startBrowserSession()
  Every 1 min → accumulateTime()
    ├─ If focused → foregroundTime++, session.focusedTime++
    ├─ If unfocused → session.unfocusedTime++
    └─ If idle → session.idleTime++
  Browser Closes → endBrowserSession()
  
Storage:
  sessions: { [sessionId]: BrowserSession }
  todayActivity: {
    chromeFocusedTime: total focused seconds
    chromeUnfocusedTime: total unfocused seconds
    domains: { [domain]: { foregroundTime, audibleTime, sessionId } }
  }

Sync (every hour):
  → POST /api/extension/sync { activities: [...] }
  → POST /api/extension/sync/sessions { sessions: [...] }
  
Backend:
  extension_session table
  extension_activity table (with sessionId FK)
```

---

## 🔧 Migration Notes

### For Existing Users:

**Extension:**
- Old data format automatically migrates on load
- `backgroundTime` preserved but no longer accumulated
- New fields default to 0

**Backend:**
- Need to run migration to add new columns:
  - `extension_activity.sessionId`
  - `extension_activity.audibleTime`
  - Create `extension_session` table

**Migration SQL:**
```sql
-- Add sessionId column
ALTER TABLE extension_activity ADD COLUMN sessionId TEXT;

-- Add audibleTime column  
ALTER TABLE extension_activity ADD COLUMN audibleTime INTEGER DEFAULT 0 NOT NULL;

-- Create index
CREATE INDEX ext_activity_session_id_idx ON extension_activity(sessionId);

-- Create extension_session table (see schema.ts for full definition)
```

---

## 🐛 Testing Checklist

- [ ] Extension installs → session starts
- [ ] Browser restart → session resumes or starts new
- [ ] Switch to VSCode → unfocusedTime increments
- [ ] Return to Chrome → focusedTime resumes
- [ ] Go idle 5 min → idleTime increments
- [ ] Play YouTube video → audibleTime tracks
- [ ] Close browser → session ends
- [ ] Sync runs → sessions and activities upload
- [ ] Backend stores sessions correctly
- [ ] Verification math passes: `focusedTime + unfocusedTime + idleTime = totalTime`

---

## 📝 Known Limitations

1. **Service Worker Lifecycle**: Chrome can terminate worker, but we handle it with persisted timestamps
2. **1-Minute Granularity**: ±60 seconds max error (acceptable trade-off for low CPU)
3. **Background Time**: Still stored but no longer accumulated (for historical compatibility)
4. **Audible Detection**: Only checks every minute (may miss brief audio)

---

## 🚀 Next Steps (Future Enhancements)

1. **UI Updates**: Display session stats in dashboard
2. **Analytics**: Session-based productivity insights
3. **Verification UI**: Show verification math in UI
4. **Background Calculation**: Derive background = session_duration - foreground (not stored)
5. **Category Tracking**: Add site categories (work/social/entertainment)

---

**Implementation Date**: January 11, 2026
**Status**: ✅ Complete and Ready for Testing
