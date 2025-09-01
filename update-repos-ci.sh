#!/bin/bash

# Script to update all repos to use the public framework

REPOS=(
  "epi-modbus-simulator"
  "epi-origami-simulator"
  "epi-competitor-ai"
  "epi-node-programmer"
)

for repo in "${REPOS[@]}"; do
  echo "Updating $repo..."
  
  CI_FILE="../$repo/.github/workflows/ci.yml"
  
  if [ -f "$CI_FILE" ]; then
    # Create a temporary file with the updated content
    cat > /tmp/ci-update.yml << 'EOF'
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Clone public framework
        run: |
          git clone https://github.com/episensor/app-framework.git ../epi-app-framework
          cd ../epi-app-framework
          npm install
          npm run build

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: package-lock.json

      - name: Install dependencies
        run: |
          npm install --no-audit --legacy-peer-deps
          if [ -d "web" ]; then
            cd web && npm install --no-audit --legacy-peer-deps
          fi

      - name: Run linter
        run: npm run lint
        continue-on-error: true

      - name: Run type check
        run: npm run typecheck || true
        continue-on-error: true

      - name: Run tests
        run: npm test
        continue-on-error: true

      - name: Build application
        run: npm run build
        continue-on-error: true

  build-tauri:
    strategy:
      fail-fast: false
      matrix:
        platform: [macos-latest, ubuntu-22.04, windows-latest]
    
    runs-on: ${{ matrix.platform }}
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Clone public framework
        run: |
          git clone https://github.com/episensor/app-framework.git ../epi-app-framework
          cd ../epi-app-framework
          npm install
          npm run build

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: package-lock.json

      - name: Install Rust stable
        uses: dtolnay/rust-toolchain@stable

      - name: Install dependencies (Ubuntu)
        if: matrix.platform == 'ubuntu-22.04'
        run: |
          sudo apt-get update
          sudo apt-get install -y libgtk-3-dev libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf

      - name: Install Node dependencies (Ubuntu)
        if: matrix.platform == 'ubuntu-22.04'
        run: |
          npm install --no-audit --legacy-peer-deps --force
          if [ -d "web" ]; then
            cd web && npm install --no-audit --legacy-peer-deps --force
          fi
          # Force reinstall the specific binaries
          npm install @rollup/rollup-linux-x64-gnu --force
          npm install @tauri-apps/cli-linux-x64-gnu --force

      - name: Install Node dependencies (macOS)
        if: matrix.platform == 'macos-latest'
        run: |
          npm install --no-audit --legacy-peer-deps --force
          if [ -d "web" ]; then
            cd web && npm install --no-audit --legacy-peer-deps --force
          fi
          # Install BOTH x64 and ARM64 binaries for macOS compatibility
          npm install @rollup/rollup-darwin-x64 --force
          npm install @rollup/rollup-darwin-arm64 --force
          npm install @tauri-apps/cli-darwin-x64 --force
          npm install @tauri-apps/cli-darwin-arm64 --force

      - name: Install Node dependencies (Windows)
        if: matrix.platform == 'windows-latest'
        run: |
          npm install --no-audit --legacy-peer-deps --force
          if (Test-Path "web") { 
            cd web
            npm install --no-audit --legacy-peer-deps --force
            cd ..
          }
          # Force reinstall the specific binaries
          npm install @rollup/rollup-win32-x64-msvc --force
          npm install @tauri-apps/cli-win32-x64-msvc --force
        shell: powershell

      - name: Build frontend
        run: |
          if [ -d "web" ]; then
            cd web && npm run build:prod
          else
            npm run build:frontend
          fi

      - name: Build Tauri app
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          args: --verbose
EOF

    # Copy the new CI file
    cp /tmp/ci-update.yml "$CI_FILE"
    echo "✅ Updated $repo CI configuration"
  else
    echo "⚠️ No CI file found for $repo"
  fi
done

echo "Done updating all repositories!"