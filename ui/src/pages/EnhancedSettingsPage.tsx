import { useState, useEffect, ReactNode } from 'react';
import { Card } from '../../components/base/card';
import { Button } from '../../components/base/button';
import { Input } from '../../components/base/input';
import { Label } from '../../components/base/label';
import { Switch } from '../../components/base/switch';
import { Textarea } from '../../components/base/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../../components/base/select';
import { Alert, AlertDescription } from '../../components/base/alert';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '../../components/base/tooltip';
import { RestartBanner } from '../components/RestartBanner';
import { 
  Save, 
  RotateCcw, 
  AlertCircle, 
  Eye, 
  EyeOff,
  HelpCircle,
  Check,
  RefreshCw,
  Download
} from 'lucide-react';
import { cn } from '../../lib/utils';

export interface SettingTransform {
  fromStorage?: (value: any) => any;
  toStorage?: (value: any) => any;
}

export interface EnhancedSettingDefinition {
  key: string;
  label: string;
  description?: string;
  type: 'text' | 'password' | 'number' | 'boolean' | 'select' | 'textarea' | 'custom';
  options?: Array<{ value: string; label: string; description?: string }>;
  defaultValue?: any;
  validation?: (value: any) => string | null | boolean;
  requiresRestart?: boolean;
  customComponent?: ReactNode;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  help?: string;
  hint?: string;
  inputWidth?: 'small' | 'medium' | 'large' | 'full';
  transform?: SettingTransform;
  confirmMessage?: string;
  category?: string;
}

export interface EnhancedSettingsCategory {
  id: string;
  label: string;
  description?: string;
  icon?: ReactNode | string;
  settings: EnhancedSettingDefinition[];
}

export interface EnhancedSettingsPageProps {
  categories: EnhancedSettingsCategory[];
  values: Record<string, any>;
  loading?: boolean;
  saving?: boolean;
  onSave: (values: Record<string, any>) => Promise<void>;
  onReset?: () => void;
  onRestart?: () => void;
  onCheckUpdates?: () => Promise<{ available: boolean; version?: string }>;
  onFetchSettings?: () => Promise<Record<string, any>>;
  transformSettings?: (data: Record<string, any>) => Record<string, any>;
  showRestartBanner?: boolean;
  className?: string;
  title?: string;
}

