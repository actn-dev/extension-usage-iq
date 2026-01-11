/**
 * API Client for communicating with Dodily backend
 */

export const API_BASE_URL = 'http://localhost:3000';
// export const API_BASE_URL = 'https://dodily-nextjs.vercel.app';
// For development: const API_BASE_URL = 'http://localhost:3000';

interface SyncResponse {
	success: boolean;
	syncedCount: number;
	failedCount: number;
	totalCount: number;
	duration: number;
}

interface ActivityRecord {
	date: string;
	domain: string;
	totalTime: number;
	foregroundTime: number;
	backgroundTime: number;
	visitCount: number;
	lastVisit: string;
	// Device identification
	deviceId: string;
	deviceName?: string;
	browserName?: string;
	browserVersion?: string;
	osName?: string;
	osVersion?: string;
}

export class ApiClient {
	private baseUrl: string;

	constructor(baseUrl: string = API_BASE_URL) {
		this.baseUrl = baseUrl;
	}

	/**
	 * Make authenticated API request
	 */
	private async request<T>(
		endpoint: string,
		options: RequestInit = {}
	): Promise<T> {
		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			...((options.headers as Record<string, string>) || {}),
		};

		const response = await fetch(`${this.baseUrl}${endpoint}`, {
			...options,
			credentials: 'include',
			headers,
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			throw new Error(
				errorData.message || `API request failed: ${response.statusText}`
			);
		}

		return response.json();
	}

	/**
	 * Sync activity data to server
	 */
	async syncActivities(activities: ActivityRecord[]): Promise<SyncResponse> {
		// Using Next.js API route (not tRPC)
		return this.request<SyncResponse>('/api/extension/sync', {
			method: 'POST',
			body: JSON.stringify({
				activities,
			}),
		});
	}
}

// Singleton instance
let apiClientInstance: ApiClient | null = null;

export function getApiClient(): ApiClient {
	if (!apiClientInstance) {
		apiClientInstance = new ApiClient();
	}
	return apiClientInstance;
}
