/**
 * Integration test to verify UI components are properly exported
 * This test ensures that all UI components can be imported and are available
 */

describe('UI Component Exports', () => {
  it('should export all UI components from @episensor/app-framework/ui', async () => {
    // Import the UI module
    const UI = await import('../../ui/dist/index.js');
    
    // Core components that must be exported
    const requiredComponents = [
      'Button',
      'Card',
      'Dialog',
      'DialogContent',
      'DialogHeader',
      'DialogTitle',
      'DialogFooter',
      'Badge',
      'Checkbox',
      'Label',
      'Switch',
      'Tabs',
      'TabsList',
      'TabsTrigger',
      'TabsContent',
      'Select',
      'SelectTrigger',
      'SelectContent',
      'SelectItem',
      'SelectValue',
      'Tooltip',
      'TooltipProvider',
      'TooltipTrigger',
      'TooltipContent',
      'DropdownMenu',
      'DropdownMenuTrigger',
      'DropdownMenuContent',
      'DropdownMenuItem',
    ];
    
    // Framework-specific components
    const frameworkComponents = [
      'LogViewer',
      'LogStats',
      'SettingsFramework',
      'ConnectionStatus',
      'HealthStatus',
      'StartupBanner',
    ];
    
    // Utilities
    const utilities = [
      'cn',
      'useWebSocket',
      'useConnectionStatus',
      'useDebounce',
    ];
    
    // Check all required components are exported
    for (const component of requiredComponents) {
      expect(UI[component]).toBeDefined();
      expect(typeof UI[component]).toBe('function');
    }
    
    // Check framework components
    for (const component of frameworkComponents) {
      expect(UI[component]).toBeDefined();
      expect(typeof UI[component]).toBe('function');
    }
    
    // Check utilities
    for (const utility of utilities) {
      expect(UI[utility]).toBeDefined();
      expect(typeof UI[utility]).toBe('function');
    }
  });
  
  it('should have proper TypeScript definitions', async () => {
    const fs = require('fs');
    const path = require('path');
    
    // Check that .d.ts files exist
    const typesPath = path.join(__dirname, '../../ui/dist/index.d.ts');
    expect(fs.existsSync(typesPath)).toBe(true);
    
    // Read the types file
    const typesContent = fs.readFileSync(typesPath, 'utf-8');
    
    // Verify key exports are in the types
    expect(typesContent).toContain('export { Button }');
    expect(typesContent).toContain('export { Card }');
    expect(typesContent).toContain('export { LogViewer }');
    expect(typesContent).toContain('export { SettingsFramework }');
  });
});