import { useState, useEffect } from 'react';
import { Card } from '../../components/base/card';
import { Badge } from '../../components/base/badge';
import { Button } from '../../components/base/button';
import { Switch } from '../../components/base/switch';
import { Label } from '../../components/base/label';
import { Alert, AlertDescription } from '../../components/base/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../components/base/dialog';

import { 
  AlertTriangle, Settings, Zap, Clock, WifiOff, 
  Activity, X, RotateCcw 
} from 'lucide-react';
import { cn } from '../../lib/utils';
// Note: Apps using this component should provide their own config store
// Uncomment and adjust the import path as needed:
// import { useConfigStore } from '@/lib/stores/config';
import { toast } from 'sonner';

interface TestScenario {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  params: Record<string, unknown>;
}

const TEST_SCENARIOS: TestScenario[] = [
  {
    id: 'packet-loss',
    name: 'Packet Loss',
    description: 'Randomly drop packets to simulate network issues',
    icon: WifiOff,
    color: 'text-red-500',
    params: {
      dropRate: 10, // percentage
    }
  },
  {
    id: 'high-latency',
    name: 'High Latency',
    description: 'Add delay to responses to simulate slow networks',
    icon: Clock,
    color: 'text-orange-500',
    params: {
      delayMs: 300,
      jitter: 50
    }
  },
  {
    id: 'connection-errors',
    name: 'Connection Errors',
    description: 'Periodically reject connections',
    icon: X,
    color: 'text-red-600',
    params: {
      errorRate: 5, // percentage
      errorCode: 'ECONNREFUSED'
    }
  },
  {
    id: 'data-corruption',
    name: 'Data Corruption',
    description: 'Corrupt response data to test error handling',
    icon: AlertTriangle,
    color: 'text-yellow-500',
    params: {
      corruptionRate: 2, // percentage
      corruptionType: 'crc' // crc, truncate, scramble
    }
  },
  {
    id: 'rate-limiting',
    name: 'Rate Limiting',
    description: 'Limit request rate to test throttling',
    icon: Zap,
    color: 'text-blue-500',
    params: {
      maxRequestsPerSecond: 10,
      burstSize: 20
    }
  },
  {
    id: 'intermittent',
    name: 'Intermittent Issues',
    description: 'Random mix of various issues',
    icon: Activity,
    color: 'text-purple-500',
    params: {
      intensity: 'medium' // low, medium, high
    }
  }
];

interface TestModeIndicatorProps {
  config?: any; // App-specific config object
  className?: string;
}

