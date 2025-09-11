/**
 * Enhanced Settings Component
 * Full-featured settings component based on working VPP Manager implementation
 */

import { useState, useEffect, useCallback } from 'react';
import { Card } from '../../../components/base/card';
import { Button } from '../../../components/base/button';
import { Input } from '../../../components/base/input';
import { Label } from '../../../components/base/label';
import { Switch } from '../../../components/base/switch';
import { Textarea } from '../../../components/base/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/base/select';
import { Alert, AlertDescription } from '../../../components/base/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../../components/base/tooltip';
import { RestartBanner } from '../RestartBanner';
import { NetworkInterfaceSelect } from '../NetworkInterfaceSelect';
import { 
  Save, 
  RotateCcw, 
  Eye, 
  EyeOff,
  HelpCircle,
  Loader2,
  Check,
  AlertCircle,
  Server,
  FileText,
  Brain,
  Cpu,
  Settings as SettingsIcon,
  Shield,
  Mail
} from 'lucide-react';
import { cn } from '../../../utils/cn';
import { 
  EnhancedSettingsSchema,
  SettingsCategory,
  SettingDefinition,
  SettingsFormState,
  getSettingByKey,
  validateSetting,
  validateAllSettings,
  getRestartRequiredSettings,
  flattenSettingsValues,
  unflattenSettingsValues,
  createSettingsFormState
} from '../../../../src/settings/EnhancedSettingsSchema';

const iconMap: Record<string, React.ElementType> = {
  Server,
  FileText,
  Brain,
  Cpu,
  Settings: SettingsIcon,
  Shield,
  Mail
};

export interface EnhancedSettingsProps {
  schema: EnhancedSettingsSchema;
  apiEndpoints?: {
    get?: string;
    save?: string;
  };
  className?: string;
  onError?: (error: Error) => void;
  onSave?: (settings: Record<string, any>, changedKeys: string[]) => Promise<{ success: boolean; requiresRestart?: boolean; error?: any }>;
  onSettingsChange?: (settings: Record<string, any>) => void;
}

