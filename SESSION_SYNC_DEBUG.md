# Session Sync Debugging Guide

## ✅ What Changed

**Before:** Two separate API endpoints
- `/api/extension/sync` - for activities only
- `/api/extension/sync/sessions` - for sessions only

**After:** ONE unified endpoint
- `/api/extension/sync` - handles BOTH activities AND sessions in one request

## 🔍 Why Sessions Weren't Synced Before

The most likely reasons:

### 1. **No Sessions in Storage** (Most Likely)
Check if sessions are being created:
```javascript
// Open DevTools Console in your extension
chrome.storage.local.get(['sessions', 'currentSession'], (result) => {
  console.log('Current Session:', result.currentSession);
  console.log('All Sessions:', result.sessions);
});
```

**Expected output:**
```javascript
Current Session: {
  sessionId: "1736611200000-abc123",
  startTime: 1736611200000,
  endTime: null,
  focusedTime: 1234,
  unfocusedTime: 567,
  idleTime: 89,
  totalTime: 1890,
  tabCount: 5,
  domainCount: 3
}

All Sessions: {
  "1736611200000-abc123": { ... },
  "1736524800000-def456": { ... }
}
```

### 2. **Sessions Older Than 7 Days**
Only sessions from the last 7 days are synced. Check:
```javascript
const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
chrome.storage.local.get('sessions', (result) => {
  const recentSessions = Object.values(result.sessions || {})
    .filter(s => s.startTime >= sevenDaysAgo);
  console.log('Recent sessions:', recentSessions.length);
});
```

### 3. **Session Manager Not Initialized**
Check if background script started sessions:
```javascript
// In background service worker console
console.log('Extension initialized:', !!chrome.runtime.id);
```

## 🛠️ How to Test the New Unified Sync

### Step 1: Reload Extension
```bash
# In Chrome
1. Go to chrome://extensions/
2. Find UsageIQ extension
3. Click reload icon
```

### Step 2: Open DevTools for Extension
```bash
# In Chrome extensions page
1. Click "Details" on UsageIQ
2. Scroll to "Inspect views"
3. Click "service worker" or "background page"
```

### Step 3: Manually Trigger Sync
In the background worker console:
```javascript
// Get sync manager and manually sync
const { getSyncManager } = await import('./utils/syncManager.js');
const syncManager = getSyncManager();
const result = await syncManager.syncNow();
console.log('Sync result:', result);
```

### Step 4: Check What Was Synced
You should see output like:
```
Syncing 7 activity records and 2 sessions...
Sync completed: {
  success: true,
  syncedCount: 9,
  failedCount: 0,
  sessionsSynced: 2,
  activitiesSynced: 7
}
```

## 🔧 Fix: Ensure Sessions Are Created

If no sessions exist, the session manager might not be initialized. Check:

### In background/index.ts:
```typescript
// Should have these calls:
import { startBrowserSession, resumeSessionIfExists } from './sessionManager';

chrome.runtime.onInstalled.addListener(async () => {
  await startBrowserSession(); // ✓ Creates session
});

chrome.runtime.onStartup.addListener(async () => {
  await resumeSessionIfExists(); // ✓ Resumes or creates session
});
```

### Manual Fix (if needed):
```javascript
// In background worker console
const { startBrowserSession } = await import('./utils/sessionManager.js');
await startBrowserSession();
console.log('Session created!');
```

## 📊 Verify Sync on Server

After syncing, check the database:

```sql
-- Check if sessions were created
SELECT COUNT(*) as session_count 
FROM extension_session 
WHERE userId = 'your-user-id';

-- Check recent sessions
SELECT sessionId, startTime, endTime, focusedTime, totalTime 
FROM extension_session 
WHERE userId = 'your-user-id'
ORDER BY startTime DESC 
LIMIT 5;

-- Check activities linked to sessions
SELECT sessionId, COUNT(*) as activity_count
FROM extension_activity 
WHERE userId = 'your-user-id' AND sessionId IS NOT NULL
GROUP BY sessionId;
```

## 🎯 Quick Checklist

- [ ] Extension reloaded after code changes
- [ ] Background worker is active (check service worker status)
- [ ] Sessions exist in chrome.storage.local
- [ ] Sessions are less than 7 days old
- [ ] Sync triggered (auto or manual)
- [ ] Check console logs for errors
- [ ] Verify data in database

## 💡 Common Issues

### Issue: "No data to sync"
**Cause:** No sessions or activities in storage
**Fix:** Browse some websites, wait a minute, then sync

### Issue: "Sync already in progress"
**Cause:** Previous sync is still running
**Fix:** Wait 30 seconds and try again

### Issue: "Unauthorized"
**Cause:** Not logged in to the web app
**Fix:** Log in at localhost:3000, then reload extension

### Issue: Sessions show but don't sync
**Cause:** Old code cached in browser
**Fix:** 
1. Clear browser cache
2. Reload extension
3. Restart Chrome
