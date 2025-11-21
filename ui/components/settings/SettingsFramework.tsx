import { useState, useEffect, ReactNode } from 'react';
import { Card } from '../base/card';
import { Button } from '../base/button';
import { Input } from '../base/input';
import { Label } from '../base/label';
import { Switch } from '../base/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../base/select';
import { Alert, AlertDescription } from '../base/alert';
import { 
  Save, RefreshCw, Check, AlertCircle, Eye, EyeOff, Info, Undo, RotateCcw, LucideIcon
} from 'lucide-react';
import { cn } from '../../src/utils/cn';

// Extensible type definitions
export interface SettingDefinition {
  key: string;
  label: string;
  type: 'string' | 'text' | 'number' | 'boolean' | 'select' | 'password' | 'custom';
  defaultValue?: any;
  description?: string;
  help?: string;
  hint?: string;
  placeholder?: string;
  options?: Array<{ label: string; value: string | number }>;
  validation?: (value: any) => string | null;
  requiresRestart?: boolean;
  hidden?: boolean;
  customComponent?: React.ComponentType<CustomFieldProps>;
  // Additional UI properties
  inputWidth?: 'small' | 'medium' | 'large';
  suffix?: string;
  step?: number;
  min?: number;
  max?: number;
  showIf?: (values: any) => boolean;
}

export interface SettingsCategory {
  id: string;
  label: string;
  icon?: LucideIcon | string | React.ReactNode;
  description?: string;
  settings: SettingDefinition[];
}

export interface CustomFieldProps {
  value: any;
  onChange: (value: any) => void;
  error?: string;
  disabled?: boolean;
  setting: SettingDefinition;
}

export interface SettingsFrameworkProps {
  // Required props
  categories: SettingsCategory[];
  onSave: (values: Record<string, any>) => Promise<void>;
  
  // Optional props for customization
  onLoad?: () => Promise<Record<string, any>>;
  onValidate?: (values: Record<string, any>) => Record<string, string> | null;
  onRestartRequired?: (changedSettings: string[]) => void;
  
  // UI customization
  title?: string;
  description?: string;
  showResetButton?: boolean;
  showUndoButton?: boolean;
  customFields?: Record<string, React.ComponentType<CustomFieldProps>>;
  renderCategory?: (category: SettingsCategory, children: ReactNode) => ReactNode;
  renderSetting?: (setting: SettingDefinition, field: ReactNode) => ReactNode;
  
  // Behavior customization
  autoSave?: boolean;
  autoSaveDelay?: number;
  confirmReset?: boolean;
  persistState?: boolean;
  
  // Styling
  className?: string;
  containerClassName?: string;
  categoryClassName?: string;
  settingClassName?: string;
}

