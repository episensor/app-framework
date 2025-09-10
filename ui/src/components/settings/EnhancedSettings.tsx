import { useState, useEffect } from 'react';
import { 
  Card, 
  Button, 
  Input, 
  Label, 
  Switch, 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue,
  Alert,
  AlertDescription,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '../base';
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
  AlertCircle
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useFormState } from '../../hooks/useFormState';
import { 
  SettingsSchema, 
  SettingDefinition,
  flattenSettings,
  unflattenSettings,
  validateSettings,
  getRestartRequiredSettings
} from '../../../src/settings/SettingsSchema';

interface EnhancedSettingsProps {
  schema: SettingsSchema;
  apiEndpoints?: {
    get?: string;
    save?: string;
  };
  className?: string;
  onError?: (error: Error) => void;
  onSave?: (settings: Record<string, any>) => void | Promise<void>;
}

export function EnhancedSettings({
  schema,
  apiEndpoints = {
    get: '/api/settings',
    save: '/api/settings'
  },
  className,
  onError,
  onSave
}: EnhancedSettingsProps) {
  const [initialSettings, setInitialSettings] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState(schema.categories[0]?.id || '');
  const [restartRequired, setRestartRequired] = useState(false);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Build default values from schema
  const getDefaultValues = () => {
    const defaults: any = {};
    schema.categories.forEach(category => {
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
    return defaults;
  };

  const formState = useFormState({
    initialValues: initialSettings,
    defaultValues: getDefaultValues(),
    onSave: async (values) => {
      // Validate settings
      const flat = flattenSettings(values);
      const errors = validateSettings(schema, flat);
      
      if (Object.keys(errors).length > 0) {
        setValidationErrors(errors);
        throw new Error('Validation failed');
      }
      
      // Check restart required
      const changedKeys = Object.keys(flat).filter(
        key => JSON.stringify(flat[key]) !== JSON.stringify(flattenSettings(initialSettings)[key])
      );
      
      const restartSettings = getRestartRequiredSettings(schema, 
        changedKeys.reduce((acc, key) => ({ ...acc, [key]: flat[key] }), {})
      );
      
      if (restartSettings.length > 0) {
        setRestartRequired(true);
      }
      
      // Call custom onSave if provided
      if (onSave) {
        await onSave(flat);
      } else if (apiEndpoints.save) {
        // Save via API
        const response = await fetch(apiEndpoints.save, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(flat),
        });
        
        if (!response.ok) {
          throw new Error('Failed to save settings');
        }
      }
      
      setInitialSettings(values);
      setValidationErrors({});
    },
    timeout: 15000
  });

  // Fetch settings
  useEffect(() => {
    const fetchSettings = async () => {
      if (!apiEndpoints.get) {
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        const response = await fetch(apiEndpoints.get);
        const data = await response.json();
        
        const settings = unflattenSettings(data);
        setInitialSettings(settings);
        formState.setValues(settings);
      } catch (error) {
        onError?.(error as Error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchSettings();
  }, [apiEndpoints.get]);

  const renderSettingField = (setting: SettingDefinition) => {
    const value = formState.getValue(setting.key);
    const error = validationErrors[setting.key] || formState.errors[setting.key];
    const isDirty = formState.dirtyFields[setting.key];
    const showPassword = showPasswords[setting.key];
    
    // Check showIf condition
    if (setting.showIf) {
      const flat = flattenSettings(formState.values);
      if (!setting.showIf(flat)) {
        return null;
      }
    }
    
    const handleChange = async (newValue: any) => {
      // Apply transformation if needed
      if (setting.transform?.toStorage) {
        newValue = setting.transform.toStorage(newValue);
      }
      
      // Handle confirmation
      if (setting.confirmMessage && !confirm(setting.confirmMessage)) {
        return;
      }
      
      formState.setValue(setting.key, newValue);
      
      // Call schema's onSettingChange if provided
      if (schema.onSettingChange) {
        const oldValue = value;
        await schema.onSettingChange(setting.key, newValue, oldValue);
      }
    };
    
    const getInputWidth = () => {
      const widthMap = {
        small: 'max-w-xs',
        medium: 'max-w-md',
        large: 'max-w-lg',
        full: 'w-full'
      };
      return widthMap[setting.inputWidth || 'medium'];
    };
    
    return (
      <div key={setting.key} className="space-y-2">
        <div className="flex items-center gap-2">
          <Label 
            htmlFor={setting.key}
            className={cn(
              "text-sm font-medium",
              error && "text-red-500",
              isDirty && "text-blue-600"
            )}
          >
            {setting.label}
            {setting.required && <span className="text-red-500 ml-1">*</span>}
          </Label>
          
          {setting.help && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-3.5 w-3.5 text-gray-400" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs text-sm">{setting.help}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          {isDirty && (
            <Badge variant="secondary" className="text-xs">
              Modified
            </Badge>
          )}
        </div>
        
        {setting.description && (
          <p className="text-sm text-gray-500">{setting.description}</p>
        )}
        
        <div className="mt-2">
          {setting.type === 'boolean' ? (
            <Switch
              id={setting.key}
              checked={value || false}
              onCheckedChange={handleChange}
              disabled={setting.readOnly}
            />
          ) : setting.type === 'select' ? (
            <Select
              value={value || ''}
              onValueChange={handleChange}
              disabled={setting.readOnly}
            >
              <SelectTrigger className={cn(error && "border-red-500", getInputWidth())}>
                <SelectValue placeholder={setting.placeholder || 'Select...'} />
              </SelectTrigger>
              <SelectContent>
                {setting.options?.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                    {option.description && (
                      <span className="block text-xs text-gray-500">
                        {option.description}
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : setting.type === 'textarea' || setting.type === 'json' ? (
            <Textarea
              id={setting.key}
              value={value || ''}
              onChange={(e) => handleChange(e.target.value)}
              className={cn(error && "border-red-500", getInputWidth())}
              placeholder={setting.placeholder}
              disabled={setting.readOnly}
              rows={setting.type === 'json' ? 10 : 4}
            />
          ) : setting.type === 'network-interface' ? (
            <NetworkInterfaceSelect
              value={value}
              onChange={handleChange}
              className={getInputWidth()}
            />
          ) : (
            <div className={cn("flex items-center gap-2", getInputWidth())}>
              {setting.prefix && (
                <span className="text-sm text-gray-500">{setting.prefix}</span>
              )}
              <div className="relative flex-1">
                <Input
                  id={setting.key}
                  type={setting.type === 'password' && !showPassword ? 'password' : 
                        setting.type === 'number' ? 'number' : 'text'}
                  value={value || ''}
                  onChange={(e) => handleChange(
                    setting.type === 'number' ? Number(e.target.value) : e.target.value
                  )}
                  className={cn(
                    error && "border-red-500",
                    setting.type === 'password' && 'pr-10'
                  )}
                  placeholder={setting.placeholder || (setting.type === 'password' ? '••••••••' : undefined)}
                  disabled={setting.readOnly}
                  min={setting.validation?.min}
                  max={setting.validation?.max}
                />
                {setting.type === 'password' && value && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute inset-y-0 right-0 h-full px-2 flex items-center justify-center"
                    onClick={() => setShowPasswords(prev => ({
                      ...prev,
                      [setting.key]: !prev[setting.key]
                    }))}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
              {setting.suffix && (
                <span className="text-sm text-gray-500 whitespace-nowrap">{setting.suffix}</span>
              )}
            </div>
          )}
        </div>
        
        {error && (
          <p className="text-sm text-red-500 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {error}
          </p>
        )}
      </div>
    );
  };

  const activeCategory = schema.categories.find(cat => cat.id === activeCategory);
  const categorySettings = activeCategory?.settings || [];
  
  // Group by subcategory
  const grouped = categorySettings.reduce((acc, setting) => {
    const key = setting.subcategory || 'general';
    if (!acc[key]) acc[key] = [];
    acc[key].push(setting);
    return acc;
  }, {} as Record<string, SettingDefinition[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {restartRequired && (
        <RestartBanner
          message="Some settings require a restart to take effect"
          onDismiss={() => setRestartRequired(false)}
        />
      )}
      
      <div className="flex h-full">
        {/* Sidebar */}
        <div className="w-64 flex-none border-r bg-gray-50 dark:bg-gray-900 p-4">
          <h2 className="text-lg font-semibold mb-4">Settings</h2>
          <nav className="space-y-1">
            {schema.categories.map(category => {
              const Icon = category.icon ? require('lucide-react')[category.icon] : null;
              const isActive = activeCategory === category.id;
              
              return (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory(category.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-gray-100 dark:hover:bg-gray-800"
                  )}
                >
                  {Icon && <Icon className="h-4 w-4" />}
                  <span className="font-medium">{category.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
        
        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          {activeCategory && (
            <>
              <div className="mb-6">
                <h3 className="text-xl font-semibold">{activeCategory.label}</h3>
                {activeCategory.description && (
                  <p className="text-sm text-gray-500 mt-1">{activeCategory.description}</p>
                )}
              </div>
              
              <div className="space-y-8 max-w-4xl">
                {Object.entries(grouped).map(([subcategory, settings]) => (
                  <div key={subcategory}>
                    {subcategory !== 'general' && (
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4 uppercase tracking-wider">
                        {subcategory.replace(/_/g, ' ')}
                      </h4>
                    )}
                    <div className="space-y-6">
                      {settings.map(renderSettingField)}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      
      {/* Footer */}
      <div className="flex-none border-t px-6 py-4 bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            {formState.isDirty && (
              <>
                <AlertCircle className="h-4 w-4" />
                <span>You have unsaved changes</span>
              </>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => formState.reset()}
              disabled={!formState.isDirty || formState.isSubmitting}
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Undo
            </Button>
            
            <Button
              onClick={() => formState.handleSubmit()}
              disabled={!formState.isDirty || formState.isSubmitting}
            >
              {formState.isSubmitting ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : formState.isSubmitSuccessful ? (
                <Check className="h-4 w-4 mr-1" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              {formState.isSubmitting ? 'Saving...' : 
               formState.isSubmitSuccessful ? 'Saved!' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
