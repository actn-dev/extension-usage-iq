/**
 * Content Script Time Tracker
 * Sends heartbeats to background for accurate time tracking
 */

import { extractDomain, shouldTrackUrl } from '../types';

const HEARTBEAT_INTERVAL = 1000; // 1 second

interface HeartbeatMessage {
  type: 'heartbeat';
  url: string;
  domain: string;
  timestamp: number;
  visible: boolean;
}

interface VisibilityChangeMessage {
  type: 'visibilityChange';
  url: string;
  domain: string;
  visible: boolean;
  timestamp: number;
}

class TimeTracker {
  private intervalId: NodeJS.Timeout | null = null;
  private isTracking = false;
  private currentUrl: string;
  private currentDomain: string | null;

  constructor() {
    this.currentUrl = window.location.href;
    this.currentDomain = extractDomain(this.currentUrl);
    console.log(`[TRACKING-CS] Content script constructor at ${Date.now()} for ${this.currentDomain}`);
    this.init();
  }

  private init(): void {
    // Start tracking if page is currently visible
    if (document.visibilityState === 'visible' && this.shouldTrack()) {
      console.log(`[TRACKING-CS] Page visible on init, starting tracking at ${Date.now()}`);
      this.startTracking();
    } else {
      console.log(`[TRACKING-CS] Page NOT visible on init: visibilityState=${document.visibilityState}, shouldTrack=${this.shouldTrack()}`);
    }

    // Listen for visibility changes
    document.addEventListener('visibilitychange', () => this.handleVisibilityChange());

    // Listen for URL changes (for SPAs)
    this.observeUrlChanges();

    console.log('[TRACKING-CS] Initialized for:', this.currentDomain);
  }

  private shouldTrack(): boolean {
    return !!(this.currentDomain && shouldTrackUrl(this.currentUrl));
  }

  private handleVisibilityChange(): void {
    const isVisible = document.visibilityState === 'visible';
    
    console.log('[TimeTracker] Visibility changed:', isVisible);

    // Send visibility change notification
    this.sendVisibilityChange(isVisible);

    if (isVisible && this.shouldTrack()) {
      this.startTracking();
    } else {
      this.stopTracking();
    }
  }

  private startTracking(): void {
    if (this.isTracking) return;

    const startTime = Date.now();
    console.log(`[TRACKING-CS] Starting heartbeat for: ${this.currentDomain} at ${startTime}`);
    this.isTracking = true;

    // Send initial heartbeat immediately
    console.log(`[TRACKING-CS] Sending FIRST heartbeat at ${Date.now()}`);
    this.sendHeartbeat();

    // Set up interval for subsequent heartbeats
    this.intervalId = setInterval(() => {
      this.sendHeartbeat();
    }, HEARTBEAT_INTERVAL);
  }

  private stopTracking(): void {
    if (!this.isTracking) return;

    console.log('[TimeTracker] Stopping heartbeat for:', this.currentDomain);
    this.isTracking = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private sendHeartbeat(): void {
    if (!this.currentDomain) return;

    const sendTime = Date.now();
    const message: HeartbeatMessage = {
      type: 'heartbeat',
      url: this.currentUrl,
      domain: this.currentDomain,
      timestamp: sendTime,
      visible: document.visibilityState === 'visible',
    };

    chrome.runtime.sendMessage(message)
      .then(() => {
        // Only log first few heartbeats to avoid spam
        if (!this.isTracking || Math.random() < 0.05) { // 5% sampling
          console.log(`[TRACKING-CS] Heartbeat sent successfully for ${this.currentDomain} at ${sendTime}`);
        }
      })
      .catch((error) => {
        console.error(`[TRACKING-CS] Heartbeat FAILED at ${sendTime}:`, error.message);
        // Extension might be reloading or unloaded
        if (error.message?.includes('Extension context invalidated')) {
          this.stopTracking();
        }
      });
  }

  private sendVisibilityChange(visible: boolean): void {
    if (!this.currentDomain) return;

    const message: VisibilityChangeMessage = {
      type: 'visibilityChange',
      url: this.currentUrl,
      domain: this.currentDomain,
      visible,
      timestamp: Date.now(),
    };

    chrome.runtime.sendMessage(message).catch(() => {
      // Ignore errors (extension might be reloading)
    });
  }

  private observeUrlChanges(): void {
    // For SPAs that change URL without page reload
    let lastUrl = this.currentUrl;

    const checkUrlChange = () => {
      const newUrl = window.location.href;
      if (newUrl !== lastUrl) {
        console.log('[TimeTracker] URL changed:', newUrl);
        lastUrl = newUrl;
        this.handleUrlChange(newUrl);
      }
    };

    // Check every second (cheap operation)
    setInterval(checkUrlChange, 1000);

    // Also listen to navigation events
    window.addEventListener('popstate', checkUrlChange);
    window.addEventListener('hashchange', checkUrlChange);
  }

  private handleUrlChange(newUrl: string): void {
    const wasTracking = this.isTracking;
    
    // Stop current tracking
    this.stopTracking();

    // Update URL and domain
    this.currentUrl = newUrl;
    this.currentDomain = extractDomain(newUrl);

    // Resume tracking if was tracking and should still track
    if (wasTracking && document.visibilityState === 'visible' && this.shouldTrack()) {
      this.startTracking();
    }
  }
}

// Initialize tracker
new TimeTracker();
