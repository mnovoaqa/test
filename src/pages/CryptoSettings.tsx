import { useState } from 'react'
import { useCryptoStore } from '../stores/cryptoStore'
import type { AlertConfig } from '../types/crypto'

export default function CryptoSettings() {
  const { settings, updateSettings } = useCryptoStore()
  const [alertConfig, setAlertConfig] = useState<AlertConfig>(settings.defaultAlertConfig)

  const handleSave = () => {
    updateSettings({
      defaultAlertConfig: alertConfig,
    })
    alert('Settings saved successfully!')
  }

  const handleReset = () => {
    const defaultConfig: AlertConfig = {
      priceChangeThreshold: 3,
      priceChangeWindow: 5,
      volumeSpike: 200,
      rsiOversold: 30,
      rsiOverbought: 70,
      enableSound: true,
      enablePush: true,
      enableWebhook: false,
      webhookUrl: '',
    }
    setAlertConfig(defaultConfig)
  }

  const handleThemeToggle = () => {
    const newTheme = settings.theme === 'dark' ? 'light' : 'dark'
    updateSettings({ theme: newTheme })
    document.documentElement.setAttribute('data-theme', newTheme)
  }

  return (
    <div className="crypto-settings">
      <div className="settings-header">
        <h1>Settings</h1>
        <p className="settings-description">Configure your alert preferences and dashboard settings</p>
      </div>

      <div className="settings-sections">
        <section className="settings-section">
          <h2>Appearance</h2>
          <div className="setting-item">
            <div className="setting-info">
              <label>Theme</label>
              <p className="setting-description">Switch between light and dark mode</p>
            </div>
            <button onClick={handleThemeToggle} className="theme-toggle-btn">
              {settings.theme === 'dark' ? '🌙 Dark' : '☀️ Light'}
            </button>
          </div>
        </section>

        <section className="settings-section">
          <h2>Alert Configuration</h2>

          <div className="setting-item">
            <div className="setting-info">
              <label htmlFor="price-threshold">Price Change Threshold (%)</label>
              <p className="setting-description">
                Trigger alert when price changes by this percentage
              </p>
            </div>
            <input
              id="price-threshold"
              type="number"
              step="0.1"
              min="0"
              value={alertConfig.priceChangeThreshold}
              onChange={(e) =>
                setAlertConfig({
                  ...alertConfig,
                  priceChangeThreshold: parseFloat(e.target.value),
                })
              }
              className="settings-input"
            />
          </div>

          <div className="setting-item">
            <div className="setting-info">
              <label htmlFor="time-window">Time Window (minutes)</label>
              <p className="setting-description">Time period to check for price changes</p>
            </div>
            <input
              id="time-window"
              type="number"
              min="1"
              value={alertConfig.priceChangeWindow}
              onChange={(e) =>
                setAlertConfig({
                  ...alertConfig,
                  priceChangeWindow: parseInt(e.target.value),
                })
              }
              className="settings-input"
            />
          </div>

          <div className="setting-item">
            <div className="setting-info">
              <label htmlFor="volume-spike">Volume Spike Threshold (%)</label>
              <p className="setting-description">
                Trigger alert when volume exceeds average by this percentage
              </p>
            </div>
            <input
              id="volume-spike"
              type="number"
              min="0"
              value={alertConfig.volumeSpike}
              onChange={(e) =>
                setAlertConfig({
                  ...alertConfig,
                  volumeSpike: parseFloat(e.target.value),
                })
              }
              className="settings-input"
            />
          </div>

          <div className="setting-item">
            <div className="setting-info">
              <label htmlFor="rsi-oversold">RSI Oversold Level</label>
              <p className="setting-description">Alert when RSI drops below this value</p>
            </div>
            <input
              id="rsi-oversold"
              type="number"
              min="0"
              max="100"
              value={alertConfig.rsiOversold}
              onChange={(e) =>
                setAlertConfig({
                  ...alertConfig,
                  rsiOversold: parseFloat(e.target.value),
                })
              }
              className="settings-input"
            />
          </div>

          <div className="setting-item">
            <div className="setting-info">
              <label htmlFor="rsi-overbought">RSI Overbought Level</label>
              <p className="setting-description">Alert when RSI rises above this value</p>
            </div>
            <input
              id="rsi-overbought"
              type="number"
              min="0"
              max="100"
              value={alertConfig.rsiOverbought}
              onChange={(e) =>
                setAlertConfig({
                  ...alertConfig,
                  rsiOverbought: parseFloat(e.target.value),
                })
              }
              className="settings-input"
            />
          </div>
        </section>

        <section className="settings-section">
          <h2>Notification Preferences</h2>

          <div className="setting-item">
            <div className="setting-info">
              <label>Sound Alerts</label>
              <p className="setting-description">Play sound when alerts are triggered</p>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={alertConfig.enableSound}
                onChange={(e) =>
                  setAlertConfig({
                    ...alertConfig,
                    enableSound: e.target.checked,
                  })
                }
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="setting-item">
            <div className="setting-info">
              <label>Push Notifications</label>
              <p className="setting-description">Show browser notifications for alerts</p>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={alertConfig.enablePush}
                onChange={(e) =>
                  setAlertConfig({
                    ...alertConfig,
                    enablePush: e.target.checked,
                  })
                }
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="setting-item">
            <div className="setting-info">
              <label>Webhook Integration</label>
              <p className="setting-description">Send alerts to a webhook URL</p>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={alertConfig.enableWebhook}
                onChange={(e) =>
                  setAlertConfig({
                    ...alertConfig,
                    enableWebhook: e.target.checked,
                  })
                }
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          {alertConfig.enableWebhook && (
            <div className="setting-item">
              <div className="setting-info">
                <label htmlFor="webhook-url">Webhook URL</label>
                <p className="setting-description">URL to receive webhook notifications</p>
              </div>
              <input
                id="webhook-url"
                type="url"
                placeholder="https://example.com/webhook"
                value={alertConfig.webhookUrl || ''}
                onChange={(e) =>
                  setAlertConfig({
                    ...alertConfig,
                    webhookUrl: e.target.value,
                  })
                }
                className="settings-input full-width"
              />
            </div>
          )}
        </section>

        <div className="settings-actions">
          <button onClick={handleSave} className="save-settings-btn">
            Save Settings
          </button>
          <button onClick={handleReset} className="reset-settings-btn">
            Reset to Defaults
          </button>
        </div>
      </div>
    </div>
  )
}
