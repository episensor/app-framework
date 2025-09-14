import { useState, ReactNode } from 'react';
import { Card } from '../../components/base/card';
import { Button } from '../../components/base/button';
import { Input } from '../../components/base/input';
import { Label } from '../../components/base/label';
import { Switch } from '../../components/base/switch';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../../components/base/select';
import { Alert, AlertDescription } from '../../components/base/alert';
import { RestartBanner } from '../../components/base/RestartBanner';
import { 
  Save, 
  RotateCcw, 
  AlertCircle, 
  Eye, 
  EyeOff
} from 'lucide-react';
import { cn } from '../../lib/utils';

export interface SettingDefinition {
  key: string;
  label: string;
  description?: string;
  type: 'text' | 'password' | 'number' | 'boolean' | 'select' | 'custom';
  options?: Array<{ value: string; label: string }>;
  defaultValue?: any;
  validation?: (value: any) => string | null;
  requiresRestart?: boolean;
  customComponent?: ReactNode;
  placeholder?: string;
  min?: number;
  max?: number;
}

export interface SettingsCategory {
  id: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  settings: SettingDefinition[];
}

export interface SettingsPageProps {
  categories: SettingsCategory[];
  values: Record<string, any>;
  loading?: boolean;
  saving?: boolean;
  onSave: (values: Record<string, any>) => Promise<void>;
  onReset?: () => void;
  onRestart?: () => void;
  showRestartBanner?: boolean;
  className?: string;
  title?: string;
}

export function SettingsPage({
  categories,
  values: initialValues,
  loading = false,
  saving = false,
  onSave,
  onReset,
  onRestart,
  showRestartBanner = false,
  className,
  title = 'Settings'
}: SettingsPageProps) {
  const [values, setValues] = useState<Record<string, any>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeCategory, setActiveCategory] = useState(categories[0]?.id || '');
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [isDirty, setIsDirty] = useState(false);

  const handleChange = (key: string, value: any) => {
    setValues(prev => ({ ...prev, [key]: value }));
    setIsDirty(true);
    
    // Validate on change
    const setting = categories
      .flatMap(c => c.settings)
      .find(s => s.key === key);
    
    if (setting?.validation) {
      const error = setting.validation(value);
      setErrors(prev => ({
        ...prev,
        [key]: error || ''
      }));
    }
  };

  const handleSave = async () => {
    // Validate all fields
    const newErrors: Record<string, string> = {};
    let hasErrors = false;
    
    categories.forEach(category => {
      category.settings.forEach(setting => {
        if (setting.validation) {
          const error = setting.validation(values[setting.key]);
          if (error) {
            newErrors[setting.key] = error;
            hasErrors = true;
          }
        }
      });
    });
    
    if (hasErrors) {
      setErrors(newErrors);
      return;
    }
    
    await onSave(values);
    setIsDirty(false);
  };

  const handleReset = () => {
    setValues(initialValues);
    setErrors({});
    setIsDirty(false);
    if (onReset) onReset();
  };

  const activeSettings = categories.find(c => c.id === activeCategory)?.settings || [];

  const renderSettingInput = (setting: SettingDefinition) => {
    const value = values[setting.key] ?? setting.defaultValue;
    const error = errors[setting.key];
    
    switch (setting.type) {
      case 'text':
        return (
          <Input
            value={value || ''}
            onChange={(e) => handleChange(setting.key, e.target.value)}
            placeholder={setting.placeholder}
            className={error ? 'border-red-500' : ''}
          />
        );
        
      case 'password':
        return (
          <div className="relative">
            <Input
              type={showPasswords[setting.key] ? 'text' : 'password'}
              value={value || ''}
              onChange={(e) => handleChange(setting.key, e.target.value)}
              placeholder={setting.placeholder}
              className={cn('pr-10', error ? 'border-red-500' : '')}
            />
            <button
              type="button"
              onClick={() => setShowPasswords(prev => ({
                ...prev,
                [setting.key]: !prev[setting.key]
              }))}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
            >
              {showPasswords[setting.key] ? 
                <EyeOff className="h-4 w-4" /> : 
                <Eye className="h-4 w-4" />
              }
            </button>
          </div>
        );
        
      case 'number':
        return (
          <Input
            type="number"
            value={value || ''}
            onChange={(e) => handleChange(setting.key, parseFloat(e.target.value))}
            min={setting.min}
            max={setting.max}
            placeholder={setting.placeholder}
            className={error ? 'border-red-500' : ''}
          />
        );
        
      case 'boolean':
        return (
          <Switch
            checked={value || false}
            onCheckedChange={(checked) => handleChange(setting.key, checked)}
          />
        );
        
      case 'select':
        return (
          <Select 
            value={String(value || '')} 
            onValueChange={(val) => handleChange(setting.key, val)}
          >
            <SelectTrigger className={error ? 'border-red-500' : ''}>
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              {setting.options?.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
        
      case 'custom':
        return setting.customComponent;
        
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {showRestartBanner && (
        <RestartBanner
          show={true}
          onRestart={onRestart}
          onDismiss={() => {}}
        />
      )}
      
      <div className={cn("space-y-6", className)}>
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">{title}</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={!isDirty || saving}
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!isDirty || saving || Object.keys(errors).some(k => errors[k])}
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Categories sidebar */}
          <div className="col-span-3">
            <Card className="p-2">
              {categories.map(category => (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory(category.id)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-md transition-colors flex items-center gap-2",
                    activeCategory === category.id
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-gray-100 dark:hover:bg-gray-800"
                  )}
                >
                  {category.icon}
                  <div>
                    <div className="font-medium">{category.label}</div>
                    {category.description && (
                      <div className="text-xs opacity-70">{category.description}</div>
                    )}
                  </div>
                </button>
              ))}
            </Card>
          </div>

          {/* Settings form */}
          <div className="col-span-9">
            <Card className="p-6">
              <div className="space-y-6">
                {activeSettings.map(setting => (
                  <div key={setting.key} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor={setting.key}>
                        {setting.label}
                        {setting.requiresRestart && (
                          <span className="ml-2 text-xs text-amber-600">
                            (Requires restart)
                          </span>
                        )}
                      </Label>
                    </div>
                    
                    {setting.description && (
                      <p className="text-sm text-muted-foreground">
                        {setting.description}
                      </p>
                    )}
                    
                    {renderSettingInput(setting)}
                    
                    {errors[setting.key] && (
                      <Alert variant="destructive" className="py-2">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{errors[setting.key]}</AlertDescription>
                      </Alert>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