export function SettingsFramework({
  categories,
  onSave,
  onLoad,
  onValidate,
  onRestartRequired,
  title = "Settings",
  description = "Configure application preferences",
  showResetButton = true,
  showUndoButton = true,
  customFields = {},
  renderCategory,
  renderSetting,
  autoSave = false,
  autoSaveDelay = 3000,
  confirmReset = true,
  persistState = true,
  className,
  containerClassName,
  categoryClassName,
  settingClassName
}: SettingsFrameworkProps) {
  const [values, setValues] = useState<Record<string, any>>({});
  const [initialValues, setInitialValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeCategory, setActiveCategory] = useState(categories?.[0]?.id || '');
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [restartRequired, setRestartRequired] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Build default values from settings definition
  const getDefaultValues = () => {
    const defaults: Record<string, any> = {};
    categories.forEach(category => {
      category.settings.forEach(setting => {
        defaults[setting.key] = setting.defaultValue;
      });
    });
    return defaults;
  };

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);
      try {
        const loadedValues = onLoad ? await onLoad() : getDefaultValues();
        setValues(loadedValues);
        setInitialValues(loadedValues);
        
        if (persistState) {
          const savedCategory = localStorage.getItem('settings-active-category');
          if (savedCategory && categories.find(c => c.id === savedCategory)) {
            setActiveCategory(savedCategory);
          }
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
        setValues(getDefaultValues());
        setInitialValues(getDefaultValues());
      } finally {
        setLoading(false);
      }
    };
    
    loadSettings();
  }, []);

  // Track dirty state
  useEffect(() => {
    const dirty = JSON.stringify(values) !== JSON.stringify(initialValues);
    setIsDirty(dirty);
  }, [values, initialValues]);

  // Auto-save functionality
  useEffect(() => {
    if (!autoSave || !isDirty) return;
    
    const timer = setTimeout(() => {
      handleSave();
    }, autoSaveDelay);
    
    return () => clearTimeout(timer);
  }, [values, autoSave, autoSaveDelay, isDirty]);

  // Persist active category
  useEffect(() => {
    if (persistState) {
      localStorage.setItem('settings-active-category', activeCategory);
    }
  }, [activeCategory, persistState]);

  const validateField = (setting: SettingDefinition, value: any): string | null => {
    if (setting.validation) {
      return setting.validation(value);
    }
    return null;
  };

  const validateAll = (): boolean => {
    const newErrors: Record<string, string> = {};
    let hasErrors = false;
    
    categories.forEach(category => {
      category.settings.forEach(setting => {
        const error = validateField(setting, values[setting.key]);
        if (error) {
          newErrors[setting.key] = error;
          hasErrors = true;
        }
      });
    });
    
    if (onValidate) {
      const customErrors = onValidate(values);
      if (customErrors) {
        Object.assign(newErrors, customErrors);
        hasErrors = true;
      }
    }
    
    setErrors(newErrors);
    return !hasErrors;
  };

  const handleSave = async () => {
    if (!validateAll()) return;
    
    setSaving(true);
    try {
      // Check for settings that require restart
      const changedKeys = Object.keys(values).filter(
        key => values[key] !== initialValues[key]
      );
      
      const restartSettings = changedKeys.filter(key => {
        const setting = categories
          .flatMap(c => c.settings)
          .find(s => s.key === key);
        return setting?.requiresRestart;
      });
      
      if (restartSettings.length > 0) {
        setRestartRequired(true);
        onRestartRequired?.(restartSettings);
      }
      
      await onSave(values);
      setInitialValues(values);
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSaveError(error instanceof Error ? error.message : 'Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (confirmReset && !confirm('Reset all settings to defaults? This will override your current configuration.')) {
      return;
    }
    const defaults = getDefaultValues();
    setValues(defaults);
  };

  const handleUndo = () => {
    setValues(initialValues);
  };

  const setValue = (key: string, value: any) => {
    setValues(prev => ({ ...prev, [key]: value }));
    
    // Clear field error when value changes
    if (errors[key]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
    
    // Clear save error when user makes changes
    if (saveError) {
      setSaveError(null);
    }
  };

  const renderField = (setting: SettingDefinition) => {
    if (setting.hidden) return null;
    
    const value = values[setting.key] ?? setting.defaultValue;
    const error = errors[setting.key];
    const showPassword = showPasswords[setting.key];
    if (setting.showIf && !setting.showIf(values)) return null;

    const widthClass = setting.inputWidth === 'small'
      ? 'max-w-[180px]'
      : setting.inputWidth === 'medium'
        ? 'max-w-sm'
        : setting.inputWidth === 'large'
          ? 'w-full'
          : undefined;
    
    // Custom field component
    if (setting.type === 'custom' || setting.customComponent) {
      const CustomComponent = setting.customComponent || customFields[setting.type];
      if (CustomComponent) {
        return (
          <CustomComponent
            value={value}
            onChange={(val) => setValue(setting.key, val)}
            error={error}
            disabled={saving}
            setting={setting}
          />
        );
      }
    }
    
    // Check for custom field type
    const CustomField = customFields[setting.type];
    if (CustomField) {
      return (
        <CustomField
          value={value}
          onChange={(val) => setValue(setting.key, val)}
          error={error}
          disabled={saving}
          setting={setting}
        />
      );
    }
    
    // Default field types
    switch (setting.type) {
      case 'string':
      case 'text':
      case 'password':
        return (
          <div className={cn("flex items-center gap-2", widthClass)}>
            <Input
              id={setting.key}
              type={setting.type === 'password' && !showPassword ? 'password' : 'text'}
              value={value || ''}
              onChange={(e) => setValue(setting.key, e.target.value)}
              className={cn(error && "border-red-500", widthClass)}
              placeholder={setting.placeholder || (setting.type === 'password' ? '••••••••' : undefined)}
              disabled={saving}
            />
            {setting.suffix && (
              <span className="text-xs text-muted-foreground">{setting.suffix}</span>
            )}
          </div>
        );
      
      case 'number':
        return (
          <div className={cn("flex items-center gap-2", widthClass)}>
            <Input
              id={setting.key}
              type="number"
              value={value ?? ''}
              onChange={(e) => setValue(setting.key, parseFloat(e.target.value) || 0)}
              className={cn(error && "border-red-500", widthClass)}
              placeholder={setting.placeholder}
              disabled={saving}
              step={setting.step}
              min={setting.min}
              max={setting.max}
            />
            {setting.suffix && (
              <span className="text-xs text-muted-foreground">{setting.suffix}</span>
            )}
          </div>
        );
      
      case 'boolean':
        return (
          <Switch
            id={setting.key}
            checked={value || false}
            onCheckedChange={(checked) => setValue(setting.key, checked)}
            disabled={saving}
          />
        );
      
      case 'select':
        return (
          <Select
            value={String(value || setting.defaultValue)}
            onValueChange={(val) => setValue(setting.key, val)}
            disabled={saving}
          >
            <SelectTrigger id={setting.key} className={cn(error && "border-red-500")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {setting.options?.map(option => (
                <SelectItem key={option.value} value={String(option.value)}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      
      default:
        return null;
    }
  };

  const activeSettings = categories.find(cat => cat.id === activeCategory);
  
  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{title}</h1>
          <p className="text-muted-foreground">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          {showUndoButton && isDirty && (
            <Button 
              variant="outline"
              onClick={handleUndo}
              disabled={saving}
            >
              <Undo className="h-4 w-4 mr-2" />
              Undo
            </Button>
          )}
          {showResetButton && (
            <Button 
              variant="outline"
              onClick={handleReset}
              disabled={saving}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Defaults
            </Button>
          )}
          <Button 
            onClick={handleSave} 
            disabled={!isDirty || saving}
            className={cn(
              "transition-all",
              isDirty && "ring-2 ring-primary/20"
            )}
          >
            {saving ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : isDirty ? (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Saved
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Error message display */}
      {saveError && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {saveError}
          </AlertDescription>
        </Alert>
      )}

      <div className={cn("flex gap-6", containerClassName)}>
        {/* Categories Sidebar */}
        <Card className="w-64 h-fit">
          <div className="p-4">
            <h3 className="font-semibold mb-4">Categories</h3>
            <div className="space-y-1">
              {categories.map((category) => {
                return (
                  <button
                    key={category.id}
                    onClick={() => setActiveCategory(category.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                      activeCategory === category.id
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted",
                      categoryClassName
                    )}
                  >
                    {typeof category.icon === 'function' && (
                      // Only render Lucide-like icons; skip arbitrary React nodes to avoid invalid children
                      (() => {
                        const IconComponent = category.icon as LucideIcon;
                        return <IconComponent className="h-4 w-4" />;
                      })()
                    )}
                    <span className="text-left">{category.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </Card>

        {/* Settings Content */}
        <div className="flex-1">
          {loading ? (
            <Card className="p-8">
              <div className="flex items-center justify-center">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            </Card>
          ) : activeSettings ? (
            <Card className="p-6">
              {renderCategory ? (
                renderCategory(activeSettings, (
                  <div className="space-y-6">
                    {activeSettings.settings.map(setting => {
                      const field = renderField(setting);
                      if (!field) return null;
                      
                      const settingElement = (
                        <div key={setting.key} className={cn("space-y-2", settingClassName)}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Label htmlFor={setting.key} className="text-sm font-medium">
                                {setting.label}
                                {setting.requiresRestart && (
                                  <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">
                                    (Requires restart)
                                  </span>
                                )}
                              </Label>
                              {setting.help && (
                                <button
                                  type="button"
                                  className="text-muted-foreground hover:text-foreground transition-colors"
                                  title={setting.help}
                                >
                                  <Info className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                            {setting.type === 'password' && values[setting.key] && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2"
                                onClick={() => setShowPasswords(prev => ({ 
                                  ...prev, 
                                  [setting.key]: !prev[setting.key] 
                                }))}
                              >
                                {showPasswords[setting.key] ? (
                                  <EyeOff className="h-3 w-3" />
                                ) : (
                                  <Eye className="h-3 w-3" />
                                )}
                              </Button>
                            )}
                          </div>
                          
                          {setting.description && (
                            <p className="text-xs text-muted-foreground">{setting.description}</p>
                          )}
                          {setting.hint && (
                            <p className="text-[11px] text-muted-foreground">{setting.hint}</p>
                          )}
                          
                          {field}
                          
                          {errors[setting.key] && (
                            <p className="text-xs text-red-500">{errors[setting.key]}</p>
                          )}
                        </div>
                      );
                      
                      return renderSetting ? renderSetting(setting, settingElement) : settingElement;
                    })}
                  </div>
                ))
              ) : (
                <>
                  <div className="mb-6">
                    <h2 className="text-xl font-semibold">{activeSettings.label}</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      {activeSettings.description}
                    </p>
                  </div>
                  
                  <div className="space-y-6">
                    {activeSettings.settings.map(setting => {
                      const field = renderField(setting);
                      if (!field) return null;
                      
                      const settingElement = (
                        <div key={setting.key} className={cn("space-y-2", settingClassName)}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Label htmlFor={setting.key} className="text-sm font-medium">
                                {setting.label}
                                {setting.requiresRestart && (
                                  <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">
                                    (Requires restart)
                                  </span>
                                )}
                              </Label>
                              {setting.help && (
                                <button
                                  type="button"
                                  className="text-muted-foreground hover:text-foreground transition-colors"
                                  title={setting.help}
                                >
                                  <Info className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                            {setting.type === 'password' && values[setting.key] && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2"
                                onClick={() => setShowPasswords(prev => ({ 
                                  ...prev, 
                                  [setting.key]: !prev[setting.key] 
                                }))}
                              >
                                {showPasswords[setting.key] ? (
                                  <EyeOff className="h-3 w-3" />
                                ) : (
                                  <Eye className="h-3 w-3" />
                                )}
                              </Button>
                            )}
                          </div>
                          
                          {setting.description && (
                            <p className="text-xs text-muted-foreground">{setting.description}</p>
                          )}
                          
                          {field}
                          
                          {errors[setting.key] && (
                            <p className="text-xs text-red-500">{errors[setting.key]}</p>
                          )}
                        </div>
                      );
                      
                      return renderSetting ? renderSetting(setting, settingElement) : settingElement;
                    })}
                  </div>
                </>
              )}
            </Card>
          ) : (
            <Card className="p-8">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No settings available for this category
                </AlertDescription>
              </Alert>
            </Card>
          )}
        </div>
      </div>
      
      {restartRequired && (
        <Alert className="border-amber-500">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription>
            Some settings require a restart to take effect.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