export function EnhancedSettings({
  schema,
  apiEndpoints = {
    get: '/api/settings',
    save: '/api/settings'
  },
  className,
  onError,
  onSave,
  onSettingsChange
}: EnhancedSettingsProps) {
  const [formState, setFormState] = useState<SettingsFormState>(
    createSettingsFormState(schema.categories)
  );
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState(schema.categories[0]?.id || '');
  const [restartRequired, setRestartRequired] = useState(false);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  // Load settings from API
  const loadSettings = useCallback(async () => {
    if (!apiEndpoints.get) return;
    
    try {
      setLoading(true);
      const response = await fetch(apiEndpoints.get);
      
      if (!response.ok) {
        throw new Error(`Failed to load settings: ${response.statusText}`);
      }
      
      const data = await response.json();
      const newFormState = createSettingsFormState(schema.categories, data);
      setFormState(newFormState);
      
      if (onSettingsChange) {
        onSettingsChange(data);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      if (onError) {
        onError(error instanceof Error ? error : new Error('Failed to load settings'));
      }
    } finally {
      setLoading(false);
    }
  }, [apiEndpoints.get, schema.categories, onError, onSettingsChange]);

  // Save settings
  const saveSettings = useCallback(async () => {
    if (!apiEndpoints.save) return;
    
    const validation = validateAllSettings(schema.categories, formState.values);
    if (!validation.isValid) {
      setFormState(prev => ({
        ...prev,
        errors: validation.errors,
        isValid: false
      }));
      return;
    }

    try {
      setFormState(prev => ({ ...prev, isSubmitting: true }));
      
      const changedKeys = Object.keys(formState.dirty);
      const flattenedValues = flattenSettingsValues(formState.values);
      
      let result: { success: boolean; requiresRestart?: boolean; error?: any };
      
      if (onSave) {
        result = await onSave(flattenedValues, changedKeys);
      } else {
        const response = await fetch(apiEndpoints.save, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(flattenedValues)
        });
        
        if (!response.ok) {
          throw new Error(`Failed to save settings: ${response.statusText}`);
        }
        
        result = await response.json();
      }
      
      if (result.success) {
        // Check if restart is required
        const restartRequiredKeys = getRestartRequiredSettings(schema.categories, changedKeys);
        const needsRestart = restartRequiredKeys.length > 0 || result.requiresRestart;
        
        setRestartRequired(needsRestart);
        setFormState(prev => ({
          ...prev,
          dirty: {},
          isSubmitting: false
        }));
        
        if (onSettingsChange) {
          onSettingsChange(formState.values);
        }
      } else {
        throw new Error(result.error || 'Failed to save settings');
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      if (onError) {
        onError(error instanceof Error ? error : new Error('Failed to save settings'));
      }
      setFormState(prev => ({ ...prev, isSubmitting: false }));
    }
  }, [apiEndpoints.save, schema.categories, formState, onSave, onError, onSettingsChange]);

  // Update setting value
  const updateSetting = useCallback((key: string, value: any) => {
    const setting = getSettingByKey(schema.categories, key);
    if (!setting) return;
    
    const error = validateSetting(setting, value);
    
    setFormState(prev => ({
      ...prev,
      values: { ...prev.values, [key]: value },
      errors: { ...prev.errors, [key]: error || '' },
      touched: { ...prev.touched, [key]: true },
      dirty: { ...prev.dirty, [key]: true },
      isValid: error === null && Object.values({ ...prev.errors, [key]: error || '' }).every(e => !e)
    }));
  }, [schema.categories]);

  // Reset form
  const resetForm = useCallback(() => {
    const newFormState = createSettingsFormState(schema.categories, formState.values);
    setFormState({
      ...newFormState,
      dirty: {},
      touched: {}
    });
  }, [schema.categories, formState.values]);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Render setting input
  const renderSettingInput = (setting: SettingDefinition) => {
    const value = formState.values[setting.key];
    const error = formState.errors[setting.key];
    const isPassword = setting.type === 'password';
    const showPassword = showPasswords[setting.key];

    switch (setting.type) {
      case 'boolean':
        return (
          <div className="flex items-center space-x-2">
            <Switch
              id={setting.key}
              checked={Boolean(value)}
              onCheckedChange={(checked) => updateSetting(setting.key, checked)}
            />
            <Label htmlFor={setting.key} className="text-sm font-medium">
              {setting.label}
            </Label>
          </div>
        );

      case 'select':
        return (
          <div className="space-y-2">
            <Label htmlFor={setting.key}>{setting.label}</Label>
            <Select value={value || ''} onValueChange={(val) => updateSetting(setting.key, val)}>
              <SelectTrigger>
                <SelectValue placeholder={`Select ${setting.label.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {setting.options?.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div>
                      <div>{option.label}</div>
                      {option.description && (
                        <div className="text-xs text-muted-foreground">{option.description}</div>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      case 'network-interface':
        return (
          <div className="space-y-2">
            <Label htmlFor={setting.key}>{setting.label}</Label>
            <NetworkInterfaceSelect
              value={value || ''}
              onChange={(val) => updateSetting(setting.key, val)}
              placeholder={setting.placeholder}
            />
          </div>
        );

      case 'password':
      case 'string':
      default:
        return (
          <div className="space-y-2">
            <Label htmlFor={setting.key}>{setting.label}</Label>
            <div className="relative">
              <Input
                id={setting.key}
                type={isPassword && !showPassword ? 'password' : 'text'}
                value={value || ''}
                onChange={(e) => updateSetting(setting.key, e.target.value)}
                placeholder={setting.placeholder}
                className={cn(
                  setting.inputWidth === 'small' && 'max-w-32',
                  setting.inputWidth === 'medium' && 'max-w-64',
                  setting.inputWidth === 'large' && 'max-w-96',
                  error && 'border-red-500'
                )}
              />
              {isPassword && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPasswords(prev => ({ ...prev, [setting.key]: !prev[setting.key] }))}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              )}
            </div>
          </div>
        );

      case 'number':
        return (
          <div className="space-y-2">
            <Label htmlFor={setting.key}>{setting.label}</Label>
            <Input
              id={setting.key}
              type="number"
              value={value || ''}
              onChange={(e) => updateSetting(setting.key, Number(e.target.value))}
              placeholder={setting.placeholder}
              min={setting.min}
              max={setting.max}
              step={setting.step}
              className={cn(
                setting.inputWidth === 'small' && 'max-w-32',
                setting.inputWidth === 'medium' && 'max-w-64',
                setting.inputWidth === 'large' && 'max-w-96',
                error && 'border-red-500'
              )}
            />
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const activeSettings = schema.categories.find(cat => cat.id === activeCategory);
  const hasChanges = Object.keys(formState.dirty).length > 0;

  return (
    <div className={cn("space-y-6", className)}>
      {restartRequired && (
        <RestartBanner
          message="Settings have been saved. Some changes require a restart to take effect."
          onRestart={() => window.location.reload()}
          onDismiss={() => setRestartRequired(false)}
        />
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Category Navigation */}
        <div className="lg:w-64 space-y-2">
          {schema.categories.map((category) => {
            const Icon = iconMap[category.icon] || SettingsIcon;
            return (
              <Button
                key={category.id}
                variant={activeCategory === category.id ? "default" : "ghost"}
                className="w-full justify-start"
                onClick={() => setActiveCategory(category.id)}
              >
                <Icon className="mr-2 h-4 w-4" />
                {category.label}
              </Button>
            );
          })}
        </div>

        {/* Settings Content */}
        <div className="flex-1 space-y-6">
          {activeSettings && (
            <Card className="p-6">
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold">{activeSettings.label}</h2>
                  <p className="text-muted-foreground">{activeSettings.description}</p>
                </div>

                <div className="space-y-6">
                  {activeSettings.settings
                    .filter(setting => !setting.hidden)
                    .map((setting) => (
                      <div key={setting.key} className="space-y-2">
                        <div className="flex items-center gap-2">
                          {renderSettingInput(setting)}
                          {setting.help && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                    <HelpCircle className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-xs">{setting.help}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                        
                        {setting.description && setting.type !== 'boolean' && (
                          <p className="text-sm text-muted-foreground">{setting.description}</p>
                        )}
                        
                        {formState.errors[setting.key] && (
                          <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{formState.errors[setting.key]}</AlertDescription>
                          </Alert>
                        )}
                        
                        {setting.requiresRestart && formState.dirty[setting.key] && (
                          <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                              This setting requires a restart to take effect.
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={resetForm}
              disabled={!hasChanges || formState.isSubmitting}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset Changes
            </Button>

            <Button
              onClick={saveSettings}
              disabled={!hasChanges || !formState.isValid || formState.isSubmitting}
            >
              {formState.isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Settings
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
