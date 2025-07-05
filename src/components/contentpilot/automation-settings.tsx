'use client';

import { useState, useEffect } from 'react';

interface AutomationSettings {
  schedule: string;
  enabled: boolean;
  nextRun: string | null;
}

export default function AutomationSettings() {
  const [settings, setSettings] = useState<AutomationSettings>({
    schedule: '0 8 * * *',
    enabled: false,
    nextRun: null
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/contentpilot/schedule');
      if (!response.ok) throw new Error('Failed to load automation settings');
      
      const data = await response.json();
      setSettings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      setError(null);
      
      const response = await fetch('/api/contentpilot/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      
      if (!response.ok) throw new Error('Failed to save automation settings');
      
      const data = await response.json();
      setSettings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const presetSchedules = [
    { label: 'Every Hour', value: '0 * * * *', description: 'Runs every hour' },
    { label: 'Every 4 Hours', value: '0 */4 * * *', description: 'Runs every 4 hours' },
    { label: 'Daily at 8 AM', value: '0 8 * * *', description: 'Runs daily at 8:00 AM' },
    { label: 'Daily at 6 PM', value: '0 18 * * *', description: 'Runs daily at 6:00 PM' },
    { label: 'Twice Daily', value: '0 8,20 * * *', description: 'Runs at 8 AM and 8 PM' },
    { label: 'Weekdays Only', value: '0 8 * * 1-5', description: 'Runs weekdays at 8 AM' },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 rounded animate-pulse w-1/3"></div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Automation Settings</h2>
        <p className="text-gray-600">Configure when ContentPilot should automatically gather intelligence and generate articles.</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="text-red-500 mr-2">⚠️</div>
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Enable/Disable Toggle */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Automated Intelligence Gathering</h3>
            <p className="text-gray-600 text-sm mt-1">
              Automatically scrape sources and generate articles based on your schedule
            </p>
          </div>
          <button
            onClick={() => setSettings({ ...settings, enabled: !settings.enabled })}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              settings.enabled ? 'bg-blue-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                settings.enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Schedule Configuration */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Schedule Configuration</h3>
        
        {/* Preset Schedules */}
        <div className="space-y-3 mb-6">
          <h4 className="text-sm font-medium text-gray-700">Quick Presets</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {presetSchedules.map((preset) => (
              <button
                key={preset.value}
                onClick={() => setSettings({ ...settings, schedule: preset.value })}
                className={`text-left p-3 rounded-lg border transition-colors ${
                  settings.schedule === preset.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-medium text-gray-900">{preset.label}</div>
                <div className="text-sm text-gray-600">{preset.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Custom Cron Expression */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-700">Custom Schedule (Cron Expression)</h4>
          <div className="flex space-x-3">
            <input
              type="text"
              value={settings.schedule}
              onChange={(e) => setSettings({ ...settings, schedule: e.target.value })}
              placeholder="0 8 * * *"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
            />
            <button
              onClick={() => window.open('https://crontab.guru/', '_blank')}
              className="px-4 py-2 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 text-sm"
            >
              Help
            </button>
          </div>
          <p className="text-xs text-gray-500">
            Format: minute hour day month day-of-week (e.g., &quot;0 8 * * *&quot; = daily at 8 AM)
          </p>
        </div>
      </div>

      {/* Status Information */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Status</h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Current Status:</span>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              settings.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
            }`}>
              {settings.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Schedule:</span>
            <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
              {settings.schedule}
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Next Run:</span>
            <span className="text-sm">
              {settings.nextRun 
                ? new Date(settings.nextRun).toLocaleString()
                : 'Not scheduled'
              }
            </span>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={saveSettings}
          disabled={saving}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 font-medium transition-colors"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
} 