import { 
  Server, Network, FileText, Shield, Mail, Settings,
  Database, Bell, Users, Palette, Globe, Activity
} from 'lucide-react';
import { SettingsCategory } from '../pages/SettingsPage';

/**
 * Default settings categories with icons for common application settings
 * Apps can import and extend these categories or create their own
 */
export const defaultSettingsCategories: SettingsCategory[] = [
  {
    id: 'general',
    label: 'General',
    description: 'Basic application settings',
    icon: <Settings className="h-4 w-4" />,
    settings: []
  },
  {
    id: 'network',
    label: 'Network',
    description: 'Network and connectivity',
    icon: <Network className="h-4 w-4" />,
    settings: []
  },
  {
    id: 'logging',
    label: 'Logging',
    description: 'Logging configuration',
    icon: <FileText className="h-4 w-4" />,
    settings: []
  },
  {
    id: 'security',
    label: 'Security',
    description: 'Security settings',
    icon: <Shield className="h-4 w-4" />,
    settings: []
  },
  {
    id: 'notifications',
    label: 'Notifications',
    description: 'Email and alerts',
    icon: <Mail className="h-4 w-4" />,
    settings: []
  },
  {
    id: 'appearance',
    label: 'Appearance',
    description: 'UI preferences',
    icon: <Palette className="h-4 w-4" />,
    settings: []
  },
  {
    id: 'advanced',
    label: 'Advanced',
    description: 'Advanced settings',
    icon: <Activity className="h-4 w-4" />,
    settings: []
  }
];

/**
 * Helper function to create a settings category with icon
 */
export function createSettingsCategory(
  id: string,
  label: string,
  iconName: keyof typeof iconMap,
  description?: string
): Omit<SettingsCategory, 'settings'> {
  return {
    id,
    label,
    description,
    icon: iconMap[iconName] ? <>{iconMap[iconName]}</> : <Settings className="h-4 w-4" />
  };
}

// Icon map for easy reference
const iconMap = {
  Server: <Server className="h-4 w-4" />,
  Network: <Network className="h-4 w-4" />,
  FileText: <FileText className="h-4 w-4" />,
  Shield: <Shield className="h-4 w-4" />,
  Mail: <Mail className="h-4 w-4" />,
  Settings: <Settings className="h-4 w-4" />,
  Database: <Database className="h-4 w-4" />,
  Bell: <Bell className="h-4 w-4" />,
  Users: <Users className="h-4 w-4" />,
  Palette: <Palette className="h-4 w-4" />,
  Globe: <Globe className="h-4 w-4" />,
  Activity: <Activity className="h-4 w-4" />
};
