/**
 * Home Page Component
 * Placeholder home page for the application
 */

import React from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '../components/base/card';

export default function HomePage() {
  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          Welcome to Your Application
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-300">
          This is a complete application shell built with the EpiSensor App Framework. 
          Add your business logic and components here to build your application.
        </p>
      </div>
      
      {/* Quick Start Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Start by exploring the framework features and documentation.
            </p>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li>• Configure your application settings</li>
              <li>• View and manage application logs</li>
              <li>• Customize the UI components</li>
              <li>• Add your business logic</li>
            </ul>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Framework Features</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Built-in features ready to use:
            </p>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li>• Structured logging with rotation</li>
              <li>• Dynamic settings management</li>
              <li>• WebSocket support</li>
              <li>• File upload handling</li>
              <li>• Session management</li>
              <li>• Rate limiting</li>
            </ul>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <a
                href="/settings"
                className="block w-full px-4 py-2 text-center bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Configure Settings
              </a>
              <a
                href="/logs"
                className="block w-full px-4 py-2 text-center bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
              >
                View Logs
              </a>
              <button
                onClick={() => window.location.reload()}
                className="block w-full px-4 py-2 text-center bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Refresh Application
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Status Section */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Status</p>
              <p className="text-lg font-semibold text-green-600 dark:text-green-400">Online</p>
            </div>
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Version</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">4.3.0</p>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Environment</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {import.meta.env.MODE || 'development'}
            </p>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Theme</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {document.documentElement.classList.contains('dark') ? 'Dark' : 'Light'}
            </p>
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <div className="text-center text-sm text-gray-500 dark:text-gray-400 pt-8">
        <p>Built with EpiSensor App Framework</p>
        <p className="mt-1">
          Ready for your business logic • Fully customizable • Production ready
        </p>
      </div>
    </div>
  );
}