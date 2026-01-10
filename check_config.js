// Quick check of stored config
chrome.storage.local.get(['blockConfig'], (result) => {
  console.log('Block Config:', JSON.stringify(result.blockConfig, null, 2));
});
