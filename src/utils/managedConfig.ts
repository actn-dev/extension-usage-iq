/**
 * Reads admin-configured policy values from chrome.storage.managed
 * Values are set by the admin via Google Admin Console for force-installed extensions.
 * Users cannot modify these values.
 */

const MANAGED_KEY_ORG_KEY = 'organizationKey';

/**
 * Get the organization key set by admin via Google Admin Console policy.
 * This is used to authenticate all sync requests without requiring user login.
 */
export async function getOrgKey(): Promise<string | null> {
	try {
		const managed = await chrome.storage.managed.get(MANAGED_KEY_ORG_KEY);
		return managed[MANAGED_KEY_ORG_KEY] || null;
	} catch (error) {
		// chrome.storage.managed may throw if no managed storage schema is declared
		console.warn('Failed to read managed storage:', error);
		return null;
	}
}

/**
 * Check if admin has configured an organization key
 */
export async function hasOrgKey(): Promise<boolean> {
	const key = await getOrgKey();
	return !!key;
}
