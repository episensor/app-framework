#!/bin/bash

# Tauri Build with Automatic Cleanup Script
# This script builds a Tauri app and optionally cleans up build artifacts to save disk space

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to get directory size
get_dir_size() {
    if [[ -d "$1" ]]; then
        du -sh "$1" 2>/dev/null | cut -f1
    else
        echo "0B"
    fi
}

# Function to clean up Tauri build artifacts
cleanup_tauri() {
    local target_dir="$1/src-tauri/target"
    local cleanup_level="$2"
    
    if [[ ! -d "$target_dir" ]]; then
        print_warning "No target directory found at $target_dir"
        return 0
    fi
    
    local size_before=$(get_dir_size "$target_dir")
    print_status "Target directory size before cleanup: $size_before"
    
    cd "$1/src-tauri"
    
    case $cleanup_level in
        "minimal")
            print_status "Performing minimal cleanup (debug artifacts only)..."
            if [[ -d "target/debug" ]]; then
                rm -rf target/debug
                print_success "Removed debug build artifacts"
            fi
            ;;
        "moderate")
            print_status "Performing moderate cleanup (debug + intermediate files)..."
            if [[ -d "target/debug" ]]; then
                rm -rf target/debug
                print_success "Removed debug build artifacts"
            fi
            if [[ -d "target/release/build" ]]; then
                rm -rf target/release/build
                print_success "Removed release build cache"
            fi
            if [[ -d "target/release/deps" ]]; then
                find target/release/deps -name "*.d" -delete 2>/dev/null || true
                print_success "Removed dependency metadata files"
            fi
            ;;
        "aggressive")
            print_status "Performing aggressive cleanup (everything except final bundles)..."
            # Keep only the final app bundles and DMG files
            if [[ -d "target/release/bundle" ]]; then
                # Move bundles to temp location
                temp_dir=$(mktemp -d)
                cp -r target/release/bundle "$temp_dir/"
                print_status "Preserved bundles in temporary location"
            fi
            
            cargo clean
            print_success "Ran cargo clean"
            
            # Restore bundles
            if [[ -d "$temp_dir/bundle" ]]; then
                mkdir -p target/release
                mv "$temp_dir/bundle" target/release/
                rm -rf "$temp_dir"
                print_success "Restored final bundles"
            fi
            ;;
        "full")
            print_status "Performing full cleanup (including final bundles)..."
            cargo clean
            print_success "Ran cargo clean - all build artifacts removed"
            ;;
        *)
            print_error "Invalid cleanup level: $cleanup_level"
            return 1
            ;;
    esac
    
    local size_after=$(get_dir_size "$target_dir")
    print_success "Target directory size after cleanup: $size_after"
}

# Main function
main() {
    local app_dir=$(pwd)
    local build_type="release"
    local cleanup_level="moderate"
    local skip_build=false
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dev)
                build_type="dev"
                shift
                ;;
            --cleanup)
                cleanup_level="$2"
                shift 2
                ;;
            --skip-build)
                skip_build=true
                shift
                ;;
            --help)
                cat << EOF
Tauri Build with Automatic Cleanup Script

Usage: $0 [OPTIONS]

OPTIONS:
    --dev               Build in development mode (tauri:dev)
    --cleanup LEVEL     Cleanup level after build (minimal|moderate|aggressive|full)
                        minimal: Remove debug artifacts only
                        moderate: Remove debug + intermediate build files (default)
                        aggressive: Remove everything except final bundles
                        full: Remove all build artifacts including bundles
    --skip-build        Skip building, only perform cleanup
    --help              Show this help message

EXAMPLES:
    $0                              # Build in release mode with moderate cleanup
    $0 --cleanup aggressive         # Build with aggressive cleanup
    $0 --dev --cleanup minimal      # Dev build with minimal cleanup
    $0 --skip-build --cleanup full  # Just clean up without building
EOF
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Check if we're in a directory with Tauri
    if [[ ! -d "src-tauri" ]]; then
        print_error "No src-tauri directory found. Are you in a Tauri project root?"
        exit 1
    fi
    
    # Check if package.json has tauri scripts
    if [[ ! -f "package.json" ]] || ! grep -q "tauri" package.json 2>/dev/null; then
        print_error "No package.json with Tauri scripts found"
        exit 1
    fi
    
    local app_name=$(basename "$app_dir")
    print_status "Working in Tauri project: $app_name"
    
    # Build phase
    if [[ "$skip_build" == false ]]; then
        print_status "Starting Tauri build..."
        local start_time=$(date +%s)
        
        if [[ "$build_type" == "dev" ]]; then
            print_warning "Development builds are not typically cleaned up"
            print_status "Running: npm run tauri:dev"
            npm run tauri:dev
        else
            print_status "Running: npm run tauri:build"
            npm run tauri:build
        fi
        
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        print_success "Build completed in ${duration}s"
        
        # Show bundle locations
        local bundle_dir="src-tauri/target/release/bundle"
        if [[ -d "$bundle_dir" ]]; then
            print_success "Build artifacts created:"
            find "$bundle_dir" -type f \( -name "*.app" -o -name "*.dmg" -o -name "*.deb" -o -name "*.AppImage" -o -name "*.msi" \) -exec ls -lh {} \; 2>/dev/null | while read line; do
                echo "  $line"
            done
        fi
    fi
    
    # Cleanup phase
    if [[ "$cleanup_level" != "none" ]]; then
        print_status "Starting cleanup (level: $cleanup_level)..."
        cleanup_tauri "$app_dir" "$cleanup_level"
        print_success "Cleanup completed!"
    fi
    
    print_success "Tauri build script completed successfully!"
}

# Run main function
main "$@"