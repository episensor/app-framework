/**
 * Default App Component
 * Provides a complete application shell with settings and logs functionality
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import { SettingsProvider } from './src/contexts/SettingsContext';
import { LogProvider } from './src/contexts/LogContext';
import HomePage from './src/pages/HomePage';
import { SettingsPage } from './src/pages/SettingsPage';
import { LogsPage } from './src/pages/LogsPage';
import { ThemeToggle } from './components/settings/ThemeToggle';
import './styles/globals.css';

export default function App() {
  return (
    <SettingsProvider>
      <LogProvider>
        <Router>
          <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Navigation Header */}
            <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                  {/* Logo and Navigation */}
                  <div className="flex items-center space-x-8">
                    <div className="flex-shrink-0">
                      <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                        App Framework
                      </h1>
                    </div>
                    
                    <nav className="hidden md:flex space-x-4">
                      <NavLink
                        to="/"
                        className={({ isActive }) =>
                          `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                            isActive
                              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                              : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`
                        }
                      >
                        Home
                      </NavLink>
                      
                      <NavLink
                        to="/logs"
                        className={({ isActive }) =>
                          `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                            isActive
                              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                              : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`
                        }
                      >
                        Logs
                      </NavLink>
                      
                      <NavLink
                        to="/settings"
                        className={({ isActive }) =>
                          `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                            isActive
                              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                              : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`
                        }
                      >
                        Settings
                      </NavLink>
                    </nav>
                  </div>
                  
                  {/* Right side actions */}
                  <div className="flex items-center space-x-4">
                    <ThemeToggle />
                  </div>
                </div>
              </div>
              
              {/* Mobile navigation */}
              <nav className="md:hidden border-t border-gray-200 dark:border-gray-700">
                <div className="px-2 pt-2 pb-3 space-y-1">
                  <NavLink
                    to="/"
                    className={({ isActive }) =>
                      `block px-3 py-2 rounded-md text-base font-medium transition-colors ${
                        isActive
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                          : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`
                    }
                  >
                    Home
                  </NavLink>
                  
                  <NavLink
                    to="/logs"
                    className={({ isActive }) =>
                      `block px-3 py-2 rounded-md text-base font-medium transition-colors ${
                        isActive
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                          : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`
                    }
                  >
                    Logs
                  </NavLink>
                  
                  <NavLink
                    to="/settings"
                    className={({ isActive }) =>
                      `block px-3 py-2 rounded-md text-base font-medium transition-colors ${
                        isActive
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                          : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`
                    }
                  >
                    Settings
                  </NavLink>
                </div>
              </nav>
            </header>
            
            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/logs" element={<LogsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </main>
          </div>
        </Router>
      </LogProvider>
    </SettingsProvider>
  );
}
