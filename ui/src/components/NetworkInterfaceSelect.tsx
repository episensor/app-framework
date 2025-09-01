import React, { useState, useEffect } from 'react';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../../components/base/select';
import { Badge } from '../../components/base/badge';
import { Alert, AlertDescription } from '../../components/base/alert';
import { Button } from '../../components/base/button';
import { Wifi, Globe, Home, AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/utils';

interface NetworkInterface {
  label: string;
  value: string;
  description: string;
  interface?: string;
}

interface NetworkInfo {
  hostname: string;
  primaryIp: string | null;
  interfaces: Array<{
    name: string;
    addresses: Array<{
      address: string;
      family: string;
      internal: boolean;
    }>;
  }>;
  totalInterfaces: number;
}

interface NetworkInterfaceSelectProps {
  value: string;
  onChange: (value: string) => void;
  apiUrl?: string;
  endpoint?: string;
  disabled?: boolean;
  className?: string;
  showRefresh?: boolean;
  showNetworkInfo?: boolean;
}

export function NetworkInterfaceSelect({ 
  value, 
  onChange, 
  apiUrl = '',
  endpoint = '/api/system/network/interfaces',
  disabled = false,
  className,
  showRefresh = true,
  showNetworkInfo = true
}: NetworkInterfaceSelectProps) {
  const [interfaces, setInterfaces] = useState<NetworkInterface[]>([]);
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInterfaces = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${apiUrl}${endpoint}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch network interfaces');
      }
      
      const data = await response.json();
      setInterfaces(data.interfaces || []);
      setNetworkInfo(data.networkInfo || null);
      
      // If current value is not in the list, add it as custom
      if (value && !data.interfaces.some((i: NetworkInterface) => i.value === value)) {
        setInterfaces(prev => [...prev, {
          label: `Custom (${value})`,
          value,
          description: 'Custom IP address',
          interface: 'custom'
        }]);
      }
    } catch (err) {
      console.error('Failed to fetch network interfaces:', err);
      setError('Failed to load network interfaces');
      
      // Fallback to basic options
      setInterfaces([
        {
          label: 'All interfaces (0.0.0.0)',
          value: '0.0.0.0',
          description: 'Accept connections from any network interface'
        },
        {
          label: 'Localhost only (127.0.0.1)',
          value: '127.0.0.1',
          description: 'Only accept connections from this machine'
        }
      ]);
      
      // If current value is custom, add it
      if (value && value !== '0.0.0.0' && value !== '127.0.0.1') {
        setInterfaces(prev => [...prev, {
          label: `Custom (${value})`,
          value,
          description: 'Custom IP address',
          interface: 'custom'
        }]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInterfaces();
  }, [apiUrl, endpoint]);

  const getIcon = (interfaceName?: string) => {
    if (!interfaceName) return <Globe className="h-4 w-4" />;
    if (interfaceName === 'lo' || interfaceName === 'localhost') {
      return <Home className="h-4 w-4" />;
    }
    if (interfaceName.includes('wlan') || interfaceName.includes('wi')) {
      return <Wifi className="h-4 w-4" />;
    }
    return <Globe className="h-4 w-4" />;
  };

  const selectedInterface = interfaces.find(i => i.value === value);

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center gap-2">
        <Select value={value} onValueChange={onChange} disabled={disabled || loading}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Select network interface">
              {selectedInterface && (
                <div className="flex items-center gap-2">
                  {getIcon(selectedInterface.interface)}
                  <span>{selectedInterface.label}</span>
                </div>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {interfaces.map((iface) => (
              <SelectItem key={iface.value} value={iface.value}>
                <div className="flex items-center gap-2">
                  {getIcon(iface.interface)}
                  <div className="flex-1">
                    <div className="font-medium">{iface.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {iface.description}
                    </div>
                  </div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        {showRefresh && (
          <Button
            variant="outline"
            size="icon"
            onClick={fetchInterfaces}
            disabled={loading}
            title="Refresh network interfaces"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {showNetworkInfo && networkInfo && !error && (
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="secondary">
            Hostname: {networkInfo.hostname}
          </Badge>
          {networkInfo.primaryIp && (
            <Badge variant="secondary">
              Primary IP: {networkInfo.primaryIp}
            </Badge>
          )}
          <Badge variant="outline">
            {networkInfo.totalInterfaces} interfaces detected
          </Badge>
        </div>
      )}
    </div>
  );
}
