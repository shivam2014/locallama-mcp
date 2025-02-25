import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { decisionEngine } from '../decision-engine/index.js';
import { costMonitor } from '../cost-monitor/index.js';
import { logger } from '../../utils/logger.js';

/**
 * Set up tool handlers for the MCP Server
 * 
 * Tools provide functionality for making decisions about routing tasks
 * between local LLMs and paid APIs.
 */
export function setupToolHandlers(server: Server): void {
  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    logger.debug('Listing available tools');
    
    return {
      tools: [
        {
          name: 'route_task',
          description: 'Route a coding task to either a local LLM or a paid API based on cost and complexity',
          inputSchema: {
            type: 'object',
            properties: {
              task: {
                type: 'string',
                description: 'The coding task to route',
              },
              context_length: {
                type: 'number',
                description: 'The length of the context in tokens',
              },
              expected_output_length: {
                type: 'number',
                description: 'The expected length of the output in tokens',
              },
              complexity: {
                type: 'number',
                description: 'The complexity of the task (0-1)',
              },
              priority: {
                type: 'string',
                enum: ['speed', 'cost', 'quality'],
                description: 'The priority for this task',
              },
            },
            required: ['task', 'context_length'],
          },
        },
        {
          name: 'get_cost_estimate',
          description: 'Get an estimate of the cost for a task',
          inputSchema: {
            type: 'object',
            properties: {
              context_length: {
                type: 'number',
                description: 'The length of the context in tokens',
              },
              expected_output_length: {
                type: 'number',
                description: 'The expected length of the output in tokens',
              },
              model: {
                type: 'string',
                description: 'The model to use (optional)',
              },
            },
            required: ['context_length'],
          },
        },
      ],
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    logger.debug(`Calling tool: ${name} with arguments:`, args);
    
    // Ensure args is defined
    if (!args) {
      return {
        content: [{ type: 'text', text: 'Missing arguments' }],
        isError: true,
      };
    }
    
    switch (name) {
      case 'route_task': {
        try {
          // Validate arguments
          if (!args.task) {
            return {
              content: [{ type: 'text', text: 'Missing required argument: task' }],
              isError: true,
            };
          }
          
          // Get routing decision
          const decision = await decisionEngine.routeTask({
            task: args.task as string,
            contextLength: (args.context_length as number) || 0,
            expectedOutputLength: (args.expected_output_length as number) || 0,
            complexity: (args.complexity as number) || 0.5,
            priority: (args.priority as 'speed' | 'cost' | 'quality') || 'quality',
          });
          
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(decision, null, 2),
              },
            ],
          };
        } catch (error) {
          logger.error('Error routing task:', error);
          return {
            content: [
              {
                type: 'text',
                text: `Error routing task: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            isError: true,
          };
        }
      }
      
      case 'get_cost_estimate': {
        try {
          // Validate arguments
          if (args.context_length === undefined) {
            return {
              content: [{ type: 'text', text: 'Missing required argument: context_length' }],
              isError: true,
            };
          }
          
          // Get cost estimate
          const estimate = await costMonitor.estimateCost({
            contextLength: args.context_length as number,
            outputLength: (args.expected_output_length as number) || 0,
            model: args.model as string | undefined,
          });
          
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(estimate, null, 2),
              },
            ],
          };
        } catch (error) {
          logger.error('Error getting cost estimate:', error);
          return {
            content: [
              {
                type: 'text',
                text: `Error getting cost estimate: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            isError: true,
          };
        }
      }
      
      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${name}`
        );
    }
  });
}