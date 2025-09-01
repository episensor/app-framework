import { useState, useCallback, useRef, useEffect } from 'react';

export interface UseFormStateOptions<T> {
  initialValues: T;
  defaultValues?: T; // Default values for reset to defaults
  onSave: (values: T) => Promise<void>;
  timeout?: number; // Save timeout in ms, default 10000
  validateChanges?: (values: T) => boolean; // Custom validation for dirty check
}

export interface FormState<T> {
  values: T;
  isDirty: boolean;
  isSaving: boolean;
  error: string | null;
  setValues: (values: T | ((prev: T) => T)) => void;
  setFieldValue: <K extends keyof T>(field: K, value: T[K]) => void;
  save: () => Promise<void>;
  reset: () => void;
  resetToDefaults: () => void;
  canSave: boolean;
}

// Simple deep equality check
function isEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  
  if (keysA.length !== keysB.length) return false;
  
  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!isEqual(a[key], b[key])) return false;
  }
  
  return true;
}

/**
 * Custom hook for managing form state with dirty checking and save lifecycle
 */
export function useFormState<T extends Record<string, any>>({
  initialValues,
  defaultValues,
  onSave,
  timeout = 10000,
  validateChanges
}: UseFormStateOptions<T>): FormState<T> {
  const [values, setValues] = useState<T>(initialValues);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const initialValuesRef = useRef(initialValues);
  const saveTimeoutRef = useRef<NodeJS.Timeout>();

  // Check if form is dirty whenever values change
  useEffect(() => {
    const hasChanges = validateChanges 
      ? validateChanges(values)
      : !isEqual(values, initialValuesRef.current);
    setIsDirty(hasChanges);
  }, [values, validateChanges]);

  // Set individual field value
  const setFieldValue = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setValues(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  // Save with timeout and error handling
  const save = useCallback(async () => {
    if (!isDirty || isSaving) return;
    
    setIsSaving(true);
    setError(null);

    // Set up timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      saveTimeoutRef.current = setTimeout(() => {
        reject(new Error('Save operation timed out'));
      }, timeout);
    });

    try {
      // Race between save operation and timeout
      await Promise.race([
        onSave(values),
        timeoutPromise
      ]);
      
      // Update initial values on successful save
      initialValuesRef.current = values;
      setIsDirty(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save changes';
      setError(message);
      console.error('Save failed:', err);
    } finally {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      setIsSaving(false);
    }
  }, [values, isDirty, isSaving, onSave, timeout]);

  // Reset form to initial values (undo changes)
  const reset = useCallback(() => {
    setValues(initialValuesRef.current);
    setIsDirty(false);
    setError(null);
  }, []);

  // Reset form to default values
  const resetToDefaults = useCallback(() => {
    if (defaultValues) {
      setValues(defaultValues);
      setError(null);
      // Mark as dirty since defaults may differ from current saved values
      setIsDirty(!isEqual(defaultValues, initialValuesRef.current));
    }
  }, [defaultValues]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    values,
    isDirty,
    isSaving,
    error,
    setValues,
    setFieldValue,
    save,
    reset,
    resetToDefaults,
    canSave: isDirty && !isSaving
  };
}
