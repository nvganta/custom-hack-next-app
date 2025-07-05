"use client";

import { useState, useEffect, FormEvent, useCallback } from "react";
import { ContentPilotService } from "@/lib/contentpilot/service";

const SettingsPage = () => {
  const [articlesPerCycle, setArticlesPerCycle] = useState('10');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  console.log('SettingsPage rendering, isLoading:', isLoading);
  
  const service = ContentPilotService.getInstance();

  const loadSettings = useCallback(async () => {
    try {
      setError(null);
      console.log('Loading settings...');
      const setting = await service.getSetting('articlesPerCycle');
      console.log('Settings loaded:', setting);
      if (setting && setting.value) {
        setArticlesPerCycle(setting.value);
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
      await service.saveSetting('articlesPerCycle', articlesPerCycle);
      alert('Settings saved successfully!');
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to save settings");
    } finally {
      setIsSaving(false);
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
      
      {/* Debug info */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm">
        <p>Debug: Component loaded successfully</p>
        <p>Loading: {isLoading ? 'true' : 'false'}</p>
        <p>Error: {error || 'none'}</p>
        <p>Articles per cycle: {articlesPerCycle}</p>
      </div>
      
      <form onSubmit={handleSave} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 max-w-lg">
        <div className="space-y-4">
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
  );
};

export default SettingsPage; 