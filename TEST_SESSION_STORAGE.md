# Test Session Storage in Extension

## Quick Check: Do Sessions Exist?

Open Chrome DevTools Console in your extension's service worker and run:

```javascript
// Check if sessions exist
chrome.storage.local.get(['sessions', 'currentSession'], (result) => {
  console.log('=== SESSION STORAGE CHECK ===');
  console.log('Current Session:', result.currentSession);
  console.log('All Sessions:', result.sessions);
  console.log('Session Count:', Object.keys(result.sessions || {}).length);
  console.log('===========================');
});
```

## If Sessions Are Empty

### Option 1: Manually Trigger Session Start
```javascript
// Import and start a session manually
const { startBrowserSession } = await import('./utils/sessionManager.js');
const sessionId = await startBrowserSession();
console.log('Session started:', sessionId);
```

### Option 2: Check Background Script Logs
Look for these messages in the service worker console:
- ✅ `"Browser session started: [sessionId]"` - Session created successfully
- ❌ If missing - Session manager not initialized

### Option 3: Check Extension Installation
Sessions are created on:
1. **Extension installation/update** - `chrome.runtime.onInstalled`
2. **Browser startup** - `chrome.runtime.onStartup`

If you installed the extension but never restarted Chrome, sessions might not exist yet.

**Solution:** Restart Chrome OR reload the extension

## Test the Unified Sync Endpoint

Once sessions exist, trigger a manual sync:

```javascript
// Trigger manual sync from popup/options page
chrome.runtime.sendMessage({ type: 'MANUAL_SYNC' }, (response) => {
  console.log('Sync result:', response);
});
```

**Expected Response:**
```json
{
  "success": true,
  "syncedCount": 10,
  "failedCount": 0,
  "totalCount": 10,
  "sessionsSynced": 3,
  "activitiesSynced": 7
}
```

## Verify on Backend

Check if sessions were synced to the database:

```bash
cd /home/ih/Code/nextjs/dodily/apps/nextjs

# Query sessions table
bun db:studio
# Then in Drizzle Studio, check extensionSession table
```

Or use the report page: http://localhost:3000/report (should show sessions if logged in)
