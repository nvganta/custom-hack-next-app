"use client";

import { useState } from "react";

export default function InitDbPage() {
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const initializeDatabase = async () => {
    setLoading(true);
    setStatus("Initializing database...");
    
    try {
      const response = await fetch("/api/contentpilot/init-db", {
        method: "POST",
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setStatus("✅ Database initialized successfully!");
        setResult(data);
      } else {
        setStatus(`❌ Error: ${data.error || "Failed to initialize database"}`);
        setResult(data);
      }
    } catch (error) {
      setStatus(`❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const checkDatabaseStatus = async () => {
    setLoading(true);
    setStatus("Checking database status...");
    
    try {
      const response = await fetch("/api/contentpilot/init-db", {
        method: "GET",
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setStatus("Database status retrieved");
        setResult(data);
      } else {
        setStatus(`❌ Error: ${data.error || "Failed to check database"}`);
        setResult(data);
      }
    } catch (error) {
      setStatus(`❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white shadow rounded-lg p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            ContentPilot Database Initialization
          </h1>
          
          <div className="space-y-4">
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-yellow-700">
                    This page helps you initialize the ContentPilot database with required tables and initial data.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex space-x-4">
              <button
                onClick={checkDatabaseStatus}
                disabled={loading}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Loading..." : "Check Database Status"}
              </button>
              
              <button
                onClick={initializeDatabase}
                disabled={loading}
                className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Initializing..." : "Initialize Database"}
              </button>
            </div>

            {status && (
              <div className={`mt-4 p-4 rounded-md ${
                status.includes("✅") ? "bg-green-50 text-green-800" : 
                status.includes("❌") ? "bg-red-50 text-red-800" : 
                "bg-gray-50 text-gray-800"
              }`}>
                <p className="font-medium">{status}</p>
              </div>
            )}

            {result && (
              <div className="mt-4 p-4 bg-gray-50 rounded-md">
                <h3 className="font-medium text-gray-900 mb-2">Result:</h3>
                <pre className="text-sm text-gray-600 overflow-auto">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            )}
          </div>

          <div className="mt-8 border-t pt-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">What this does:</h2>
            <ul className="list-disc list-inside space-y-2 text-gray-600">
              <li>Creates initial settings (email notifications, automation config)</li>
              <li>Sets up sample content sources (TechCrunch, Hacker News)</li>
              <li>Creates default topics (Technology, Business, AI, etc.)</li>
              <li>Prepares the database for ContentPilot operations</li>
            </ul>
          </div>

          <div className="mt-6 text-sm text-gray-500">
            <p>After initialization, you can remove this page or restrict access to it.</p>
          </div>
        </div>
      </div>
    </div>
  );
} 