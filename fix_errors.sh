#!/bin/bash

# Fix src/middleware/validation.ts
sed -i '' '238s/error/_error/g; 239s/error/_error/g; 250s/error/_error/g' src/middleware/validation.ts
sed -i '' '270s/error/_error/g; 271s/error/_error/g; 282s/error/_error/g' src/middleware/validation.ts
sed -i '' '302s/error/_error/g; 303s/error/_error/g; 314s/error/_error/g' src/middleware/validation.ts
sed -i '' '340s/error/_error/g; 341s/error/_error/g' src/middleware/validation.ts
sed -i '' '354s/error/_error/g; 355s/error/_error/g' src/middleware/validation.ts
sed -i '' '368s/error/_error/g; 369s/error/_error/g' src/middleware/validation.ts
sed -i '' '400s/error/_error/g; 401s/error/_error/g; 407s/error/_error/g' src/middleware/validation.ts

# Fix other files
sed -i '' 's/throw error;/throw _error;/g' src/desktop/native-modules.ts src/desktop/sidecar.ts src/desktop/tauri.ts
sed -i '' 's/logger.error(\(.*\), error)/logger.error(\1, _error)/g' src/desktop/tauri.ts src/core/StandardServer.ts

# Fix middleware/aiErrorHandler.ts
sed -i '' '213s/error/_error/g; 215s/error/_error/g; 216s/error/_error/g; 217s/error/_error/g; 218s/error/_error/g; 220s/error/_error/g' src/middleware/aiErrorHandler.ts

# Fix other middleware files
sed -i '' '146s/error/_error/g' src/middleware/fileUpload.ts
sed -i '' '153s/error/_error/g' src/middleware/health.ts
sed -i '' '156s/error/_error/g' src/middleware/session.ts

# Fix services
sed -i '' '217s/error/_error/g; 218s/error/_error/g; 289s/error/_error/g' src/services/aiService.ts
sed -i '' '457s/error/_error/g; 458s/error/_error/g; 501s/error/_error/g; 502s/error/_error/g' src/services/aiService.ts
sed -i '' '102s/error/_error/g; 125s/error/_error/g; 220s/error/_error/g' src/services/configManager.ts
