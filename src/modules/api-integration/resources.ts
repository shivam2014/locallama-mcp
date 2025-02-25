import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ErrorCode,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { costMonitor } from '../cost-monitor/index.js';
import { logger } from '../../utils/logger.js';

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
    
    return {
      resources: [
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
      ],
    };
  });

  // List available resource templates
  server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
    logger.debug('Listing available resource templates');
    
    return {
      resourceTemplates: [
        {
          uriTemplate: 'locallama://usage/{api}',
          name: 'API Usage Statistics',
          mimeType: 'application/json',
          description: 'Token usage and cost statistics for a specific API',
        },
      ],
    };
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
              version: '0.1.0',
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
    
    // Resource not found
    throw new McpError(
      ErrorCode.InvalidRequest,
      `Resource not found: ${uri}`
    );
  });
}