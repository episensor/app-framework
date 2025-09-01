/**
 * Network Interface Selector Component
 * Simplified network interface selection UI
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './Card';

export interface NetworkInterface {
  name: string;
  addresses: Array<{
    address: string;
    family: 'IPv4' | 'IPv6';
    internal: boolean;
  }>;
  mac?: string;
}

export interface NetworkInterfaceSelectorProps {
  interfaces?: NetworkInterface[];
  selectedInterface?: string;
  onInterfaceChange?: (interfaceName: string, address: string) => void;
  showTestButton?: boolean;
  apiUrl?: string;
}

export function NetworkInterfaceSelector({
  interfaces: providedInterfaces,
  selectedInterface,
  onInterfaceChange,
  showTestButton = true,
  apiUrl = '/api/network/interfaces'
}: NetworkInterfaceSelectorProps) {
  const [interfaces, setInterfaces] = useState<NetworkInterface[]>(providedInterfaces || []);
  const [selected, setSelected] = useState<{ interface: string; address: string } | null>(null);
  const [loading, setLoading] = useState(!providedInterfaces);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    if (!providedInterfaces) {
      fetchInterfaces();
    }
  }, []);

  const fetchInterfaces = async () => {
    try {
      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error('Failed to fetch interfaces');
      const data = await response.json();
      setInterfaces(data.interfaces || []);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch network interfaces:', error);
      setLoading(false);
    }
  };

  const handleInterfaceSelect = (interfaceName: string, address: string) => {
    setSelected({ interface: interfaceName, address });
    if (onInterfaceChange) {
      onInterfaceChange(interfaceName, address);
    }
    setTestResult(null);
  };

  const testInterface = async () => {
    if (!selected) return;
    
    setTesting(true);
    setTestResult(null);
    
    try {
      const response = await fetch('/api/network/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interface: selected.interface,
          address: selected.address
        })
      });
      
      const result = await response.json();
      setTestResult(result.success ? '✅ Connection successful' : '❌ Connection failed');
    } catch (error) {
      setTestResult('❌ Test failed');
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent>
          <div className="p-4 text-center text-gray-500">
            Loading network interfaces...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>📡 Network Interface Selection</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {interfaces.length === 0 ? (
            <div className="text-gray-500">No network interfaces available</div>
          ) : (
            <div className="space-y-2">
              {interfaces.map((iface) => (
                <div key={iface.name} className="border rounded-lg p-3">
                  <div className="font-medium mb-2">{iface.name}</div>
                  <div className="space-y-1">
                    {iface.addresses
                      .filter(addr => addr.family === 'IPv4' && !addr.internal)
                      .map((addr) => (
                        <label
                          key={addr.address}
                          className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded"
                        >
                          <input
                            type="radio"
                            name="network-interface"
                            checked={selected?.address === addr.address}
                            onChange={() => handleInterfaceSelect(iface.name, addr.address)}
                            className="text-blue-600"
                          />
                          <span className="text-sm">{addr.address}</span>
                        </label>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {selected && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <div className="text-sm">
                <div className="font-medium text-blue-900">Selected:</div>
                <div className="text-blue-700">
                  {selected.interface}: {selected.address}
                </div>
              </div>
            </div>
          )}

          {showTestButton && selected && (
            <button
              onClick={testInterface}
              disabled={testing}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {testing ? 'Testing...' : 'Test Connection'}
            </button>
          )}

          {testResult && (
            <div className={`p-3 rounded-lg ${
              testResult.includes('✅') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
            }`}>
              {testResult}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}