#!/bin/bash

# Fix StandardServer.ts line 261
sed -i '' '261s/_error/error/g' src/core/StandardServer.ts

# Fix sidecar.ts line 136
sed -i '' '136s/error/_error/g' src/desktop/sidecar.ts

# Fix tauri.ts line 96
sed -i '' '96s/_error/error/g' src/desktop/tauri.ts

# Fix all remaining throw error statements
sed -i '' 's/throw error;/throw _error;/g' src/services/configManager.ts src/services/conversationStorage.ts src/services/settingsService.ts src/services/updateService.ts

# Fix queueService.ts line 266
sed -i '' '266s/_error/error/g' src/services/queueService.ts
