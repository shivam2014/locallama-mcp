# Plan to Fix OpenRouter Free Models Integration

## Problem Analysis

Based on our investigation, we've identified two main issues that might be preventing the OpenRouter free models from being retrieved:

1. **File Path and Storage Issues**: The MCP server uses `config.rootDir` to determine where to save and load tracking data, which might be incorrect or inaccessible.
2. **Caching and Update Logic**: The server only updates models if they're more than 24 hours old, and might be stuck with empty data if the initial update failed.

## Proposed Changes

### 1. Ensure Directory Exists and Is Accessible

**File**: `src/modules/openrouter/index.ts`

**Changes**:
- Add directory creation logic to ensure the tracking file's directory exists
- Add more detailed logging for file operations
- Ensure proper error handling for file operations

**Impact**: This will prevent file access errors and provide better visibility into file operations.

### 2. Force Model Update on Initialization

**File**: `src/modules/openrouter/index.ts`

**Changes**:
- Temporarily modify the initialization logic to force an update regardless of timestamp
- Add more detailed logging throughout the update process
- Add a utility method to manually clear tracking data

**Impact**: This will bypass the caching mechanism temporarily to ensure fresh data is retrieved.

### 3. Improve Error Handling and Logging

**File**: `src/modules/openrouter/index.ts`

**Changes**:
- Add more detailed logging in the API call process
- Improve error handling to catch and log specific issues
- Add validation for API responses

**Impact**: This will provide better visibility into what's happening during the API call and model processing.

## Detailed Implementation Plan

### Step 1: Ensure Directory Exists

Add directory creation logic to the `initialize()` method to ensure the tracking file's directory exists before attempting to read or write files.

```typescript
// Import mkdir from fs/promises
import { mkdir } from 'fs/promises';

// In the initialize() method, before loading tracking data:
try {
  // Ensure the directory exists
  await mkdir(path.dirname(TRACKING_FILE_PATH), { recursive: true });
  logger.debug(`Ensured directory exists: ${path.dirname(TRACKING_FILE_PATH)}`);
} catch (error) {
  // Ignore if directory already exists
  logger.debug(`Directory check: ${error.message}`);
}
```

### Step 2: Improve File Operation Logging

Enhance the logging in file operations to provide better visibility.

```typescript
// In the saveTrackingData() method:
try {
  logger.debug(`Saving tracking data to: ${TRACKING_FILE_PATH}`);
  await fs.writeFile(TRACKING_FILE_PATH, JSON.stringify(this.modelTracking, null, 2));
  logger.debug('Successfully saved OpenRouter tracking data to disk');
} catch (error) {
  logger.error(`Error saving OpenRouter tracking data to ${TRACKING_FILE_PATH}:`, error);
}
```

### Step 3: Force Model Update

Temporarily modify the initialization logic to force an update regardless of timestamp.

```typescript
// In the initialize() method, replace the hoursSinceLastUpdate check with:
logger.info('Forcing update of OpenRouter models...');
await this.updateModels();
```

### Step 4: Enhance API Call Logging

Add more detailed logging in the updateModels() method to track the API call process.

```typescript
// In the updateModels() method, add more logging:
logger.debug('Making request to OpenRouter API...');
const response = await axios.get<OpenRouterModelsResponse>('https://openrouter.ai/api/v1/models', {
  headers: {
    'Authorization': `Bearer ${config.openRouterApiKey}`,
    'HTTP-Referer': 'https://locallama-mcp.local',
    'X-Title': 'LocalLama MCP'
  }
});
logger.debug(`OpenRouter API response status: ${response.status}`);
logger.debug(`OpenRouter API response data length: ${response.data?.data?.length || 0}`);

// After processing models:
logger.info(`Processed ${Object.keys(updatedModels).length} models, found ${freeModels.length} free models`);
```

### Step 5: Add Utility Method to Clear Tracking Data

Add a utility method to manually clear tracking data and force an update.

```typescript
// Add this method to the openRouterModule:
async clearTrackingData(): Promise<void> {
  logger.info('Clearing OpenRouter tracking data...');
  this.modelTracking = {
    models: {},
    lastUpdated: '',
    freeModels: []
  };
  
  try {
    // Delete the tracking file if it exists
    await fs.unlink(TRACKING_FILE_PATH).catch(() => {});
    logger.debug('Deleted tracking file');
  } catch (error) {
    logger.debug('No tracking file to delete');
  }
  
  // Force an update
  await this.updateModels();
}
```

## Testing Plan

1. After making these changes, restart the MCP server
2. Check the logs for any errors or warnings
3. Use the MCP resource endpoint to check if free models are now available
4. If not, use the new clearTrackingData method to force a clean update

## Rollback Plan

If these changes cause any issues:

1. Revert the changes to the original code
2. Restart the MCP server
3. Consider a different approach based on the observed issues

## Long-term Recommendations

1. Add more robust error handling throughout the OpenRouter module
2. Implement a retry mechanism for API calls
3. Add a health check endpoint to monitor the status of the OpenRouter integration
4. Consider adding a manual refresh button or command to force updates when needed