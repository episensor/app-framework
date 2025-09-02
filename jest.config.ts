/**
 * Unified Jest Configuration
 * Consolidates all test configurations into a single source of truth
 */

import type { Config } from 'jest';

const config: Config = {
  // Use ts-jest preset for TypeScript support
  preset: 'ts-jest',
  testEnvironment: 'node',
  
  // Project root
  rootDir: '.',
  
  // Test file patterns
  testMatch: [
    '<rootDir>/tests/**/*.test.ts',
    '<rootDir>/tests/**/*.test.js'
  ],
  
  // Module resolution
  moduleNameMapper: {
    // Handle .js extensions in imports (for ESM compatibility)
    '^(\\.{1,2}/.*)\\.js$': '$1',
    // Mock chalk to avoid ESM issues
    '^chalk$': '<rootDir>/tests/mocks/chalk.ts'
  },
  
  // Transform configuration for TypeScript
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        module: 'commonjs',
        target: 'ES2022',
        moduleResolution: 'node',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        allowJs: true,
        strict: false,
        noUnusedLocals: false,
        noUnusedParameters: false,
        noImplicitAny: false,
        types: ['jest', 'node']
      }
    }]
  },
  
  // Transform ESM packages
  transformIgnorePatterns: [
    'node_modules/(?!(chalk|ansi-styles|supports-color|has-flag|lowdb)/)'
  ],
  
  // Paths to ignore
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/',
    '/build/',
    '/.next/'
  ],
  
  // Coverage configuration
  collectCoverage: false,
  collectCoverageFrom: [
    'src/**/*.{ts,tsx,js,jsx}',
    '!src/**/*.d.ts',
    '!src/**/*.test.{ts,tsx,js,jsx}',
    '!src/**/*.spec.{ts,tsx,js,jsx}',
    '!src/index.ts',
    '!src/types/**/*',
    '!src/**/index.ts', // Exclude barrel exports
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/tests/',
    '/coverage/'
  ],
  
  // Test environment options
  clearMocks: true,
  restoreMocks: true,
  
  // Timeout settings
  testTimeout: 10000,
  
  // Performance and debugging
  maxWorkers: '50%',
  verbose: true,
  
  // Handle open handles and force exit
  forceExit: true,
  detectOpenHandles: false, // Set to true for debugging
  
  // Global setup/teardown (if needed)
  // globalSetup: '<rootDir>/tests/globalSetup.ts',
  // globalTeardown: '<rootDir>/tests/globalTeardown.ts',
  
  // Setup files that run before each test file
  // setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'], // Only needed for integration tests
};

export default config;