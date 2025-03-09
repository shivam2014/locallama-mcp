import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ErrorCode,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { costMonitor } from '../cost-monitor/index.js';
import { openRouterModule } from '../openrouter/index.js';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
// For testing purposes, allow version override
export const getVersion = () => {
  try {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
    return packageJson.version;
  } catch {
    return 'unknown'; // Version couldn't be determined
  }
}

const version = getVersion();

/**
 * Check if OpenRouter API key is configured
 */
function isOpenRouterConfigured(): boolean {
  return !!config.openRouterApiKey;
}

/**
 * Set up resource handlers for the MCP Server
 *
 * Resources provide data about the current state of the system,
 * such as token usage, costs, and available models.
 */
export function setupResourceHandlers(server: Server): void {
  // List available static resources
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    logger.debug('Listing available resources');
    
    const resources = [
      {
        uri: 'locallama://status',
        name: 'LocalLama MCP Server Status',
        mimeType: 'application/json',
        description: 'Current status of the LocalLama MCP Server',
      },
      {
        uri: 'locallama://models',
        name: 'Available Models',
        mimeType: 'application/json',
        description: 'List of available local LLM models',
      },
    ];
    
    // Add OpenRouter resources if API key is configured
    if (isOpenRouterConfigured()) {
      resources.push(
        {
          uri: 'locallama://openrouter/models',
          name: 'OpenRouter Models',
          mimeType: 'application/json',
          description: 'List of available models from OpenRouter',
        },
        {
          uri: 'locallama://openrouter/free-models',
          name: 'OpenRouter Free Models',
          mimeType: 'application/json',
          description: 'List of free models available from OpenRouter',
        },
        {
          uri: 'locallama://openrouter/status',
          name: 'OpenRouter Integration Status',
          mimeType: 'application/json',
          description: 'Status of the OpenRouter integration',
        }
      );
    }
    
    return { resources };
  });

  // List available resource templates
  server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
    logger.debug('Listing available resource templates');
    
    const resourceTemplates = [
      {
        uriTemplate: 'locallama://usage/{api}',
        name: 'API Usage Statistics',
        mimeType: 'application/json',
        description: 'Token usage and cost statistics for a specific API',
      },
    ];
    
    // Add OpenRouter resource templates if API key is configured
    if (isOpenRouterConfigured()) {
      resourceTemplates.push(
        {
          uriTemplate: 'locallama://openrouter/model/{modelId}',
          name: 'OpenRouter Model Details',
          mimeType: 'application/json',
          description: 'Details about a specific OpenRouter model',
        },
        {
          uriTemplate: 'locallama://openrouter/prompting-strategy/{modelId}',
          name: 'OpenRouter Prompting Strategy',
          mimeType: 'application/json',
          description: 'Prompting strategy for a specific OpenRouter model',
        }
      );
    }
    
    return { resourceTemplates };
  });

  // Handle resource requests
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    logger.debug(`Reading resource: ${uri}`);
    
    // Handle static resources
    if (uri === 'locallama://status') {
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              status: 'running',
              version: version,
              uptime: process.uptime(),
              timestamp: new Date().toISOString(),
            }, null, 2),
          },
        ],
      };
    }
    
    if (uri === 'locallama://models') {
      try {
        const models = await costMonitor.getAvailableModels();
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(models, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error('Failed to get available models:', error);
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to get available models: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
    
    // Handle OpenRouter resources
    if (uri === 'locallama://openrouter/models') {
      try {
        // Check if OpenRouter API key is configured
        if (!isOpenRouterConfigured()) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            'OpenRouter API key not configured'
          );
        }
        
        // Initialize OpenRouter module if needed
        if (Object.keys(openRouterModule.modelTracking.models).length === 0) {
          await openRouterModule.initialize();
        }
        
        const models = await openRouterModule.getAvailableModels();
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(models, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error('Failed to get OpenRouter models:', error);
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to get OpenRouter models: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
    
    if (uri === 'locallama://openrouter/free-models') {
      try {
        // Check if OpenRouter API key is configured
        if (!isOpenRouterConfigured()) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            'OpenRouter API key not configured'
          );
        }
        
        // Initialize OpenRouter module if needed
        if (Object.keys(openRouterModule.modelTracking.models).length === 0) {
          await openRouterModule.initialize();
        }
        
        const freeModels = await openRouterModule.getFreeModels();
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(freeModels, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error('Failed to get OpenRouter free models:', error);
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to get OpenRouter free models: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
    
    if (uri === 'locallama://openrouter/status') {
      try {
        // Check if OpenRouter API key is configured
        if (!isOpenRouterConfigured()) {
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify({
                  status: 'not_configured',
                  message: 'OpenRouter API key not configured',
                  timestamp: new Date().toISOString(),
                }, null, 2),
              },
            ],
          };
        }
        
        // Initialize OpenRouter module if needed
        if (Object.keys(openRouterModule.modelTracking.models).length === 0) {
          await openRouterModule.initialize();
        }
        
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                status: 'running',
                modelsCount: Object.keys(openRouterModule.modelTracking.models).length,
                freeModelsCount: openRouterModule.modelTracking.freeModels.length,
                lastUpdated: openRouterModule.modelTracking.lastUpdated,
                timestamp: new Date().toISOString(),
              }, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error('Failed to get OpenRouter status:', error);
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to get OpenRouter status: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
    
    // Handle resource templates
    const usageMatch = uri.match(/^locallama:\/\/usage\/(.+)$/);
    if (usageMatch) {
      const api = usageMatch[1];
      try {
        const usage = await costMonitor.getApiUsage(api);
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(usage, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error(`Failed to get usage for API ${api}:`, error);
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to get usage for API ${api}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
    
    // Handle OpenRouter model details
    const modelMatch = uri.match(/^locallama:\/\/openrouter\/model\/(.+)$/);
    if (modelMatch) {
      try {
        // Check if OpenRouter API key is configured
        if (!isOpenRouterConfigured()) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            'OpenRouter API key not configured'
          );
        }
        
        const modelId = decodeURIComponent(modelMatch[1]);
        
        // Initialize OpenRouter module if needed
        if (Object.keys(openRouterModule.modelTracking.models).length === 0) {
          await openRouterModule.initialize();
        }
        
        // Get the model details
        const model = openRouterModule.modelTracking.models[modelId];
        if (!model) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            `Model not found: ${modelId}`
          );
        }
        
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(model, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error('Failed to get OpenRouter model details:', error);
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to get OpenRouter model details: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
    
    // Handle OpenRouter prompting strategy
    const strategyMatch = uri.match(/^locallama:\/\/openrouter\/prompting-strategy\/(.+)$/);
    if (strategyMatch) {
      try {
        // Check if OpenRouter API key is configured
        if (!isOpenRouterConfigured()) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            'OpenRouter API key not configured'
          );
        }
        
        const modelId = decodeURIComponent(strategyMatch[1]);
        
        // Initialize OpenRouter module if needed
        if (Object.keys(openRouterModule.modelTracking.models).length === 0) {
          await openRouterModule.initialize();
        }
        
        // Get the prompting strategy
        const strategy = openRouterModule.getPromptingStrategy(modelId);
        if (!strategy) {
          // Return default strategy if no specific strategy is found
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify({
                  modelId,
                  systemPrompt: 'You are a helpful assistant.',
                  useChat: true,
                  successRate: 0,
                  qualityScore: 0,
                  lastUpdated: new Date().toISOString(),
                  note: 'Default strategy (no specific strategy found for this model)'
                }, null, 2),
              },
            ],
          };
        }
        
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(strategy, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error('Failed to get OpenRouter prompting strategy:', error);
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to get OpenRouter prompting strategy: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
    
    // Resource not found
    throw new McpError(
      ErrorCode.InvalidRequest,
      `Resource not found: ${uri}`
    );
  });
}