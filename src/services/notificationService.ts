import type { Alert, AlertConfig } from '../types/crypto'

export class NotificationService {
  private audioContext: AudioContext | null = null
  private notificationPermission: NotificationPermission = 'default'

  constructor() {
    this.initializeAudioContext()
    this.requestNotificationPermission()
    this.setupAudioResume()
  }

  private initializeAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    } catch (error) {
      console.error('Audio context not supported:', error)
    }
  }

  /**
   * Setup audio context resume on user interaction
   * Required for browsers that block autoplay
   */
  private setupAudioResume() {
    const resumeAudio = () => {
      if (this.audioContext && this.audioContext.state === 'suspended') {
        this.audioContext.resume().then(() => {
          console.log('Audio context resumed successfully')
        })
      }
    }

    // Resume on various user interactions
    const events = ['click', 'touchstart', 'keydown']
    events.forEach(event => {
      document.addEventListener(event, resumeAudio, { once: true })
    })
  }

  /**
   * Ensure audio context is ready before playing
   */
  private async ensureAudioReady(): Promise<boolean> {
    if (!this.audioContext) {
      console.warn('Audio context not available')
      return false
    }

    if (this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume()
        console.log('Audio context resumed for alert')
      } catch (error) {
        console.error('Failed to resume audio context:', error)
        return false
      }
    }

    return true
  }

  async requestNotificationPermission() {
    if ('Notification' in window) {
      this.notificationPermission = await Notification.requestPermission()
    }
  }

  /**
   * Play EPIC alert sound - Movie trailer style!
   * @param config Alert configuration
   */
  async playAlertSound(config: AlertConfig) {
    if (!config.enableSound) {
      return
    }

    // Ensure audio context is ready
    const isReady = await this.ensureAudioReady()
    if (!isReady || !this.audioContext) {
      console.warn('Audio context not ready for alert sound')
      return
    }

    try {
      const now = this.audioContext.currentTime

      // Create an epic multi-layered sound effect
      // Sound 1: Deep bass drop (BWOOOOM!)
      const bass = this.audioContext.createOscillator()
      const bassGain = this.audioContext.createGain()
      bass.connect(bassGain)
      bassGain.connect(this.audioContext.destination)
      bass.type = 'sawtooth'
      bass.frequency.setValueAtTime(80, now)
      bass.frequency.exponentialRampToValueAtTime(40, now + 0.5)
      bassGain.gain.setValueAtTime(0.6, now)
      bassGain.gain.exponentialRampToValueAtTime(0.01, now + 0.5)
      bass.start(now)
      bass.stop(now + 0.5)

      // Sound 2: Rising sweep (anticipation build)
      const sweep = this.audioContext.createOscillator()
      const sweepGain = this.audioContext.createGain()
      sweep.connect(sweepGain)
      sweepGain.connect(this.audioContext.destination)
      sweep.type = 'sine'
      sweep.frequency.setValueAtTime(300, now + 0.1)
      sweep.frequency.exponentialRampToValueAtTime(1200, now + 0.4)
      sweepGain.gain.setValueAtTime(0.3, now + 0.1)
      sweepGain.gain.linearRampToValueAtTime(0.5, now + 0.3)
      sweepGain.gain.linearRampToValueAtTime(0.01, now + 0.4)
      sweep.start(now + 0.1)
      sweep.stop(now + 0.4)

      // Sound 3: Impact hit (the drop!)
      const impact = this.audioContext.createOscillator()
      const impactGain = this.audioContext.createGain()
      impact.connect(impactGain)
      impactGain.connect(this.audioContext.destination)
      impact.type = 'square'
      impact.frequency.setValueAtTime(150, now + 0.4)
      impactGain.gain.setValueAtTime(0.8, now + 0.4)
      impactGain.gain.exponentialRampToValueAtTime(0.01, now + 0.7)
      impact.start(now + 0.4)
      impact.stop(now + 0.7)

      // Sound 4: Bell/chime cascade (money raining sound!)
      for (let i = 0; i < 5; i++) {
        const bell = this.audioContext.createOscillator()
        const bellGain = this.audioContext.createGain()
        bell.connect(bellGain)
        bellGain.connect(this.audioContext.destination)
        bell.type = 'sine'
        const frequency = 800 + i * 200 // Ascending notes
        bell.frequency.setValueAtTime(frequency, now + 0.5 + i * 0.08)
        bellGain.gain.setValueAtTime(0.4, now + 0.5 + i * 0.08)
        bellGain.gain.exponentialRampToValueAtTime(0.01, now + 0.7 + i * 0.08)
        bell.start(now + 0.5 + i * 0.08)
        bell.stop(now + 0.7 + i * 0.08)
      }

      // Sound 5: Victory fanfare
      const fanfare1 = this.audioContext.createOscillator()
      const fanfare1Gain = this.audioContext.createGain()
      fanfare1.connect(fanfare1Gain)
      fanfare1Gain.connect(this.audioContext.destination)
      fanfare1.type = 'triangle'
      fanfare1.frequency.setValueAtTime(659.25, now + 0.9) // E5
      fanfare1Gain.gain.setValueAtTime(0.5, now + 0.9)
      fanfare1Gain.gain.linearRampToValueAtTime(0.01, now + 1.2)
      fanfare1.start(now + 0.9)
      fanfare1.stop(now + 1.2)

      const fanfare2 = this.audioContext.createOscillator()
      const fanfare2Gain = this.audioContext.createGain()
      fanfare2.connect(fanfare2Gain)
      fanfare2Gain.connect(this.audioContext.destination)
      fanfare2.type = 'triangle'
      fanfare2.frequency.setValueAtTime(783.99, now + 1.0) // G5
      fanfare2Gain.gain.setValueAtTime(0.5, now + 1.0)
      fanfare2Gain.gain.linearRampToValueAtTime(0.01, now + 1.3)
      fanfare2.start(now + 1.0)
      fanfare2.stop(now + 1.3)

    } catch (error) {
      console.error('Error playing epic alert sound:', error)
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
   * Trigger EPIC money splash effect! 💰💵💸
   * @param duration Duration in milliseconds
   */
  triggerMoneySplash(duration: number = 4000) {
    // Create container for money elements
    const container = document.createElement('div')
    container.id = 'money-splash-container'
    container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      pointer-events: none;
      z-index: 9999;
      overflow: hidden;
    `

    // Money emojis to rain down
    const moneySymbols = ['💵', '💰', '💸', '💴', '💶', '💷', '🤑', '💎', '🪙', '💲']

    // Create falling money elements
    for (let i = 0; i < 50; i++) {
      const money = document.createElement('div')
      const symbol = moneySymbols[Math.floor(Math.random() * moneySymbols.length)]

      money.textContent = symbol
      money.style.cssText = `
        position: absolute;
        font-size: ${Math.random() * 30 + 20}px;
        left: ${Math.random() * 100}vw;
        top: -50px;
        animation: money-fall ${Math.random() * 2 + 2}s linear forwards;
        animation-delay: ${Math.random() * 0.5}s;
        opacity: 0.9;
        transform: rotate(${Math.random() * 360}deg);
      `

      container.appendChild(money)
    }

    // Create style element for animations
    const style = document.createElement('style')
    style.textContent = `
      @keyframes money-fall {
        0% {
          transform: translateY(0) rotate(0deg);
          opacity: 1;
        }
        100% {
          transform: translateY(100vh) rotate(${Math.random() * 720 - 360}deg);
          opacity: 0.3;
        }
      }

      @keyframes flash-gold {
        0%, 100% {
          box-shadow: 0 0 0 rgba(255, 215, 0, 0);
        }
        50% {
          box-shadow: 0 0 100px rgba(255, 215, 0, 0.5),
                      0 0 200px rgba(255, 215, 0, 0.3),
                      inset 0 0 100px rgba(255, 215, 0, 0.2);
        }
      }

      #money-splash-container {
        animation: flash-gold 0.5s ease-in-out 3;
      }
    `

    document.head.appendChild(style)
    document.body.appendChild(container)

    // Create "ALERT!" text overlay
    const alertText = document.createElement('div')
    alertText.textContent = '🚨 CRYPTO ALERT! 🚨'
    alertText.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) scale(0);
      font-size: 72px;
      font-weight: bold;
      color: #FFD700;
      text-shadow:
        0 0 10px rgba(255, 215, 0, 1),
        0 0 20px rgba(255, 215, 0, 0.8),
        0 0 30px rgba(255, 215, 0, 0.6),
        3px 3px 10px rgba(0, 0, 0, 0.8);
      z-index: 10000;
      pointer-events: none;
      animation: alert-bounce 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards;
      white-space: nowrap;
    `

    const alertStyle = document.createElement('style')
    alertStyle.textContent = `
      @keyframes alert-bounce {
        0% {
          transform: translate(-50%, -50%) scale(0) rotate(-10deg);
          opacity: 0;
        }
        50% {
          transform: translate(-50%, -50%) scale(1.2) rotate(5deg);
        }
        100% {
          transform: translate(-50%, -50%) scale(1) rotate(0deg);
          opacity: 1;
        }
      }
    `
    document.head.appendChild(alertStyle)
    document.body.appendChild(alertText)

    // Cleanup
    setTimeout(() => {
      container.remove()
      style.remove()
      alertText.remove()
      alertStyle.remove()
    }, duration)
  }

  /**
   * Trigger visual strobe effect (legacy - keeping for compatibility)
   * @param duration Duration in milliseconds
   */
  triggerStrobeEffect(duration: number = 2000) {
    // Now triggers money splash instead!
    this.triggerMoneySplash(duration)
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
  async handleAlert(alert: Alert, config: AlertConfig) {
    await this.playAlertSound(config)
    this.showPushNotification(alert, config)
    this.triggerStrobeEffect(2000)
    this.sendWebhook(alert, config)
  }
}

export const notificationService = new NotificationService()