export function TestModeIndicator({ config }: TestModeIndicatorProps = {}) {
  // const { config } = useConfigStore();
  const [showSettings, setShowSettings] = useState(false);
  const [testModeEnabled, setTestModeEnabled] = useState(false);
  const [activeScenarios, setActiveScenarios] = useState<string[]>([]);

  useEffect(() => {
    // Load test mode state from config
    const testMode = config?.testMode?.enabled;
    const scenarios = config?.testMode?.scenarios || [];
    
    setTestModeEnabled(testMode === true);
    setActiveScenarios(scenarios);
  }, [config]);

  const handleTestModeToggle = async (enabled: boolean) => {
    setTestModeEnabled(enabled);
    // Note: Uncomment when config store is available
    // await config.setValue('testMode.enabled', enabled);
    
    if (enabled) {
      toast.warning('Test Mode Enabled', {
        description: 'Error simulation is now active. This may affect system stability.',
      });
    } else {
      toast.success('Test Mode Disabled', {
        description: 'System returned to normal operation.',
      });
    }
  };

  const handleScenarioToggle = (scenarioId: string, enabled: boolean) => {
    if (enabled) {
      setActiveScenarios([...activeScenarios, scenarioId]);
    } else {
      setActiveScenarios(activeScenarios.filter(s => s !== scenarioId));
    }
  };


  const saveSettings = async () => {
    // Note: Uncomment when config store is available
    // await config.setValue('testMode.scenarios', activeScenarios);
    // await config.setValue('testMode.params', scenarioParams);
    setShowSettings(false);
    toast.success('Test mode settings saved');
  };

  const resetSettings = () => {
    setActiveScenarios([]);
    toast.info('Test scenarios reset');
  };

  if (!testModeEnabled && !showSettings) {
    return null;
  }

  return (
    <>
      {/* Test Mode Banner */}
      {testModeEnabled && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg">
          <div className="container mx-auto px-4 py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 animate-pulse" />
                <span className="font-semibold">TEST MODE ACTIVE</span>
                <div className="flex items-center gap-2">
                  {activeScenarios.map(scenarioId => {
                    const scenario = TEST_SCENARIOS.find(s => s.id === scenarioId);
                    if (!scenario) return null;
                    const Icon = scenario.icon;
                    return (
                      <Badge 
                        key={scenarioId} 
                        variant="secondary" 
                        className="bg-white/20 text-white border-white/30"
                      >
                        <Icon className="h-3 w-3 mr-1" />
                        {scenario.name}
                      </Badge>
                    );
                  })}
                  {activeScenarios.length === 0 && (
                    <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                      No scenarios active
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-white hover:bg-white/20"
                  onClick={() => setShowSettings(true)}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Configure
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-white hover:bg-white/20"
                  onClick={() => handleTestModeToggle(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Test Mode Configuration</DialogTitle>
            <DialogDescription>
              Configure error simulation scenarios for testing system resilience.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Master Switch */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <Label htmlFor="test-mode-master" className="text-base font-semibold">
                  Enable Test Mode
                </Label>
                <p className="text-sm text-muted-foreground">
                  Activate error simulation for testing
                </p>
              </div>
              <Switch
                id="test-mode-master"
                checked={testModeEnabled}
                onCheckedChange={handleTestModeToggle}
              />
            </div>

            {testModeEnabled && (
              <>
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Test mode simulates real-world network and system issues. 
                    Use with caution in production environments.
                  </AlertDescription>
                </Alert>

                {/* Scenarios */}
                <div className="space-y-4">
                  <h3 className="font-semibold">Error Scenarios</h3>
                  {TEST_SCENARIOS.map(scenario => {
                    const Icon = scenario.icon;
                    const isActive = activeScenarios.includes(scenario.id);
                    
                    return (
                      <Card key={scenario.id} className="p-4">
                        <div className="space-y-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              <Icon className={cn("h-5 w-5 mt-0.5", scenario.color)} />
                              <div>
                                <h4 className="font-medium">{scenario.name}</h4>
                                <p className="text-sm text-muted-foreground">
                                  {scenario.description}
                                </p>
                              </div>
                            </div>
                            <Switch
                              checked={isActive}
                              onCheckedChange={(checked) => handleScenarioToggle(scenario.id, checked)}
                            />
                          </div>
                          
                          {isActive && (
                            <div className="ml-8 space-y-3 pt-2 border-t">
                              <p className="text-sm text-muted-foreground">
                                Parameter controls will be available in a future update
                              </p>
                              {/* Commented out until Slider component is added
                              {scenario.id === 'high-latency' && (
                                <>
                                  <div>
                                    <Label>Delay: {params.delayMs}ms</Label>
                                    <Slider
                                      value={[params.delayMs]}
                                      onValueChange={([v]) => handleParamChange(scenario.id, 'delayMs', v)}
                                      min={0}
                                      max={2000}
                                      step={50}
                                      className="mt-2"
                                    />
                                  </div>
                                  <div>
                                    <Label>Jitter: {params.jitter}ms</Label>
                                    <Slider
                                      value={[params.jitter]}
                                      onValueChange={([v]) => handleParamChange(scenario.id, 'jitter', v)}
                                      min={0}
                                      max={200}
                                      step={10}
                                      className="mt-2"
                                    />
                                  </div>
                                </>
                              )}
                              
                              {scenario.id === 'connection-errors' && (
                                <div>
                                  <Label>Error Rate: {params.errorRate}%</Label>
                                  <Slider
                                    value={[params.errorRate]}
                                    onValueChange={([v]) => handleParamChange(scenario.id, 'errorRate', v)}
                                    min={0}
                                    max={25}
                                    step={1}
                                    className="mt-2"
                                  />
                                </div>
                              )}
                              
                              {scenario.id === 'data-corruption' && (
                                <>
                                  <div>
                                    <Label>Corruption Rate: {params.corruptionRate}%</Label>
                                    <Slider
                                      value={[params.corruptionRate]}
                                      onValueChange={([v]) => handleParamChange(scenario.id, 'corruptionRate', v)}
                                      min={0}
                                      max={10}
                                      step={1}
                                      className="mt-2"
                                    />
                                  </div>
                                  <div>
                                    <Label>Corruption Type</Label>
                                    <Select
                                      value={params.corruptionType}
                                      onValueChange={(v) => handleParamChange(scenario.id, 'corruptionType', v)}
                                    >
                                      <SelectTrigger className="mt-2">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="crc">CRC Error</SelectItem>
                                        <SelectItem value="truncate">Truncated Data</SelectItem>
                                        <SelectItem value="scramble">Scrambled Bytes</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </>
                              )}
                              
                              {scenario.id === 'rate-limiting' && (
                                <div>
                                  <Label>Max Requests/sec: {params.maxRequestsPerSecond}</Label>
                                  <Slider
                                    value={[params.maxRequestsPerSecond]}
                                    onValueChange={([v]) => handleParamChange(scenario.id, 'maxRequestsPerSecond', v)}
                                    min={1}
                                    max={100}
                                    step={5}
                                    className="mt-2"
                                  />
                                </div>
                              )}
                              
                              {scenario.id === 'intermittent' && (
                                <div>
                                  <Label>Intensity</Label>
                                  <Select
                                    value={params.intensity}
                                    onValueChange={(v) => handleParamChange(scenario.id, 'intensity', v)}
                                  >
                                    <SelectTrigger className="mt-2">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="low">Low (occasional issues)</SelectItem>
                                      <SelectItem value="medium">Medium (frequent issues)</SelectItem>
                                      <SelectItem value="high">High (constant issues)</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                              */}
                            </div>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetSettings}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            <Button onClick={saveSettings}>
              Save Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
