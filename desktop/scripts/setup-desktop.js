#!/usr/bin/env node

/**
 * Setup script for desktop app packaging with Tauri
 * Automatically configures a project for desktop deployment
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frameworkRoot = path.resolve(__dirname, '../..');

// Parse command line arguments
const args = process.argv.slice(2);
const projectPath = args[0] || process.cwd();
const appName = args[1] || path.basename(projectPath);

console.log(`🚀 Setting up desktop app for: ${appName}`);
console.log(`📁 Project path: ${projectPath}`);

// Check if project exists
if (!fs.existsSync(projectPath)) {
  console.error(`❌ Project path does not exist: ${projectPath}`);
  process.exit(1);
}

// Read package.json to get app details
const packageJsonPath = path.join(projectPath, 'package.json');
if (!fs.existsSync(packageJsonPath)) {
  console.error('❌ No package.json found in project');
  process.exit(1);
}

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const appVersion = packageJson.version || '1.0.0';
const appDescription = packageJson.description || 'Desktop application';

// Create src-tauri directory structure
console.log('📂 Creating Tauri directory structure...');
const tauriPath = path.join(projectPath, 'src-tauri');
const tauriDirs = [
  tauriPath,
  path.join(tauriPath, 'src'),
  path.join(tauriPath, 'icons'),
  path.join(tauriPath, 'capabilities')
];

tauriDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Copy icons from framework or project
console.log('🎨 Setting up icons...');
const iconSources = [
  path.join(projectPath, 'icons'),
  path.join(projectPath, 'web/public/assets'),
  path.join(frameworkRoot, 'desktop/icons')
];

let iconSource = null;
for (const source of iconSources) {
  if (fs.existsSync(source)) {
    const files = fs.readdirSync(source);
    if (files.some(f => f.includes('icon'))) {
      iconSource = source;
      break;
    }
  }
}

if (iconSource) {
  console.log(`  Found icons in: ${iconSource}`);
  const iconFiles = fs.readdirSync(iconSource);
  iconFiles.forEach(file => {
    if (file.match(/\.(png|ico|icns)$/i)) {
      const sourcePath = path.join(iconSource, file);
      const destPath = path.join(tauriPath, 'icons', file);
      fs.copyFileSync(sourcePath, destPath);
      console.log(`  ✓ Copied ${file}`);
    }
  });
}

// Generate tauri.conf.json
console.log('⚙️  Generating Tauri configuration...');
const tauriConfig = {
  "$schema": "https://raw.githubusercontent.com/tauri-apps/tauri/dev/tooling/cli/schema.json",
  "productName": appName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
  "version": appVersion,
  "identifier": `com.episensor.${appName.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
  "build": {
    "frontendDist": "../web/dist",
    "devUrl": "http://localhost:8080",
    "beforeDevCommand": "npm run dev:web",
    "beforeBuildCommand": "cd web && npm run build"
  },
  "app": {
    "windows": [
      {
        "title": appName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        "width": 1400,
        "height": 900,
        "resizable": true,
        "fullscreen": false,
        "center": true,
        "minWidth": 1024,
        "minHeight": 600
      }
    ],
    "security": {
      "csp": null,
      "dangerousDisableAssetCspModification": true
    },
    "trayIcon": {
      "iconPath": "icons/icon.png",
      "menuOnLeftClick": false,
      "tooltip": appName
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "resources": [],
    "copyright": `© ${new Date().getFullYear()} EpiSensor`,
    "category": "DeveloperTool",
    "shortDescription": appDescription.substring(0, 100),
    "longDescription": appDescription,
    "macOS": {
      "minimumSystemVersion": "10.15",
      "exceptionDomain": "",
      "signingIdentity": null,
      "providerShortName": null,
      "entitlements": null
    }
  },
  "plugins": {
    "updater": {
      "active": false
    }
  }
};

fs.writeFileSync(
  path.join(tauriPath, 'tauri.conf.json'),
  JSON.stringify(tauriConfig, null, 2)
);
console.log('  ✓ Created tauri.conf.json');

// Copy Rust source files from framework
console.log('🦀 Setting up Rust source files...');
const rustTemplates = path.join(frameworkRoot, 'desktop/rust-templates');
const rustFiles = [
  'Cargo.toml',
  'build.rs',
  'src/main.rs'
];

rustFiles.forEach(file => {
  const templatePath = path.join(rustTemplates, file);
  const destPath = path.join(tauriPath, file);
  
  if (fs.existsSync(templatePath)) {
    let content = fs.readFileSync(templatePath, 'utf8');
    // Replace placeholders
    content = content
      .replace(/{{APP_NAME}}/g, appName)
      .replace(/{{APP_VERSION}}/g, appVersion)
      .replace(/{{APP_DESCRIPTION}}/g, appDescription);
    
    fs.writeFileSync(destPath, content);
    console.log(`  ✓ Created ${file}`);
  }
});

// Create capabilities file
const capabilitiesConfig = {
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": `Default permissions for ${appName}`,
  "windows": ["main"],
  "permissions": [
    "core:default",
    "shell:allow-open"
  ]
};

fs.writeFileSync(
  path.join(tauriPath, 'capabilities/default.json'),
  JSON.stringify(capabilitiesConfig, null, 2)
);
console.log('  ✓ Created capabilities configuration');

// Update package.json with Tauri scripts
console.log('📝 Updating package.json scripts...');
if (!packageJson.scripts) {
  packageJson.scripts = {};
}

const tauriScripts = {
  "tauri": "tauri",
  "tauri:dev": "tauri dev",
  "tauri:build": "tauri build",
  "tauri:icon": "tauri icon src-tauri/icons/icon.png",
  "desktop:setup": "node node_modules/@episensor/app-framework/desktop/scripts/setup-desktop.js",
  "desktop:build": "npm run build && npm run tauri:build"
};

Object.assign(packageJson.scripts, tauriScripts);

// Add Tauri CLI to devDependencies if not present
if (!packageJson.devDependencies) {
  packageJson.devDependencies = {};
}

if (!packageJson.devDependencies['@tauri-apps/cli']) {
  packageJson.devDependencies['@tauri-apps/cli'] = "^2.0.0";
  console.log('  ✓ Added @tauri-apps/cli to devDependencies');
}

fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
console.log('  ✓ Updated package.json');

// Generate icon sizes if we have a source icon
const sourceIcon = path.join(tauriPath, 'icons/icon.png');
if (fs.existsSync(sourceIcon)) {
  console.log('🎨 Generating icon sizes...');
  try {
    execSync(`cd "${projectPath}" && npx tauri icon "${sourceIcon}"`, { stdio: 'inherit' });
  } catch (error) {
    console.warn('  ⚠️  Could not generate icons automatically. Run "npm run tauri:icon" manually.');
  }
}

console.log('\n✅ Desktop app setup complete!');
console.log('\n📋 Next steps:');
console.log('  1. Install dependencies: npm install');
console.log('  2. Run in development: npm run tauri:dev');
console.log('  3. Build for production: npm run desktop:build');
console.log('\n💡 Tips:');
console.log('  - Make sure your web app builds to web/dist');
console.log('  - The backend server will be embedded in the desktop app');
console.log('  - Check src-tauri/tauri.conf.json for configuration options');
