# EpiSensor Framework Build Scripts

## tauri-build-clean.sh

A comprehensive Tauri build script with automatic cleanup to manage disk space usage.

### Features

- **Automated Building**: Builds Tauri applications in release or development mode
- **Intelligent Cleanup**: Multiple cleanup levels to balance disk space and build cache efficiency
- **Size Reporting**: Shows disk usage before and after cleanup
- **Bundle Preservation**: Keeps final app bundles while cleaning intermediate files
- **Cross-Platform**: Works on macOS, Linux, and Windows (with WSL/Git Bash)

### Usage

#### Direct Script Usage

```bash
# Build with moderate cleanup (default)
./tauri-build-clean.sh

# Build with aggressive cleanup  
./tauri-build-clean.sh --cleanup aggressive

# Development build with minimal cleanup
./tauri-build-clean.sh --dev --cleanup minimal

# Just cleanup without building
./tauri-build-clean.sh --skip-build --cleanup full

# Show help
./tauri-build-clean.sh --help
```

#### NPM Scripts (Recommended)

All framework apps include these npm scripts:

```bash
# Build with moderate cleanup (recommended for most users)
npm run tauri:build:clean

# Build with aggressive cleanup (saves more space)
npm run tauri:build:aggressive  

# Build with minimal cleanup (fastest, keeps more cache)
npm run tauri:build:minimal
```

### Cleanup Levels

| Level | Description | Disk Space Saved | Build Cache Preserved |
|-------|-------------|------------------|----------------------|
| **minimal** | Remove debug artifacts only | ~200-500MB | ✅ Most cache kept |
| **moderate** | Remove debug + intermediate build files | ~500MB-1GB | ✅ Final artifacts kept |
| **aggressive** | Remove everything except final bundles | ~2-3GB | ⚠️ Some cache removed |
| **full** | Remove all build artifacts | ~3-4GB | ❌ No cache kept |

### Recommendations

- **Daily Development**: Use `npm run tauri:build:clean` (moderate)
- **Low Disk Space**: Use `npm run tauri:build:aggressive` 
- **CI/CD Pipelines**: Use `--cleanup full` to start fresh
- **Quick Iterations**: Use `npm run tauri:build:minimal`

### Disk Space Impact

Based on testing with framework apps:

- **Before Cleanup**: ~3.5-4GB per app
- **After Moderate**: ~1.3-1.5GB per app (saves ~2GB)
- **After Aggressive**: ~200-500MB per app (saves ~3GB)
- **After Full**: ~0MB build cache (saves ~3.5GB)

### Framework Integration

This script is automatically available in all EpiSensor framework apps:

- ✅ epi-origami-simulator
- ✅ epi-modbus-simulator  
- ✅ epi-node-programmer
- ✅ epi-competitor-ai

### Technical Details

The script:
1. Builds the Tauri application (unless `--skip-build`)
2. Reports bundle locations and sizes
3. Performs selected cleanup level
4. Shows before/after disk usage
5. Preserves final app bundles and DMG files

### Troubleshooting

**Script not found**: Make sure you're running from a framework app directory with `src-tauri/` folder

**Permission denied**: Run `chmod +x ../epi-app-framework/scripts/tauri-build-clean.sh`

**Build fails**: Check that all dependencies are installed and Tauri configuration is correct