import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsFramework, SettingsCategory } from '../components/settings/SettingsFramework';
import { Settings } from 'lucide-react';

describe('SettingsFramework', () => {
  const mockCategories: SettingsCategory[] = [
    {
      id: 'general',
      label: 'General',
      icon: Settings,
      description: 'General application settings',
      settings: [
        {
          key: 'appName',
          label: 'Application Name',
          type: 'string',
          defaultValue: 'My App',
          description: 'The name of your application',
          validation: (value) => value.length > 0 || 'Name is required'
        },
        {
          key: 'port',
          label: 'Port',
          type: 'number',
          defaultValue: 3000,
          validation: (value) => value >= 1024 && value <= 65535 || 'Port must be between 1024 and 65535'
        },
        {
          key: 'enabled',
          label: 'Enable Feature',
          type: 'boolean',
          defaultValue: false
        },
        {
          key: 'theme',
          label: 'Theme',
          type: 'select',
          defaultValue: 'light',
          options: [
            { label: 'Light', value: 'light' },
            { label: 'Dark', value: 'dark' }
          ]
        },
        {
          key: 'apiKey',
          label: 'API Key',
          type: 'password',
          defaultValue: '',
          requiresRestart: true
        }
      ]
    },
    {
      id: 'advanced',
      label: 'Advanced',
      settings: [
        {
          key: 'debugMode',
          label: 'Debug Mode',
          type: 'boolean',
          defaultValue: false,
          requiresRestart: true
        }
      ]
    }
  ];

  const mockOnSave = jest.fn().mockResolvedValue(undefined);
  const mockOnLoad = jest.fn().mockResolvedValue({
    appName: 'Test App',
    port: 4000,
    enabled: true,
    theme: 'dark',
    apiKey: 'secret123',
    debugMode: false
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render all categories', () => {
    const { container } = render(
      <SettingsFramework
        categories={mockCategories}
        onSave={mockOnSave}
      />
    );

    // Check category buttons exist
    const categoryButtons = container.querySelectorAll('button');
    const categoryNames = Array.from(categoryButtons).map(btn => btn.textContent);
    
    expect(categoryNames).toContain('General');
    expect(categoryNames).toContain('Advanced');
  });

  it('should load settings on mount', async () => {
    render(
      <SettingsFramework
        categories={mockCategories}
        onSave={mockOnSave}
        onLoad={mockOnLoad}
      />
    );

    await waitFor(() => {
      expect(mockOnLoad).toHaveBeenCalledTimes(1);
    });

    // Check that loaded values are displayed
    const appNameInput = screen.getByLabelText('Application Name') as HTMLInputElement;
    expect(appNameInput.value).toBe('Test App');
  });

  it('should validate required fields', async () => {
    const { getByLabelText, getByText, queryByText } = render(
      <SettingsFramework
        categories={mockCategories}
        onSave={mockOnSave}
      />
    );

    const appNameInput = getByLabelText('Application Name');
    
    // Clear the field
    await userEvent.clear(appNameInput);
    
    // Try to save
    const saveButton = getByText('Save');
    fireEvent.click(saveButton);

    // Should show validation error
    await waitFor(() => {
      expect(queryByText('Name is required')).toBeInTheDocument();
    });

    // Should not call onSave
    expect(mockOnSave).not.toHaveBeenCalled();
  });

  it('should validate number ranges', async () => {
    const { getByLabelText, getByText } = render(
      <SettingsFramework
        categories={mockCategories}
        onSave={mockOnSave}
      />
    );

    const portInput = getByLabelText('Port');
    
    // Enter invalid port
    await userEvent.clear(portInput);
    await userEvent.type(portInput, '999');
    
    // Try to save
    fireEvent.click(getByText('Save'));

    // Should show validation error
    await waitFor(() => {
      expect(screen.getByText('Port must be between 1024 and 65535')).toBeInTheDocument();
    });
  });

  it('should handle boolean switches', async () => {
    const { getByLabelText } = render(
      <SettingsFramework
        categories={mockCategories}
        onSave={mockOnSave}
      />
    );

    const enableSwitch = getByLabelText('Enable Feature');
    
    // Toggle the switch
    fireEvent.click(enableSwitch);
    
    // Check that it's toggled
    await waitFor(() => {
      expect(enableSwitch).toBeChecked();
    });
  });

  it('should handle select dropdowns', async () => {
    const { getByLabelText, getByText } = render(
      <SettingsFramework
        categories={mockCategories}
        onSave={mockOnSave}
      />
    );

    const themeSelect = getByLabelText('Theme').parentElement;
    
    // Open dropdown
    fireEvent.click(themeSelect!);
    
    // Select dark theme
    await waitFor(() => {
      fireEvent.click(getByText('Dark'));
    });
  });

  it('should toggle password visibility', async () => {
    const { getByLabelText, container } = render(
      <SettingsFramework
        categories={mockCategories}
        onSave={mockOnSave}
        onLoad={mockOnLoad}
      />
    );

    await waitFor(() => {
      expect(mockOnLoad).toHaveBeenCalled();
    });

    const apiKeyInput = getByLabelText('API Key') as HTMLInputElement;
    
    // Should be password type initially
    expect(apiKeyInput.type).toBe('password');
    
    // Find and click the eye button
    const eyeButton = container.querySelector('[title*="Show"], [title*="Hide"], button svg[class*="Eye"]')?.parentElement;
    if (eyeButton) {
      fireEvent.click(eyeButton);
      
      // Should now be text type
      await waitFor(() => {
        expect(apiKeyInput.type).toBe('text');
      });
    }
  });

  it('should save changes when Save button is clicked', async () => {
    const { getByLabelText, getByText } = render(
      <SettingsFramework
        categories={mockCategories}
        onSave={mockOnSave}
      />
    );

    const appNameInput = getByLabelText('Application Name');
    
    // Change a value
    await userEvent.clear(appNameInput);
    await userEvent.type(appNameInput, 'New App Name');
    
    // Save
    fireEvent.click(getByText('Save'));

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({
          appName: 'New App Name'
        })
      );
    });
  });

  it('should show undo button when values are dirty', async () => {
    const { getByLabelText, getByText, queryByText } = render(
      <SettingsFramework
        categories={mockCategories}
        onSave={mockOnSave}
        showUndoButton={true}
      />
    );

    // Initially no undo button
    expect(queryByText('Undo')).not.toBeInTheDocument();

    const appNameInput = getByLabelText('Application Name');
    
    // Change a value
    await userEvent.clear(appNameInput);
    await userEvent.type(appNameInput, 'Changed');
    
    // Undo button should appear
    await waitFor(() => {
      expect(getByText('Undo')).toBeInTheDocument();
    });
  });

  it('should reset to defaults when reset button is clicked', async () => {
    window.confirm = jest.fn().mockReturnValue(true);
    
    const { getByLabelText, getByText } = render(
      <SettingsFramework
        categories={mockCategories}
        onSave={mockOnSave}
        showResetButton={true}
        confirmReset={true}
      />
    );

    const appNameInput = getByLabelText('Application Name') as HTMLInputElement;
    
    // Change value
    await userEvent.clear(appNameInput);
    await userEvent.type(appNameInput, 'Changed');
    
    // Click reset
    fireEvent.click(getByText('Defaults'));
    
    // Should confirm
    expect(window.confirm).toHaveBeenCalled();
    
    // Should reset to default
    await waitFor(() => {
      expect(appNameInput.value).toBe('My App');
    });
  });

  it('should switch between categories', async () => {
    const { getByText, queryByLabelText } = render(
      <SettingsFramework
        categories={mockCategories}
        onSave={mockOnSave}
      />
    );

    // Initially on General category
    expect(queryByLabelText('Application Name')).toBeInTheDocument();
    expect(queryByLabelText('Debug Mode')).not.toBeInTheDocument();
    
    // Switch to Advanced
    fireEvent.click(getByText('Advanced'));
    
    // Should show Advanced settings
    await waitFor(() => {
      expect(queryByLabelText('Debug Mode')).toBeInTheDocument();
      expect(queryByLabelText('Application Name')).not.toBeInTheDocument();
    });
  });

  it('should indicate settings that require restart', () => {
    const { getByText } = render(
      <SettingsFramework
        categories={mockCategories}
        onSave={mockOnSave}
      />
    );

    // API Key requires restart
    expect(getByText('(Requires restart)')).toBeInTheDocument();
  });

  it('should call onRestartRequired when changing restart-required settings', async () => {
    const mockOnRestartRequired = jest.fn();
    
    const { getByLabelText, getByText } = render(
      <SettingsFramework
        categories={mockCategories}
        onSave={mockOnSave}
        onRestartRequired={mockOnRestartRequired}
      />
    );

    const apiKeyInput = getByLabelText('API Key');
    
    // Change a restart-required setting
    await userEvent.type(apiKeyInput, 'new-key');
    
    // Save
    fireEvent.click(getByText('Save'));

    await waitFor(() => {
      expect(mockOnRestartRequired).toHaveBeenCalledWith(['apiKey']);
    });
  });

  it('should support custom field components', () => {
    const CustomField = ({ value, onChange }: any) => (
      <input
        data-testid="custom-field"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );

    const customCategories: SettingsCategory[] = [
      {
        id: 'custom',
        label: 'Custom',
        settings: [
          {
            key: 'customField',
            label: 'Custom Field',
            type: 'custom',
            customComponent: CustomField,
            defaultValue: 'custom'
          }
        ]
      }
    ];

    const { getByTestId } = render(
      <SettingsFramework
        categories={customCategories}
        onSave={mockOnSave}
      />
    );

    expect(getByTestId('custom-field')).toBeInTheDocument();
  });

  it('should auto-save when enabled', async () => {
    jest.useFakeTimers();
    
    const { getByLabelText } = render(
      <SettingsFramework
        categories={mockCategories}
        onSave={mockOnSave}
        autoSave={true}
        autoSaveDelay={1000}
      />
    );

    const appNameInput = getByLabelText('Application Name');
    
    // Change a value
    await userEvent.clear(appNameInput);
    await userEvent.type(appNameInput, 'Auto Save Test');
    
    // Fast-forward time
    jest.advanceTimersByTime(1000);

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({
          appName: 'Auto Save Test'
        })
      );
    });
    
    jest.useRealTimers();
  });

  it('should persist active category in localStorage', () => {
    const setItemSpy = jest.spyOn(Storage.prototype, 'setItem');
    
    const { getByText } = render(
      <SettingsFramework
        categories={mockCategories}
        onSave={mockOnSave}
        persistState={true}
      />
    );

    // Switch category
    fireEvent.click(getByText('Advanced'));
    
    expect(setItemSpy).toHaveBeenCalledWith('settings-active-category', 'advanced');
  });

  it('should disable fields while saving', async () => {
    const slowSave = jest.fn().mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 100))
    );
    
    const { getByLabelText, getByText } = render(
      <SettingsFramework
        categories={mockCategories}
        onSave={slowSave}
      />
    );

    const appNameInput = getByLabelText('Application Name');
    
    // Change and save
    await userEvent.clear(appNameInput);
    await userEvent.type(appNameInput, 'Test');
    fireEvent.click(getByText('Save'));
    
    // Should be disabled while saving
    expect(appNameInput).toBeDisabled();
    
    await waitFor(() => {
      expect(appNameInput).not.toBeDisabled();
    });
  });
});