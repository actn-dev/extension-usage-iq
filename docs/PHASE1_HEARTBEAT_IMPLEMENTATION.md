# Phase 1 Implementation: Heartbeat-Based Time Tracking

## 🎯 What Was Implemented

### Problem Solved
**Before:** 30+ second delay when switching tabs because Chrome alarms don't support sub-minute intervals reliably.

**After:** Instant tracking via content script heartbeats sent every 1 second.

---

## 📁 Files Created/Modified

### 1. **NEW: `/src/content-script/tracker.ts`**
Content script that runs on every page and sends heartbeats.

**Key Features:**
- Runs in each tab's page context
- Uses `setInterval(1000)` for reliable 1-second ticks
- Detects page visibility changes
- Sends heartbeat messages to background
- Handles URL changes (SPA support)
- Automatically stops when tab becomes hidden

**Message Types:**
```typescript
heartbeat: { domain, url, timestamp, visible }
visibilityChange: { domain, visible, timestamp }
```

### 2. **NEW: `/src/utils/heartbeatTracker.ts`**
Background handler for content script heartbeats.

**Validation Logic:**
- ✅ Window must be focused (not in VSCode/etc)
- ✅ User must not be idle
- ✅ Tab must be the active tab
- ✅ Domain must match tracked domain

**Action:** If all checks pass → Add 1 second to domain foreground time

### 3. **MODIFIED: `/src/pages/background/index.ts`**
Integrated heartbeat message handler.

**Changes:**
- Added import for `handleContentScriptMessage`
- Modified `trackTime` alarm to only handle unfocused/idle time
- Added message listener for heartbeat/visibilityChange messages

### 4. **MODIFIED: `/src/utils/timeTracker.ts`**
Separated alarm-based tracking from heartbeat-based tracking.

**New Function:**
- `accumulateUnfocusedIdleTime()` - Only tracks when Chrome unfocused or user idle
- Original `accumulateTime()` kept for backward compatibility but deprecated

### 5. **MODIFIED: `/manifest.json` & `/manifest.dev.json`**
Registered content script to run on all pages.

```json
"content_scripts": [{
  "matches": ["<all_urls>"],
  "js": ["src/content-script/tracker.ts"],
  "run_at": "document_start"
}]
```

---

## 🔄 How It Works

### Normal Flow (Tab Active & Window Focused)

```
Time T=0: User switches to youtube.com tab
├─ Content Script: Detects visibility change
│  └─ Starts setInterval, sends heartbeat every 1 second
│
├─ Background: chrome.tabs.onActivated fires
│  └─ Updates sessionState.activeTabId & activeDomain
│
Time T=1: First heartbeat arrives
├─ Background receives: { domain: 'youtube.com', timestamp }
│  ├─ Check: windowFocused? YES ✓
│  ├─ Check: isIdle? NO ✓
│  ├─ Check: activeTabId matches? YES ✓
│  └─ Action: Add 1 second to youtube.com foreground time
│
Time T=2, T=3, T=4... heartbeats continue
└─ Each second adds 1s to youtube.com foreground time
```

### When Window Loses Focus

```
Time T=10: User switches to VSCode
├─ Background: chrome.windows.onFocusChanged fires
│  └─ Updates sessionState.windowFocused = false
│
├─ Content Script: Continues sending heartbeats (doesn't know window lost focus)
│  └─ Sends: { domain: 'youtube.com', timestamp }
│
└─ Background receives heartbeat:
   ├─ Check: windowFocused? NO ✗
   └─ Action: IGNORE heartbeat
   
Alarm (runs every 1 sec):
└─ Calls accumulateUnfocusedIdleTime()
   └─ Adds time to session.unfocusedTime (not domain time)
```

---

## ⚠️ What's Different From Before

### Active Domain Time Tracking
| Before | After |
|--------|-------|
| Alarm-based (unreliable) | Heartbeat-based (reliable) |
| 30+ second delays | Instant (1 second precision) |
| Background service worker | Content script (per-tab) |
| Depends on service worker lifecycle | Independent of service worker |

### Unfocused/Idle Time Tracking
| Before | After |
|--------|-------|
| Alarm-based | Still alarm-based (unchanged) |
| Tracks Chrome focused, unfocused, idle | Same - no change |

### What Still Uses Alarms
- ✅ Unfocused time (when window not focused)
- ✅ Idle time (when user inactive)
- ✅ Daily rollover
- ✅ Time limit checks
- ✅ Block config sync

---

## 🧪 Testing Checklist

### Test 1: Tab Switch Delay
**Before:** 30+ second delay  
**Expected:** 1-2 seconds

1. Open youtube.com
2. Wait for tracking to start
3. Switch to different site
4. Check if time starts counting immediately

### Test 2: Window Focus
**Test:** Switch to VSCode, come back to Chrome
**Expected:** No time tracked while in VSCode, resumes when back

### Test 3: Idle Detection
**Test:** Leave computer for 5+ minutes
**Expected:** Time tracked as idle, not as active time

### Test 4: Multiple Tabs
**Test:** Open 5 tabs, switch between them
**Expected:** Only active tab gets foreground time

### Test 5: SPA Navigation
**Test:** Navigate within YouTube (different videos)
**Expected:** Continues tracking same domain

---

## 🚀 Benefits

1. **✅ Instant Tracking:** No more 30+ second delays
2. **✅ Accurate:** 1-second precision
3. **✅ Reliable:** Content script setInterval immune to service worker suspension
4. **✅ No Double Counting:** Clear separation - heartbeats handle active, alarms handle unfocused/idle
5. **✅ Backward Compatible:** Old tracking code still present (deprecated)

---

## 🔧 Configuration

### Debug Mode
Currently set to 1-second alarm intervals for both heartbeat validation and unfocused/idle tracking:

```typescript
// background/index.ts
const TIME_TRACKING_INTERVAL_SECONDS = 1; // For debugging
```

### Production Mode
For production, can increase alarm interval (unfocused/idle tracking):

```typescript
const TIME_TRACKING_INTERVAL_SECONDS = 60; // Check unfocused/idle every minute
```

**Note:** Heartbeat interval stays at 1 second regardless (in content script).

---

## 📊 Expected Results

### Before (Alarm-Based)
```
Switch to new tab at T=0:00
No tracking...
No tracking...
First time recorded at T=0:35 (35 second gap!)
```

### After (Heartbeat-Based)
```
Switch to new tab at T=0:00
Heartbeat at T=0:01 → +1s tracked ✓
Heartbeat at T=0:02 → +1s tracked ✓
Heartbeat at T=0:03 → +1s tracked ✓
...consistent 1-second tracking
```

---

## 🎯 Next Steps (Optional)

### Phase 2: Keep Existing Features
- Already working (no changes needed)

### Phase 3: Optional Background Time
- Add periodic query for non-active tabs
- Track background time if desired
- Currently not tracked (by design)

---

## 🐛 Known Limitations

1. **Content Script Injection Delay:** May miss first 100-500ms of page view (acceptable)
2. **iframe Support:** Each iframe gets own content script (minor overhead)
3. **Extension Reload:** Content scripts terminated, need page refresh to resume
4. **Chrome File URLs:** Content scripts don't run on file:// (Chrome restriction)

---

## 📝 Migration Notes

This is a **hybrid approach** - both systems coexist:
- Content scripts handle **active domain time**
- Alarms handle **unfocused/idle time**
- Old `accumulateTime()` deprecated but kept for compatibility

To fully remove old system (future):
- Delete deprecated `accumulateTime()` function
- Remove active domain tracking from alarm handler
- Clean up unused code paths
