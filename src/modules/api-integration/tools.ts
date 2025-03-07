import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { decisionEngine } from '../decision-engine/index.js';
import { costMonitor } from '../cost-monitor/index.js';
import { benchmarkModule } from '../benchmark/index.js';
import { openRouterModule } from '../openrouter/index.js';
import { logger } from '../../utils/logger.js';
import { config } from '../../config/index.js';

/**
 * Check if OpenRouter API key is configured
 */
export function isOpenRouterConfigured(): boolean {
  return !!config.openRouterApiKey;
}

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
    
    const tools = [
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
              type: 'number', // Corrected type
              description: 'The length of the context in tokens',
            },
            expected_output_length: {
              type: 'number', // Corrected type
              description: 'The expected length of the output in tokens',
            },
            complexity: {
              type: 'number', // Corrected type
              description: 'The complexity of the task (0-1)',
            },
            priority: {
              type: 'string',
              enum: ['speed', 'cost', 'quality'],
              description: 'The priority for this task',
            },
            preemptive: {
              type: 'boolean',
              description: 'Whether to use preemptive routing (faster but less accurate)',
            },
          },
          required: ['task', 'context_length'],
        },
      },
      {
        name: 'preemptive_route_task',
        description: 'Quickly route a coding task without making API calls (faster but less accurate)',
        inputSchema: {
          type: 'object',
          properties: {
            task: {
              type: 'string',
              description: 'The coding task to route',
            },
            context_length: {
              type: 'number', // Corrected type
              description: 'The length of the context in tokens',
            },
            expected_output_length: {
              type: 'number', // Corrected type
              description: 'The expected length of the output in tokens',
            },
            complexity: {
              type: 'number', // Corrected type
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
              type: 'number', // Corrected type
              description: 'The length of the context in tokens',
            },
            expected_output_length: {
              type: 'number', // Corrected type
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
      {
        name: 'benchmark_task',
        description: 'Benchmark the performance of local LLMs vs paid APIs for a specific task',
        inputSchema: {
          type: 'object',
          properties: {
            task_id: {
              type: 'string',
              description: 'A unique identifier for the task',
            },
            task: {
              type: 'string',
              description: 'The coding task to benchmark',
            },
            context_length: {
              type: 'number', // Corrected type
              description: 'The length of the context in tokens',
            },
            expected_output_length: {
              type: 'number', // Corrected type
              description: 'The expected length of the output in tokens',
            },
            complexity: {
              type: 'number', // Corrected type
              description: 'The complexity of the task (0-1)',
            },
            local_model: {
              type: 'string',
              description: 'The local model to use (optional)',
            },
            paid_model: {
              type: 'string',
              description: 'The paid model to use (optional)',
            },
            runs_per_task: {
              type: 'number',
              description: 'Number of runs per task for more accurate results (optional)',
            },
          },
          required: ['task_id', 'task', 'context_length'],
        },
      },
      {
        name: 'benchmark_tasks',
        description: 'Benchmark the performance of local LLMs vs paid APIs for multiple tasks',
        inputSchema: {
          type: 'object',
          properties: {
            tasks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  task_id: {
                    type: 'string',
                    description: 'A unique identifier for the task',
                  },
                  task: {
                    type: 'string',
                    description: 'The coding task to benchmark',
                  },
                  context_length: {
                    type: 'number', // Corrected type
                    description: 'The length of the context in tokens',
                  },
                  expected_output_length: {
                    type: 'number', // Corrected type
                    description: 'The expected length of the output in tokens',
                  },
                  complexity: {
                    type: 'number', // Corrected type
                    description: 'The complexity of the task (0-1)',
                  },
                  local_model: {
                    type: 'string',
                    description: 'The local model to use (optional)',
                  },
                  paid_model: {
                    type: 'string',
                    description: 'The paid model to use (optional)',
                  },
                },
                required: ['task_id', 'task', 'context_length'],
              },
              description: 'Array of tasks to benchmark',
            },
            runs_per_task: {
              type: 'number',
              description: 'Number of runs per task for more accurate results (optional)',
            },
            parallel: {
              type: 'boolean',
              description: 'Whether to run tasks in parallel (optional)',
            },
            max_parallel_tasks: {
              type: 'number',
              description: 'Maximum number of parallel tasks (optional)',
            },
          },
          required: ['tasks'],
        },
      }
    ];
    
    // Add OpenRouter-specific tools if API key is configured
    if (isOpenRouterConfigured()) {
      tools.push(
        {
          name: 'get_free_models',
          description: 'Get a list of free models available from OpenRouter',
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
              preemptive: {
                type: 'boolean',
                description: 'Whether to force an update of models',
              },
            },
            required: [],
          },
        },
        {
          name: 'clear_openrouter_tracking',
          description: 'Clear OpenRouter tracking data and force an update',
          inputSchema: {
            type: 'object',
            properties: {
              task: {
                type: 'string',
                description: 'Unused but required for type compatibility',
              },
              context_length: {
                type: 'number',
                description: 'Unused but required for type compatibility',
              },
              expected_output_length: {
                type: 'number',
                description: 'Unused but required for type compatibility',
              },
              complexity: {
                type: 'number',
                description: 'Unused but required for type compatibility',
              },
              priority: {
                type: 'string',
                enum: ['speed', 'cost', 'quality'],
                description: 'Unused but required for type compatibility',
              },
            },
            required: [],
          },
        },
        {
          name: 'benchmark_free_models',
          description: 'Benchmark the performance of free models from OpenRouter',
          inputSchema: {
            type: 'object',
            properties: {
              tasks: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    task_id: {
                      type: 'string',
                      description: 'A unique identifier for the task',
                    },
                    task: {
                      type: 'string',
                      description: 'The coding task to benchmark',
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
                    local_model: {
                      type: 'string',
                      description: 'The local model to use (optional)',
                    },
                    paid_model: {
                      type: 'string',
                      description: 'The paid model to use (optional)',
                    },
                  },
                  required: ['task_id', 'task', 'context_length'],
                },
                description: 'Array of tasks to benchmark',
              },
              runs_per_task: {
                type: 'number',
                description: 'Number of runs per task for more accurate results (optional)',
              },
              parallel: {
                type: 'boolean',
                description: 'Whether to run tasks in parallel (optional)',
              },
              max_parallel_tasks: {
                type: 'number',
                description: 'Maximum number of parallel tasks (optional)',
              },
            },
            required: ['tasks'],
          },
        },
        {
          name: 'set_model_prompting_strategy',
          description: 'Update the prompting strategy for an OpenRouter model',
          inputSchema: {
            type: 'object',
            properties: {
              task: {
                type: 'string',
                description: 'The ID of the model to update',
              },
              context_length: {
                type: 'number',
                description: 'Unused but required for type compatibility',
              },
              expected_output_length: {
                type: 'number',
                description: 'The system prompt to use',
              },
              priority: {
                type: 'string',
                enum: ['speed', 'cost', 'quality'],
                description: 'The user prompt template to use',
              },
              complexity: {
                type: 'number',
                description: 'The assistant prompt template to use',
              },
              preemptive: {
                type: 'boolean',
                description: 'Whether to use chat format',
              },
            },
            required: ['task', 'context_length'],
          },
        }
      );
    }
    
    return { tools };
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
          
          // Check if preemptive routing is requested
          if (args.preemptive) {
            // Use preemptive routing for faster decision
            const decision = await decisionEngine.preemptiveRouting({
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
          }
          
          // Get full routing decision
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
      
      case 'preemptive_route_task': {
        try {
          // Validate arguments
          if (!args.task) {
            return {
              content: [{ type: 'text', text: 'Missing required argument: task' }],
              isError: true,
            };
          }
          
          // Use preemptive routing for faster decision
          const decision = await decisionEngine.preemptiveRouting({
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
          logger.error('Error in preemptive routing:', error);
          return {
            content: [
              {
                type: 'text',
                text: `Error in preemptive routing: ${error instanceof Error ? error.message : String(error)}`,
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
      
      case 'benchmark_task': {
        try {
          // Validate arguments
          if (!args.task_id) {
            return {
              content: [{ type: 'text', text: 'Missing required argument: task_id' }],
              isError: true,
            };
          }
          
          if (!args.task) {
            return {
              content: [{ type: 'text', text: 'Missing required argument: task' }],
              isError: true,
            };
          }
          
          if (args.context_length === undefined) {
            return {
              content: [{ type: 'text', text: 'Missing required argument: context_length' }],
              isError: true,
            };
          }
          
          // Create benchmark config
          const config = {
            ...benchmarkModule.defaultConfig,
            runsPerTask: (args.runs_per_task as number) || benchmarkModule.defaultConfig.runsPerTask,
          };
          
          // Run benchmark
          const result = await benchmarkModule.benchmarkTask({
            taskId: args.task_id as string,
            task: args.task as string,
            contextLength: args.context_length as number,
            expectedOutputLength: (args.expected_output_length as number) || 0,
            complexity: (args.complexity as number) || 0.5,
            localModel: args.local_model as string | undefined,
            paidModel: args.paid_model as string | undefined,
          }, config);
          
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (error) {
          logger.error('Error benchmarking task:', error);
          return {
            content: [
              {
                type: 'text',
                text: `Error benchmarking task: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            isError: true,
          };
        }
      }
      
      case 'benchmark_tasks': {
        try {
          // Validate arguments
          if (!args.tasks || !Array.isArray(args.tasks) || args.tasks.length === 0) {
            return {
              content: [{ type: 'text', text: 'Missing or invalid required argument: tasks' }],
              isError: true,
            };
          }
          
          // Create benchmark config
          const config = {
            ...benchmarkModule.defaultConfig,
            runsPerTask: (args.runs_per_task as number) || benchmarkModule.defaultConfig.runsPerTask,
            parallel: (args.parallel as boolean) || benchmarkModule.defaultConfig.parallel,
            maxParallelTasks: (args.max_parallel_tasks as number) || benchmarkModule.defaultConfig.maxParallelTasks,
          };
          
          // Convert tasks to the correct format
          const tasks = (args.tasks as any[]).map(task => ({
            taskId: task.task_id,
            task: task.task,
            contextLength: task.context_length,
            expectedOutputLength: task.expected_output_length || 0,
            complexity: task.complexity || 0.5,
            localModel: task.local_model,
            paidModel: task.paid_model,
          }));
          
          // Run benchmarks
          const summary = await benchmarkModule.benchmarkTasks(tasks, config);
          
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(summary, null, 2),
              },
            ],
          };
        } catch (error) {
          logger.error('Error benchmarking tasks:', error);
          return {
            content: [
              {
                type: 'text',
                text: `Error benchmarking tasks: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            isError: true,
          };
        }
      }
      
      case 'get_free_models': {
        try {
          // Check if OpenRouter API key is configured
          if (!isOpenRouterConfigured()) {
            return {
              content: [{ type: 'text', text: 'OpenRouter API key not configured' }],
              isError: true,
            };
          }
          
          // Initialize OpenRouter module if needed
          if (Object.keys(openRouterModule.modelTracking.models).length === 0) {
            await openRouterModule.initialize();
          }
          
          // Check if preemptive is set to force an update
          const forceUpdate = args.preemptive === true;
          logger.info(`Getting free models with forceUpdate=${forceUpdate}`);
          
          // Get free models with forceUpdate parameter
          const freeModels = await costMonitor.getFreeModels(forceUpdate);
          
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(freeModels, null, 2),
              },
            ],
          };
        } catch (error) {
          logger.error('Error getting free models:', error);
          return {
            content: [
              {
                type: 'text',
                text: `Error getting free models: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            isError: true,
          };
        }
      }
      
      case 'benchmark_free_models': {
        try {
          // Check if OpenRouter API key is configured
          if (!isOpenRouterConfigured()) {
            return {
              content: [{ type: 'text', text: 'OpenRouter API key not configured' }],
              isError: true,
            };
          }
          
          // Validate arguments
          if (!args.tasks || !Array.isArray(args.tasks) || args.tasks.length === 0) {
            return {
              content: [{ type: 'text', text: 'Missing or invalid required argument: tasks' }],
              isError: true,
            };
          }
          
          // Create benchmark config
          const config = {
            ...benchmarkModule.defaultConfig,
            runsPerTask: (args.runs_per_task as number) || benchmarkModule.defaultConfig.runsPerTask,
            parallel: (args.parallel as boolean) || benchmarkModule.defaultConfig.parallel,
            maxParallelTasks: (args.max_parallel_tasks as number) || benchmarkModule.defaultConfig.maxParallelTasks,
          };
          
          // Convert tasks to the correct format
          const tasks = (args.tasks as any[]).map(task => ({
            taskId: task.task_id,
            task: task.task,
            contextLength: task.context_length,
            expectedOutputLength: task.expected_output_length || 0,
            complexity: task.complexity || 0.5,
            localModel: task.local_model,
            paidModel: task.paid_model,
          }));
          
          // Run benchmarks for free models
          const summary = await benchmarkModule.benchmarkTasks(tasks, config);
          
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(summary, null, 2),
              },
            ],
          };
        } catch (error) {
          logger.error('Error benchmarking free models:', error);
          return {
            content: [
              {
                type: 'text',
                text: `Error benchmarking free models: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            isError: true,
          };
        }
      }
      
      case 'set_model_prompting_strategy': {
        try {
          // Check if OpenRouter API key is configured
          if (!isOpenRouterConfigured()) {
            return {
              content: [{ type: 'text', text: 'OpenRouter API key not configured' }],
              isError: true,
            };
          }
          
          // Validate arguments
          if (!args.task) {
            return {
              content: [{ type: 'text', text: 'Missing required argument: task' }],
              isError: true,
            };
          }
          
          // Initialize OpenRouter module if needed
          if (Object.keys(openRouterModule.modelTracking.models).length === 0) {
            await openRouterModule.initialize();
          }
          
          // Update prompting strategy
          await openRouterModule.updatePromptingStrategy(
            args.task as string,
            {
              systemPrompt: args.expected_output_length as unknown as string,
              userPrompt: args.priority as string,
              assistantPrompt: args.complexity as unknown as string,
              useChat: args.preemptive as boolean,
            },
            1.0, // Success rate
            1.0  // Quality score
          );
          
          return {
            content: [
              {
                type: 'text',
                text: `Successfully updated prompting strategy for model ${args.task}`,
              },
            ],
          };
        } catch (error) {
          logger.error('Error updating prompting strategy:', error);
          return {
            content: [
              {
                type: 'text',
                text: `Error updating prompting strategy: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            isError: true,
          };
        }
      }
      
      case 'clear_openrouter_tracking': {
        try {
          // Check if OpenRouter API key is configured
          if (!isOpenRouterConfigured()) {
            return {
              content: [{ type: 'text', text: 'OpenRouter API key not configured' }],
              isError: true,
            };
          }
          
          logger.info('Clearing OpenRouter tracking data and forcing update...');
          
          // Call the clearTrackingData method
          await openRouterModule.clearTrackingData();
          
          // Get the updated free models
          const freeModels = await openRouterModule.getFreeModels();
          
          return {
            content: [
              {
                type: 'text',
                text: `Successfully cleared OpenRouter tracking data and forced update. Found ${freeModels.length} free models.`,
              },
            ],
          };
        } catch (error) {
          logger.error('Error clearing OpenRouter tracking data:', error);
          return {
            content: [
              {
                type: 'text',
                text: `Error clearing OpenRouter tracking data: ${error instanceof Error ? error.message : String(error)}`,
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