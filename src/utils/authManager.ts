import { authClient } from "@src/lib/auth/auth-client";

interface OrganizationInfo {
	id: string;
	name: string;
	slug: string;
}

const STORAGE_KEY_ACTIVE_ORG = 'activeOrganizationId';
const STORAGE_KEY_ACTIVE_ORG_SLUG = 'activeOrganizationSlug';
const STORAGE_KEY_USER_ORGS = 'userOrganizations';

export class AuthManager {
	/**
	 * Check if user is authenticated
	 */
	async isAuthenticated(): Promise<boolean> {
		const session = await authClient.getSession();
		return !!session;
	}

	/**
	 * Get user information
	 */
	async getUserInfo() {
		const session = await authClient.getSession();
		return session?.data?.user || null;
	}

	/**
	 * Get full session
	 */
	async getSession() {
		return await authClient.getSession();
	}

	/**
	 * Get user's organizations
	 */
	async getUserOrganizations(): Promise<OrganizationInfo[]> {
		try {
			const session = await this.getSession();
			if (!session?.data) return [];

			// Fetch organizations from server
			const orgs = await authClient.organization.list();
			
			if (!orgs?.data) return [];

			const organizations = orgs.data.map((org: any) => ({
				id: org.id,
				name: org.name,
				slug: org.slug,
			}));

			// Cache in storage
			await chrome.storage.local.set({
				[STORAGE_KEY_USER_ORGS]: organizations,
			});

			return organizations;
		} catch (error) {
			console.error('Failed to fetch organizations:', error);
			// Return cached if available
			const cached = await chrome.storage.local.get(STORAGE_KEY_USER_ORGS);
			return cached[STORAGE_KEY_USER_ORGS] || [];
		}
	}

	/**
	 * Get active organization ID
	 */
	async getActiveOrganizationId(): Promise<string | null> {
		const result = await chrome.storage.local.get(STORAGE_KEY_ACTIVE_ORG);
		return result[STORAGE_KEY_ACTIVE_ORG] || null;
	}

	/**
	 * Get active organization slug
	 */
	async getActiveOrganizationSlug(): Promise<string | null> {
		const result = await chrome.storage.local.get(STORAGE_KEY_ACTIVE_ORG_SLUG);
		return result[STORAGE_KEY_ACTIVE_ORG_SLUG] || null;
	}

	/**
	 * Get active organization info
	 */
	async getActiveOrganization(): Promise<OrganizationInfo | null> {
		try {
			const activeOrg = await authClient.useActiveOrganization();
			if (activeOrg?.data) {
				return {
					id: activeOrg.data.id,
					name: activeOrg.data.name,
					slug: activeOrg.data.slug,
				};
			}
		} catch (error) {
			console.error('Failed to get active organization:', error);
		}

		// Fallback to stored value
		const orgId = await this.getActiveOrganizationId();
		const orgSlug = await this.getActiveOrganizationSlug();
		const orgs = await this.getUserOrganizations();
		
		if (orgId) {
			const org = orgs.find(o => o.id === orgId);
			if (org) return org;
		}
		
		return null;
	}

	/**
	 * Set active organization
	 */
	async setActiveOrganization(organizationId: string, organizationSlug: string): Promise<boolean> {
		try {
			// Set on server via Better Auth
			const result = await authClient.organization.setActive({
				organizationId,
			});

			if (result?.data) {
				// Store locally
				await chrome.storage.local.set({
					[STORAGE_KEY_ACTIVE_ORG]: organizationId,
					[STORAGE_KEY_ACTIVE_ORG_SLUG]: organizationSlug,
				});
				return true;
			}
			return false;
		} catch (error) {
			console.error('Failed to set active organization:', error);
			return false;
		}
	}

	/**
	 * Clear active organization
	 */
	async clearActiveOrganization(): Promise<void> {
		await chrome.storage.local.remove([
			STORAGE_KEY_ACTIVE_ORG,
			STORAGE_KEY_ACTIVE_ORG_SLUG,
		]);
	}

	/**
	 * Check if user has selected an organization
	 */
	async hasActiveOrganization(): Promise<boolean> {
		const orgId = await this.getActiveOrganizationId();
		return !!orgId;
	}

	// Remove ALL token storage logic!
	// authClient handles cookies internally
}

// Singleton instance
let authManagerInstance: AuthManager | null = null;

export function getAuthManager(): AuthManager {
	if (!authManagerInstance) {
		authManagerInstance = new AuthManager();
	}
	return authManagerInstance;
}