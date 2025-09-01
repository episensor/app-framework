import React, { useState, ReactNode } from 'react';
import { Menu, X, LogOut } from 'lucide-react';
import { ConnectionStatus } from '../ConnectionStatus';
import { cn } from '../../../lib/utils';

export interface NavItem {
  name: string;
  href: string;
  icon?: ReactNode;
}

export interface AppShellProps {
  // App info
  appName: string;
  appVersion?: string;
  logoSrc?: string;
  
  // Navigation
  navigation: NavItem[];
  currentPath: string;
  onNavigate: (href: string) => void;
  
  // Auth
  authenticated?: boolean;
  onLogout?: () => void;
  showLogout?: boolean;
  
  // Features
  showConnectionStatus?: boolean;
  connectionStatusUrl?: string;
  testModeComponent?: ReactNode;
  
  // Styling
  primaryColor?: string;
  className?: string;
  headerClassName?: string;
  navClassName?: string;
  mainClassName?: string;
  
  // Content
  children: ReactNode;
}

export function AppShell({
  appName,
  appVersion,
  logoSrc,
  navigation,
  currentPath,
  onNavigate,
  authenticated = true,
  onLogout,
  showLogout = true,
  showConnectionStatus = true,
  connectionStatusUrl = '',
  testModeComponent,
  primaryColor = '#E21350',
  className,
  headerClassName,
  navClassName,
  mainClassName,
  children
}: AppShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNavigation = (href: string) => {
    onNavigate(href);
    setMobileMenuOpen(false);
  };

  const isActive = (href: string) => {
    if (href === '/') {
      return currentPath === '/';
    }
    return currentPath.startsWith(href);
  };

  return (
    <>
      {testModeComponent}
      
      <div className={cn("min-h-screen bg-gray-50", className)}>
        {/* Header */}
        <header className={cn("bg-black", headerClassName)}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                {logoSrc && (
                  <img 
                    src={logoSrc}
                    alt={appName}
                    className="h-8 w-auto mr-3"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                )}
                <h1 className="text-xl font-semibold text-white">
                  {appName}
                </h1>
                {appVersion && (
                  <span className="ml-2 text-xs text-gray-400">v{appVersion}</span>
                )}
              </div>
              
              <div className="flex items-center space-x-4">
                {showConnectionStatus && (
                  <ConnectionStatus 
                    url={connectionStatusUrl}
                    className="text-gray-400 hover:text-gray-300"
                  />
                )}
                {authenticated && showLogout && onLogout && (
                  <button
                    onClick={onLogout}
                    className="text-gray-400 hover:text-white flex items-center gap-2 text-sm"
                  >
                    <LogOut className="h-4 w-4" />
                    <span className="hidden sm:inline">Logout</span>
                  </button>
                )}
                <button
                  className="md:hidden p-2 text-white"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                >
                  {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Navigation */}
        <nav className={cn("bg-[#444444]", navClassName)}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Desktop navigation */}
            <div className="hidden md:flex space-x-0">
              {navigation.map((item) => {
                const active = isActive(item.href);
                
                return (
                  <button
                    key={item.href}
                    onClick={() => handleNavigation(item.href)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors",
                      active 
                        ? "text-white" 
                        : "text-gray-300 hover:bg-[#555555] hover:text-white"
                    )}
                    style={active ? { backgroundColor: primaryColor } : undefined}
                  >
                    {item.icon}
                    {item.name}
                  </button>
                );
              })}
            </div>

            {/* Mobile navigation */}
            {mobileMenuOpen && (
              <div className="md:hidden py-2 space-y-1">
                {navigation.map((item) => {
                  const active = isActive(item.href);
                  
                  return (
                    <button
                      key={item.href}
                      onClick={() => handleNavigation(item.href)}
                      className={cn(
                        "w-full text-left flex items-center gap-2 px-3 py-2 rounded text-sm font-medium",
                        active 
                          ? "text-white" 
                          : "text-gray-300 hover:text-white hover:bg-[#555555]"
                      )}
                      style={active ? { backgroundColor: primaryColor } : undefined}
                    >
                      {item.icon}
                      {item.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </nav>

        {/* Main content */}
        <main className={cn("flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6", mainClassName)}>
          {children}
        </main>
      </div>
    </>
  );
}