export function EnhancedSettingsPage({
  categories,
  values: initialValues,
  loading = false,
  saving = false,
  onSave,
  onReset,
  onRestart,
  onCheckUpdates,
  onFetchSettings,
  transformSettings,
  showRestartBanner = false,
  className,
  title = 'Settings'
}: EnhancedSettingsPageProps) {
  const [values, setValues] = useState<Record<string, any>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeCategory, setActiveCategory] = useState(categories[0]?.id || '');
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [restartRequired, setRestartRequired] = useState(showRestartBanner);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState<{ available: boolean; version?: string } | null>(null);

  // Fetch settings on mount
  useEffect(() => {
    if (onFetchSettings) {
      onFetchSettings().then(data => {
        const transformed = transformSettings ? transformSettings(data) : data;
        setValues(transformed);
      });
    }
  }, [onFetchSettings, transformSettings]);

  // Update values when props change
  useEffect(() => {
    setValues(initialValues);
  }, [initialValues]);

  const getSettingValue = (key: string) => {
    const parts = key.split('.');
    let value = values;
    for (const part of parts) {
      value = value?.[part];
    }
    return value;
  };

  const setSettingValue = (key: string, value: any) => {
    const parts = key.split('.');
    const newValues = { ...values };
    let current = newValues;
    
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) {
        current[parts[i]] = {};
      }
      current = current[parts[i]];
    }
    
    current[parts[parts.length - 1]] = value;
    setValues(newValues);
    setIsDirty(true);
  };

  const handleChange = (key: string, value: any, setting: EnhancedSettingDefinition) => {
    // Apply fromStorage transform if needed
    if (setting.transform?.fromStorage) {
      value = setting.transform.fromStorage(value);
    }

    setSettingValue(key, value);
    
    // Validate on change
    if (setting.validation) {
      const error = setting.validation(value);
      setErrors(prev => ({
        ...prev,
        [key]: typeof error === 'string' ? error : error ? '' : ''
      }));
    }
  };

  const handleSave = async () => {
    // Show confirmation for settings that need it
    const confirmSettings = categories
      .flatMap(c => c.settings)
      .filter(s => s.confirmMessage && getSettingValue(s.key) !== initialValues[s.key]);
    
    if (confirmSettings.length > 0) {
      const messages = confirmSettings.map(s => s.confirmMessage).join('\n');
      if (!confirm(messages)) return;
    }

    // Validate all fields
    const newErrors: Record<string, string> = {};
    let hasErrors = false;

    for (const category of categories) {
      for (const setting of category.settings) {
        if (setting.validation) {
          const value = getSettingValue(setting.key);
          const error = setting.validation(value);
          if (error && typeof error === 'string') {
            newErrors[setting.key] = error;
            hasErrors = true;
          }
        }
      }
    }

    if (hasErrors) {
      setErrors(newErrors);
      return;
    }

    // Apply toStorage transforms
    const transformedValues: Record<string, any> = {};
    const flattenObject = (obj: any, prefix = '') => {
      Object.keys(obj).forEach(key => {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
          flattenObject(obj[key], fullKey);
        } else {
          const setting = categories
            .flatMap(c => c.settings)
            .find(s => s.key === fullKey);
          
          let value = obj[key];
          if (setting?.transform?.toStorage) {
            value = setting.transform.toStorage(value);
          }
          transformedValues[fullKey] = value;
        }
      });
    };
    flattenObject(values);

    // Check for restart required
    const restartSettings = categories
      .flatMap(c => c.settings)
      .filter(s => s.requiresRestart && transformedValues[s.key] !== initialValues[s.key]);
    
    if (restartSettings.length > 0) {
      setRestartRequired(true);
    }

    await onSave(transformedValues);
    setIsDirty(false);
  };

  const handleReset = () => {
    if (!confirm('Reset all settings to default values?')) return;
    
    const defaults: any = {};
    categories.forEach(category => {
      category.settings.forEach(setting => {
        const parts = setting.key.split('.');
        let current = defaults;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!current[parts[i]]) {
            current[parts[i]] = {};
          }
          current = current[parts[i]];
        }
        current[parts[parts.length - 1]] = setting.defaultValue;
      });
    });
    
    setValues(defaults);
    setIsDirty(true);
    setErrors({});
    
    if (onReset) {
      onReset();
    }
  };

  const handleCheckUpdates = async () => {
    if (!onCheckUpdates) return;
    
    setCheckingUpdates(true);
    try {
      const result = await onCheckUpdates();
      setUpdateAvailable(result);
    } finally {
      setCheckingUpdates(false);
    }
  };

  const getInputWidth = (width?: string) => {
    switch (width) {
      case 'small': return 'w-32';
      case 'medium': return 'w-64';
      case 'large': return 'w-96';
      case 'full': return 'w-full';
      default: return 'w-64';
    }
  };

  const renderSetting = (setting: EnhancedSettingDefinition) => {
    const value = getSettingValue(setting.key);
    const error = errors[setting.key];

    switch (setting.type) {
      case 'text':
      case 'password':
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor={setting.key}>{setting.label}</Label>
              {setting.help && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3 w-3 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">{setting.help}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            {setting.description && (
              <p className="text-sm text-muted-foreground">{setting.description}</p>
            )}
            <div className="relative">
              <Input
                id={setting.key}
                type={setting.type === 'password' && !showPasswords[setting.key] ? 'password' : 'text'}
                value={value || ''}
                onChange={(e) => handleChange(setting.key, e.target.value, setting)}
                placeholder={setting.placeholder}
                className={cn(getInputWidth(setting.inputWidth), error && 'border-red-500')}
              />
              {setting.type === 'password' && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                  onClick={() => setShowPasswords(prev => ({ ...prev, [setting.key]: !prev[setting.key] }))}
                >
                  {showPasswords[setting.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              )}
            </div>
            {setting.hint && !error && (
              <p className="text-xs text-muted-foreground">{setting.hint}</p>
            )}
            {error && (
              <p className="text-xs text-red-500">{error}</p>
            )}
          </div>
        );

      case 'number':
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor={setting.key}>{setting.label}</Label>
              {setting.help && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3 w-3 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">{setting.help}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            {setting.description && (
              <p className="text-sm text-muted-foreground">{setting.description}</p>
            )}
            <Input
              id={setting.key}
              type="number"
              value={value || ''}
              onChange={(e) => handleChange(setting.key, e.target.value ? Number(e.target.value) : '', setting)}
              placeholder={setting.placeholder}
              min={setting.min}
              max={setting.max}
              step={setting.step}
              className={cn(getInputWidth(setting.inputWidth), error && 'border-red-500')}
            />
            {setting.hint && !error && (
              <p className="text-xs text-muted-foreground">{setting.hint}</p>
            )}
            {error && (
              <p className="text-xs text-red-500">{error}</p>
            )}
          </div>
        );

      case 'boolean':
        return (
          <div className="flex items-center justify-between py-2">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Label htmlFor={setting.key}>{setting.label}</Label>
                {setting.help && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3 w-3 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">{setting.help}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              {setting.description && (
                <p className="text-sm text-muted-foreground">{setting.description}</p>
              )}
              {setting.hint && (
                <p className="text-xs text-muted-foreground">{setting.hint}</p>
              )}
            </div>
            <Switch
              id={setting.key}
              checked={value || false}
              onCheckedChange={(checked) => handleChange(setting.key, checked, setting)}
            />
          </div>
        );

      case 'select':
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor={setting.key}>{setting.label}</Label>
              {setting.help && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3 w-3 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">{setting.help}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            {setting.description && (
              <p className="text-sm text-muted-foreground">{setting.description}</p>
            )}
            <Select value={value || ''} onValueChange={(val) => handleChange(setting.key, val, setting)}>
              <SelectTrigger className={cn(getInputWidth(setting.inputWidth), error && 'border-red-500')}>
                <SelectValue placeholder="Select an option" />
              </SelectTrigger>
              <SelectContent>
                {setting.options?.map(option => (
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
            {setting.hint && !error && (
              <p className="text-xs text-muted-foreground">{setting.hint}</p>
            )}
            {error && (
              <p className="text-xs text-red-500">{error}</p>
            )}
          </div>
        );

      case 'textarea':
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor={setting.key}>{setting.label}</Label>
              {setting.help && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3 w-3 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">{setting.help}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            {setting.description && (
              <p className="text-sm text-muted-foreground">{setting.description}</p>
            )}
            <Textarea
              id={setting.key}
              value={value || ''}
              onChange={(e) => handleChange(setting.key, e.target.value, setting)}
              placeholder={setting.placeholder}
              className={cn(getInputWidth(setting.inputWidth), error && 'border-red-500')}
              rows={5}
            />
            {setting.hint && !error && (
              <p className="text-xs text-muted-foreground">{setting.hint}</p>
            )}
            {error && (
              <p className="text-xs text-red-500">{error}</p>
            )}
          </div>
        );

      case 'custom':
        return setting.customComponent;

      default:
        return null;
    }
  };

  const iconMap: Record<string, React.ElementType> = {
    Save,
    RotateCcw,
    AlertCircle,
    Eye,
    EyeOff,
    HelpCircle,
    Check,
    RefreshCw,
    Download
  };

  const activeSettings = categories.find(cat => cat.id === activeCategory);
  const hasErrors = Object.keys(errors).some(key => errors[key]);

  return (
    <div className={cn("space-y-6", className)}>
      {restartRequired && (
        <RestartBanner onRestart={onRestart} />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{title}</h1>
          <p className="text-muted-foreground">Configure application settings and preferences</p>
        </div>
        {onCheckUpdates && (
          <Button
            variant="outline"
            onClick={handleCheckUpdates}
            disabled={checkingUpdates}
          >
            {checkingUpdates ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Check for Updates
              </>
            )}
          </Button>
        )}
      </div>

      {updateAvailable && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {updateAvailable.available
              ? `A new version (${updateAvailable.version}) is available!`
              : 'You are running the latest version.'}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex gap-6">
        <Card className="w-64 h-fit">
          <div className="p-4">
            <h3 className="font-semibold mb-4">Categories</h3>
            <div className="space-y-1">
              {categories.map((category) => {
                const Icon = typeof category.icon === 'string' 
                  ? iconMap[category.icon] 
                  : category.icon;
                
                return (
                  <button
                    key={category.id}
                    onClick={() => setActiveCategory(category.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                      activeCategory === category.id
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    )}
                  >
                    {Icon && <Icon className="h-4 w-4" />}
                    <div className="text-left">
                      <div>{category.label}</div>
                      {category.description && (
                        <div className="text-xs opacity-80">{category.description}</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </Card>

        <Card className="flex-1">
          {loading ? (
            <div className="p-8 text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              <p className="mt-2 text-muted-foreground">Loading settings...</p>
            </div>
          ) : activeSettings ? (
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-1">{activeSettings.label}</h2>
              {activeSettings.description && (
                <p className="text-sm text-muted-foreground mb-6">{activeSettings.description}</p>
              )}
              
              <div className="space-y-6">
                {activeSettings.settings.map(setting => (
                  <div key={setting.key}>
                    {renderSetting(setting)}
                    {setting.requiresRestart && (
                      <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                        ⚠️ Requires restart
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              Select a category to view settings
            </div>
          )}
        </Card>
      </div>

      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={handleReset}
          disabled={saving}
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset to Defaults
        </Button>
        
        <div className="flex gap-2">
          <Button
            onClick={handleSave}
            disabled={!isDirty || hasErrors || saving}
          >
            {saving ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
