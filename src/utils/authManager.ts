import { authClient } from "@src/lib/auth/auth-client";

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