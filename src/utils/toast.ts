// Simple toast notification utility without external dependencies

interface ToastOptions {
  description?: string;
  duration?: number;
}

class SimpleToast {
  private container: HTMLDivElement | null = null;

  private ensureContainer() {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'toast-container';
      this.container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        gap: 10px;
        pointer-events: none;
      `;
      document.body.appendChild(this.container);
    }
    return this.container;
  }

  private show(message: string, type: 'success' | 'error' | 'info', options: ToastOptions = {}) {
    const container = this.ensureContainer();
    const toast = document.createElement('div');
    
    const bgColor = type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6';
    const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
    
    toast.style.cssText = `
      background: ${bgColor};
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      min-width: 250px;
      max-width: 400px;
      pointer-events: auto;
      animation: slideIn 0.3s ease-out;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    const title = document.createElement('div');
    title.style.cssText = 'font-weight: 600; display: flex; align-items: center; gap: 8px;';
    title.innerHTML = `<span style="font-size: 16px;">${icon}</span> ${message}`;
    toast.appendChild(title);

    if (options.description) {
      const desc = document.createElement('div');
      desc.style.cssText = 'font-size: 13px; margin-top: 4px; opacity: 0.9;';
      desc.textContent = options.description;
      toast.appendChild(desc);
    }

    container.appendChild(toast);

    // Add slide-in animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      @keyframes slideOut {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(100%);
          opacity: 0;
        }
      }
    `;
    if (!document.getElementById('toast-animations')) {
      style.id = 'toast-animations';
      document.head.appendChild(style);
    }

    // Auto-remove after duration
    const duration = options.duration || 3000;
    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, duration);
  }

  success(message: string, options?: ToastOptions) {
    this.show(message, 'success', options);
  }

  error(message: string, options?: ToastOptions) {
    this.show(message, 'error', options);
  }

  info(message: string, options?: ToastOptions) {
    this.show(message, 'info', options);
  }
}

export const toast = new SimpleToast();
