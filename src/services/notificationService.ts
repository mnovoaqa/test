import type { Alert, AlertConfig } from '../types/crypto'

export class NotificationService {
  private audioContext: AudioContext | null = null
  private notificationPermission: NotificationPermission = 'default'

  constructor() {
    this.initializeAudioContext()
    this.requestNotificationPermission()
  }

  private initializeAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    } catch (error) {
      console.error('Audio context not supported:', error)
    }
  }

  async requestNotificationPermission() {
    if ('Notification' in window) {
      this.notificationPermission = await Notification.requestPermission()
    }
  }

  /**
   * Play alert sound
   * @param config Alert configuration
   */
  playAlertSound(config: AlertConfig) {
    if (!config.enableSound || !this.audioContext) {
      return
    }

    try {
      // Create oscillator for beep sound
      const oscillator = this.audioContext.createOscillator()
      const gainNode = this.audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(this.audioContext.destination)

      // Configure sound
      oscillator.frequency.value = 800 // Hz
      oscillator.type = 'sine'

      // Fade in/out for smooth sound
      const now = this.audioContext.currentTime
      gainNode.gain.setValueAtTime(0, now)
      gainNode.gain.linearRampToValueAtTime(0.3, now + 0.01)
      gainNode.gain.linearRampToValueAtTime(0, now + 0.3)

      oscillator.start(now)
      oscillator.stop(now + 0.3)
    } catch (error) {
      console.error('Error playing alert sound:', error)
    }
  }

  /**
   * Show browser push notification
   * @param alert Alert data
   * @param config Alert configuration
   */
  showPushNotification(alert: Alert, config: AlertConfig) {
    if (!config.enablePush || this.notificationPermission !== 'granted') {
      return
    }

    try {
      const notification = new Notification(`Crypto Alert: ${alert.coinSymbol}`, {
        body: alert.message,
        icon: '/crypto-icon.png',
        badge: '/crypto-badge.png',
        tag: alert.id,
        requireInteraction: true,
        data: alert,
      })

      notification.onclick = () => {
        window.focus()
        notification.close()
      }

      // Auto-close after 10 seconds
      setTimeout(() => {
        notification.close()
      }, 10000)
    } catch (error) {
      console.error('Error showing push notification:', error)
    }
  }

  /**
   * Trigger visual strobe effect
   * @param duration Duration in milliseconds
   */
  triggerStrobeEffect(duration: number = 2000) {
    const style = document.createElement('style')
    style.id = 'strobe-animation'
    style.textContent = `
      @keyframes strobe {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.3; }
      }
      .strobe-active {
        animation: strobe 0.3s ease-in-out infinite;
      }
    `
    document.head.appendChild(style)

    document.body.classList.add('strobe-active')

    setTimeout(() => {
      document.body.classList.remove('strobe-active')
      style.remove()
    }, duration)
  }

  /**
   * Send webhook notification
   * @param alert Alert data
   * @param config Alert configuration
   */
  async sendWebhook(alert: Alert, config: AlertConfig) {
    if (!config.enableWebhook || !config.webhookUrl) {
      return
    }

    try {
      await fetch(config.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          alert: alert,
          timestamp: new Date().toISOString(),
        }),
      })
    } catch (error) {
      console.error('Error sending webhook:', error)
    }
  }

  /**
   * Handle alert notification
   * @param alert Alert data
   * @param config Alert configuration
   */
  handleAlert(alert: Alert, config: AlertConfig) {
    this.playAlertSound(config)
    this.showPushNotification(alert, config)
    this.triggerStrobeEffect(2000)
    this.sendWebhook(alert, config)
  }
}

export const notificationService = new NotificationService()
