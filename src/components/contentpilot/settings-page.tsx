"use client";

import { useState, useEffect, FormEvent, useCallback } from "react";
import { ContentPilotService } from "@/lib/contentpilot/service";

const SettingsPage = () => {
  const [articlesPerCycle, setArticlesPerCycle] = useState('10');
  const [notificationEmail, setNotificationEmail] = useState('');
  const [enableEmailNotifications, setEnableEmailNotifications] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string>('');
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  
  console.log('SettingsPage rendering, isLoading:', isLoading);
  
  const service = ContentPilotService.getInstance();

  // Get current domain/URL for integration details
  const getCurrentBaseUrl = () => {
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    return process.env.NEXT_PUBLIC_BASE_URL || 
           (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3001');
  };

  const integrationDetails = {
    agentName: 'ContentPilot',
    endpoint: `${getCurrentBaseUrl()}/api/contentpilot/agent`,
    healthCheck: `${getCurrentBaseUrl()}/api/contentpilot/agent`,
    capabilities: [
      'content discovery',
      'content generation', 
      'content summarization',
      'newsletter automation',
      'editorial workflow',
      'content intelligence',
      'brief generation',
      'topic analysis',
      'automation scheduling',
      'webhook notifications',
      'human-in-the-loop escalation',
      'job tracking'
    ],
    description: 'Intelligent content discovery, generation, and newsletter automation agent.',
    version: '1.0.0',
    status: 'UP'
  };

  const loadSettings = useCallback(async () => {
    try {
      setError(null);
      console.log('Loading settings...');
      
      // Load multiple settings including API key
      const [articlesPerCycleSetting, notificationEmailSetting, enableNotificationsSetting, apiKeySetting] = await Promise.all([
        service.getSetting('articlesPerCycle'),
        service.getSetting('notificationEmail'),
        service.getSetting('enableEmailNotifications'),
        service.getSetting('apiKey'),
      ]);
      
      console.log('Settings loaded:', { articlesPerCycleSetting, notificationEmailSetting, enableNotificationsSetting, apiKeySetting });
      
      if (articlesPerCycleSetting && articlesPerCycleSetting.value) {
        setArticlesPerCycle(articlesPerCycleSetting.value);
      }
      
      if (notificationEmailSetting && notificationEmailSetting.value) {
        setNotificationEmail(notificationEmailSetting.value);
      }
      
      if (enableNotificationsSetting && enableNotificationsSetting.value) {
        setEnableEmailNotifications(enableNotificationsSetting.value === 'true');
      }

      if (apiKeySetting && apiKeySetting.value) {
        setApiKey(apiKeySetting.value);
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
      setError(error instanceof Error ? error.message : 'Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  }, [service]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      // Save all settings
      await Promise.all([
        service.saveSetting('articlesPerCycle', articlesPerCycle),
        service.saveSetting('notificationEmail', notificationEmail),
        service.saveSetting('enableEmailNotifications', enableEmailNotifications.toString()),
      ]);
      alert('Settings saved successfully!');
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateApiKey = async () => {
    setIsGeneratingKey(true);
    try {
      const response = await fetch('/api/contentpilot/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Central Agent Integration' }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate API key');
      }
      
      const result = await response.json();
      setApiKey(result.key);
      await service.saveSetting('apiKey', result.key);
      alert('New API key generated successfully!');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to generate API key');
    } finally {
      setIsGeneratingKey(false);
    }
  };

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 rounded animate-pulse w-1/3"></div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 max-w-lg">
          <div className="space-y-4">
            <div className="h-6 bg-gray-200 rounded animate-pulse w-1/2"></div>
            <div className="h-4 bg-gray-100 rounded animate-pulse w-3/4"></div>
            <div className="h-12 bg-gray-100 rounded animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Settings</h2>
          <p className="text-gray-600 mt-1">Manage agent configuration</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-lg">
          <div className="flex items-center">
            <div className="text-red-500 mr-2">⚠️</div>
            <div>
              <p className="text-red-800 font-medium">Error loading settings</p>
              <p className="text-red-600 text-sm mt-1">{error}</p>
            </div>
          </div>
          <button
            onClick={() => {
              setError(null);
              setIsLoading(true);
              loadSettings();
            }}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Settings</h2>
        <p className="text-gray-600 mt-1">Manage agent configuration</p>
      </div>
      
      <div className="space-y-6">
        {/* Central Agent Integration */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 max-w-4xl">
          <h3 className="text-xl font-semibold text-gray-900 mb-6">🤖 Central Agent Integration</h3>
          <p className="text-sm text-gray-600 mb-6">
            Use these details to register this ContentPilot mini-agent with your central agent (Maya).
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Agent Details */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Agent Name</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={integrationDetails.agentName}
                    readOnly
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 text-sm"
                  />
                  <button
                    onClick={() => copyToClipboard(integrationDetails.agentName, 'agentName')}
                    className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-sm"
                  >
                    {copiedField === 'agentName' ? '✓' : '📋'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">API Endpoint</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={integrationDetails.endpoint}
                    readOnly
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 text-sm"
                  />
                  <button
                    onClick={() => copyToClipboard(integrationDetails.endpoint, 'endpoint')}
                    className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-sm"
                  >
                    {copiedField === 'endpoint' ? '✓' : '📋'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Health Check URL</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={integrationDetails.healthCheck}
                    readOnly
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 text-sm"
                  />
                  <button
                    onClick={() => copyToClipboard(integrationDetails.healthCheck, 'healthCheck')}
                    className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-sm"
                  >
                    {copiedField === 'healthCheck' ? '✓' : '📋'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={integrationDetails.description}
                    readOnly
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 text-sm"
                  />
                  <button
                    onClick={() => copyToClipboard(integrationDetails.description, 'description')}
                    className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-sm"
                  >
                    {copiedField === 'description' ? '✓' : '📋'}
                  </button>
                </div>
              </div>
            </div>

            {/* API Key and Capabilities */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">API Key</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="password"
                    value={apiKey}
                    readOnly
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 text-sm"
                    placeholder={apiKey ? "••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••" : "No API key generated"}
                  />
                  <button
                    onClick={() => copyToClipboard(apiKey, 'apiKey')}
                    disabled={!apiKey}
                    className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-sm disabled:bg-gray-100 disabled:text-gray-400"
                  >
                    {copiedField === 'apiKey' ? '✓' : '📋'}
                  </button>
                </div>
                <button
                  onClick={handleGenerateApiKey}
                  disabled={isGeneratingKey}
                  className="mt-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-green-400 text-sm"
                >
                  {isGeneratingKey ? 'Generating...' : apiKey ? 'Regenerate API Key' : 'Generate API Key'}
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Capabilities</label>
                <div className="bg-gray-50 rounded-lg p-3 max-h-40 overflow-y-auto">
                  <div className="flex flex-wrap gap-1">
                    {integrationDetails.capabilities.map((capability, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs"
                      >
                        {capability}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => copyToClipboard(integrationDetails.capabilities.join(', '), 'capabilities')}
                  className="mt-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-sm"
                >
                  {copiedField === 'capabilities' ? '✓ Copied' : '📋 Copy All'}
                </button>
              </div>
            </div>
          </div>

          {/* Integration Instructions */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h4 className="text-lg font-semibold text-gray-900 mb-3">Integration Instructions</h4>
            <div className="bg-blue-50 rounded-lg p-4">
              <ol className="text-sm text-gray-700 space-y-2">
                <li><strong>1.</strong> Copy the API Key above (generate one if needed)</li>
                <li><strong>2.</strong> Register this agent with Maya using the endpoint URL</li>
                <li><strong>3.</strong> Provide the capabilities list for task routing</li>
                <li><strong>4.</strong> Set up health check monitoring with the health check URL</li>
                <li><strong>5.</strong> Test the integration by sending a sample task</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Intelligence Settings */}
        <form onSubmit={handleSave} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 max-w-2xl">
          <h3 className="text-xl font-semibold text-gray-900 mb-6">Intelligence Gathering</h3>
          <div className="space-y-6">
            <div>
              <label htmlFor="articlesPerCycle" className="block text-lg font-semibold text-gray-800">
                Articles Per Cycle
              </label>
              <p className="text-sm text-gray-500 mt-1">
                The number of articles the AI will generate each time the &quot;Gather Intelligence&quot; cycle runs.
              </p>
              <input
                id="articlesPerCycle"
                type="number"
                min="1"
                max="50"
                value={articlesPerCycle}
                onChange={(e) => setArticlesPerCycle(e.target.value)}
                className="mt-2 w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </form>

        {/* Email Notification Settings */}
        <form onSubmit={handleSave} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 max-w-2xl">
          <h3 className="text-xl font-semibold text-gray-900 mb-6">Email Notifications</h3>
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-lg font-semibold text-gray-800">
                  Enable Email Notifications
                </label>
                <p className="text-sm text-gray-500 mt-1">
                  Receive email summaries when intelligence gathering completes
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableEmailNotifications}
                  onChange={(e) => setEnableEmailNotifications(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div>
              <label htmlFor="notificationEmail" className="block text-lg font-semibold text-gray-800">
                Notification Email
              </label>
              <p className="text-sm text-gray-500 mt-1">
                Email address where intelligence summaries will be sent. Uses your registered email as default.
              </p>
              <input
                id="notificationEmail"
                type="email"
                placeholder="your-email@example.com"
                value={notificationEmail}
                onChange={(e) => setNotificationEmail(e.target.value)}
                className="mt-2 w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-400 mt-2">
                💡 Leave empty to use your registered account email
              </p>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <button
              type="submit"
              disabled={isSaving}
              className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
            >
              {isSaving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SettingsPage; 