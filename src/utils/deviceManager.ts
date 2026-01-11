/**
 * Device Manager for Extension
 * Generates and manages unique device identification
 */

export interface DeviceInfo {
	deviceId: string;
	deviceName: string;
	browserName: string;
	browserVersion: string;
	osName: string;
	osVersion: string;
}

export class DeviceManager {
	private static STORAGE_KEY = 'deviceId';
	private static DEVICE_INFO_KEY = 'deviceInfo';

	/**
	 * Get or create unique device ID
	 * Persists across browser sessions
	 */
	static async getDeviceId(): Promise<string> {
		const result = await chrome.storage.local.get(this.STORAGE_KEY);

		if (result[this.STORAGE_KEY]) {
			return result[this.STORAGE_KEY] as string;
		}

		// Generate new UUID for this installation
		const deviceId = crypto.randomUUID();
		await chrome.storage.local.set({ [this.STORAGE_KEY]: deviceId });

		console.log('New device ID generated:', deviceId);
		return deviceId;
	}

	/**
	 * Get complete device information
	 */
	static async getDeviceInfo(): Promise<DeviceInfo> {
		const deviceId = await this.getDeviceId();

		// Get browser info
		const platformInfo = await chrome.runtime.getPlatformInfo();
		const manifest = chrome.runtime.getManifest();

		// Try to get custom device name or generate default
		let deviceName = await this.getDeviceName();
		if (!deviceName) {
			deviceName = this.generateDefaultDeviceName(platformInfo.os);
			await this.setDeviceName(deviceName);
		}

		return {
			deviceId,
			deviceName,
			browserName: this.getBrowserName(),
			browserVersion: manifest.version,
			osName: this.getOSName(platformInfo.os),
			osVersion: platformInfo.nacl_arch || '', // Best approximation available
		};
	}

	/**
	 * Get device name
	 */
	static async getDeviceName(): Promise<string | null> {
		const result = await chrome.storage.local.get(this.DEVICE_INFO_KEY);
		return result[this.DEVICE_INFO_KEY]?.deviceName || null;
	}

	/**
	 * Set custom device name
	 */
	static async setDeviceName(name: string): Promise<void> {
		const current = await chrome.storage.local.get(this.DEVICE_INFO_KEY);
		await chrome.storage.local.set({
			[this.DEVICE_INFO_KEY]: {
				...current[this.DEVICE_INFO_KEY],
				deviceName: name,
			},
		});
	}

	/**
	 * Generate a default device name based on OS
	 */
	private static generateDefaultDeviceName(os: string): string {
		const osName = this.getOSName(os);
		const browserName = this.getBrowserName();
		return `${osName} ${browserName}`;
	}

	/**
	 * Detect browser name
	 */
	private static getBrowserName(): string {
		const userAgent = navigator.userAgent;
		if (userAgent.includes('Edg/')) return 'Edge';
		if (userAgent.includes('Chrome/')) return 'Chrome';
		if (userAgent.includes('Firefox/')) return 'Firefox';
		if (userAgent.includes('Safari/')) return 'Safari';
		return 'Browser';
	}

	/**
	 * Get user-friendly OS name
	 */
	private static getOSName(os: string): string {
		const osMap: Record<string, string> = {
			mac: 'macOS',
			win: 'Windows',
			linux: 'Linux',
			cros: 'Chrome OS',
			android: 'Android',
			openbsd: 'OpenBSD',
		};
		return osMap[os] || os;
	}

	/**
	 * Reset device ID (for troubleshooting)
	 */
	static async resetDeviceId(): Promise<void> {
		await chrome.storage.local.remove([this.STORAGE_KEY, this.DEVICE_INFO_KEY]);
		console.log('Device ID reset');
	}
}

// Export singleton functions for convenience
export const getDeviceId = () => DeviceManager.getDeviceId();
export const getDeviceInfo = () => DeviceManager.getDeviceInfo();
export const setDeviceName = (name: string) => DeviceManager.setDeviceName(name);
export const resetDeviceId = () => DeviceManager.resetDeviceId();
