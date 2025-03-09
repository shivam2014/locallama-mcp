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
import { taskVerificationService } from '../decision-engine/services/taskVerificationService.js';
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
             description: 'The coding task to route'
           },
           context_length: {
             type: 'number',
             description: 'The length of the context in tokens'
           },
           expected_output_length: {
             type: 'number',
             description: 'The expected length of the output in tokens'
           },
           complexity: {
             type: 'number',
             description: 'The complexity of the task (0-1)'
           },
           priority: {
             type: 'string',
             enum: ['speed', 'cost', 'quality'],
             description: 'The priority for this task'
           },
           preemptive: {
             type: 'boolean',
             description: 'Whether to use preemptive routing (faster but less accurate)'
           }
         },
         required: ['task', 'context_length']
       }
     },
     {
        name: 'benchmark_task',
        description: 'Benchmark the performance of local LLMs vs paid APIs for a specific task',
        inputSchema: {
          type: 'object',
          properties: {
            task_id: {
              type: 'string',
              description: 'A unique identifier for the task'
            },
            task: {
              type: 'string',
              description: 'The coding task to benchmark'
            },
            context_length: {
              type: 'number',
              description: 'The length of the context in tokens'
            },
            expected_output_length: {
              type: 'number',
              description: 'The expected length of the output in tokens'
            },
            complexity: {
              type: 'number',
              description: 'The complexity of the task (0-1)'
            },
            local_model: {
              type: 'string',
              description: 'The local model to use (optional)'
            },
            paid_model: {
              type: 'string',
              description: 'The paid model to use (optional)'
            },
            runs_per_task: {
              type: 'number',
              description: 'Number of runs per task for more accurate results (optional)'
            }
          },
          required: ['task_id', 'task', 'context_length']
        }
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
                    description: 'A unique identifier for the task'
                  },
                  task: {
                    type: 'string',
                    description: 'The coding task to benchmark'
                  },
                  context_length: {
                    type: 'number',
                    description: 'The length of the context in tokens'
                  },
                  expected_output_length: {
                    type: 'number',
                    description: 'The expected length of the output in tokens'
                  },
                  complexity: {
                    type: 'number',
                    description: 'The complexity of the task (0-1)'
                  },
                  local_model: {
                    type: 'string',
                    description: 'The local model to use (optional)'
                  },
                  paid_model: {
                    type: 'string',
                    description: 'The paid model to use (optional)'
                  }
                },
                required: ['task_id', 'task', 'context_length']
              },
              description: 'Array of tasks to benchmark'
            },
            runs_per_task: {
              type: 'number',
              description: 'Number of runs per task for more accurate results (optional)'
            },
            parallel: {
              type: 'boolean',
              description: 'Whether to run tasks in parallel (optional)'
            },
            max_parallel_tasks: {
              type: 'number',
              description: 'Maximum number of parallel tasks (optional)'
            }
          },
          required: ['tasks']
        }
      },
        inputSchema: {
          type: 'object',
          properties: {
            task: {
              type: 'string',
              description: 'The coding task to route'
            },
            context_length: {
              type: 'number',
              description: 'The length of the context in tokens'
            },
            expected_output_length: {
              type: 'number',
              description: 'The expected length of the output in tokens'
            },
            complexity: {
              type: 'number',
              description: 'The complexity of the task (0-1)'
            },
            priority: {
              type: 'string',
              enum: ['speed', 'cost', 'quality'],
              description: 'The priority for this task'
            },
            preemptive: {
              type: 'boolean',
              description: 'Whether to use preemptive routing (faster but less accurate)'
            }
          },
          required: ['task', 'context_length']
        }
      },
      {
        name: 'run_linter',
        description: 'Run syntax and style checks on code',
        inputSchema: {
          type: 'object',
          properties: {
            code: {
              type: 'string',
              description: 'The code to lint'
            },
            language: {
              type: 'string',
              description: 'Programming language of the code'
            }
          },
          required: ['code', 'language']
        }
      },
      {
        name: 'run_tests',
        description: 'Run test cases against code',
        inputSchema: {
          type: 'object',
          properties: {
            code: {
              type: 'string',
              description: 'The code to test'
            },
            testCases: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  input: {
                    type: 'string',
                    description: 'Test input'
                  },
                  expectedOutput: {
                    type: 'string',
                    description: 'Expected output'
                  }
                },
                required: ['input', 'expectedOutput']
              }
            }
          },
          required: ['code', 'testCases']
        }
      },
      {
        name: 'preemptive_route_task',
        description: 'Quickly route a coding task without making API calls (faster but less accurate)',
        inputSchema: {
          type: 'object',
          properties: {
            task: {
              type: 'string',
              description: 'The coding task to route'
            },
            context_length: {
              type: 'number',
              description: 'The length of the context in tokens'
            },
            expected_output_length: {
              type: 'number',
              description: 'The expected length of the output in tokens'
            },
            complexity: {
              type: 'number',
              description: 'The complexity of the task (0-1)'
            },
            priority: {
              type: 'string',
              enum: ['speed', 'cost', 'quality'],
              description: 'The priority for this task'
            },
            preemptive: {
              type: 'boolean',
              description: 'Whether to use preemptive routing'
            }
          },
          required: ['task', 'context_length']
        }
      },
      {
        name: 'get_cost_estimate',
        description: 'Get an estimate of the cost for a task',
        inputSchema: {
          type: 'object',
          properties: {
            context_length: {
              type: 'number',
              description: 'The length of the context in tokens'
            },
            expected_output_length: {
              type: 'number',
              description: 'The expected length of the output in tokens'
            },
            model: {
              type: 'string',
              description: 'The model to use (optional)'
            }
          },
          required: ['context_length']
        }
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
                description: 'Optional task for context'
              },
              context_length: {
                type: 'number',
                description: 'Optional context length for filtering'
              },
              expected_output_length: {
                type: 'number',
                description: 'Optional expected output length for filtering'
              },
              complexity: {
                type: 'number',
                description: 'Optional task complexity for filtering'
              },
              priority: {
                type: 'string',
                enum: ['speed', 'cost', 'quality'],
                description: 'Optional priority for filtering'
              },
              preemptive: {
                type: 'boolean',
                description: 'Whether to force an update of models'
              }
            },
            required: [] // No required fields for this operation
          }
        }
      );
    }
    
    return { tools };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    logger.debug(`Calling tool: ${name} with arguments:`, args);
    
    if (!args) {
      return {
        content: [{ type: 'text', text: 'Missing arguments' }],
        isError: true
      };
    }
    
    switch (name) {
      case 'route_task': {
        try {
          if (!args.task) {
            return {
              content: [{ type: 'text', text: 'Missing required argument: task' }],
              isError: true
            };
          }
          
          if (args.preemptive) {
            const decision = await decisionEngine.preemptiveRouting({
              task: args.task as string,
              contextLength: (args.context_length as number) || 0,
              expectedOutputLength: (args.expected_output_length as number) || 0,
              complexity: (args.complexity as number) || 0.5,
              priority: (args.priority as 'speed' | 'cost' | 'quality') || 'quality'
            });
            
            return {
              content: [{ type: 'text', text: JSON.stringify(decision, null, 2) }]
            };
          }
          
          const decision = await decisionEngine.routeTask({
            task: args.task as string,
            contextLength: (args.context_length as number) || 0,
            expectedOutputLength: (args.expected_output_length as number) || 0,
            complexity: (args.complexity as number) || 0.5,
            priority: (args.priority as 'speed' | 'cost' | 'quality') || 'quality'
          });
          
          return {
            content: [{ type: 'text', text: JSON.stringify(decision, null, 2) }]
          };
        } catch (error) {
          logger.error('Error routing task:', error);
          return {
            content: [{ type: 'text', text: `Error routing task: ${error instanceof Error ? error.message : String(error)}` }],
            isError: true
          };
        }
      }

      case 'run_linter': {
        try {
          if (!args.code || !args.language) {
            return {
              content: [{ type: 'text', text: 'Missing required arguments: code and language' }],
              isError: true
            };
          }

          const result = await taskVerificationService.runLinter(args.code as string, args.language as string);
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
          };
        } catch (error) {
          logger.error('Error running linter:', error);
          return {
            content: [{ type: 'text', text: `Error running linter: ${error instanceof Error ? error.message : String(error)}` }],
            isError: true
          };
        }
      }

      case 'run_tests': {
        try {
          if (!args.code || !args.testCases) {
            return {
              content: [{ type: 'text', text: 'Missing required arguments: code and testCases' }],
              isError: true
            };
          }

          const result = await taskVerificationService.runTests(
            args.code as string,
            args.testCases as Array<{ input: string; expectedOutput: string }>
          );
          
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
          };
        } catch (error) {
          logger.error('Error running tests:', error);
          return {
            content: [{ type: 'text', text: `Error running tests: ${error instanceof Error ? error.message : String(error)}` }],
            isError: true
          };
        }
      }

      case 'get_cost_estimate': {
        try {
          if (args.context_length === undefined) {
            return {
              content: [{ type: 'text', text: 'Missing required argument: context_length' }],
              isError: true
            };
          }
          
          const estimate = await costMonitor.estimateCost({
            contextLength: args.context_length as number,
            outputLength: (args.expected_output_length as number) || 0,
            model: args.model as string | undefined
          });
          
          return {
            content: [{ type: 'text', text: JSON.stringify(estimate, null, 2) }]
          };
        } catch (error) {
          logger.error('Error getting cost estimate:', error);
          return {
            content: [{ type: 'text', text: `Error getting cost estimate: ${error instanceof Error ? error.message : String(error)}` }],
            isError: true
          };
        }
      }

      case 'get_free_models': {
        try {
          if (!isOpenRouterConfigured()) {
            return {
              content: [{ type: 'text', text: 'OpenRouter API key not configured' }],
              isError: true
            };
          }
          
          const forceUpdate = args.preemptive === true;
          logger.info(`Getting free models with forceUpdate=${forceUpdate}`);
          
          const freeModels = await costMonitor.getFreeModels(forceUpdate);
          
          return {
            content: [{ type: 'text', text: JSON.stringify(freeModels, null, 2) }]
          };
        } catch (error) {
          logger.error('Error getting free models:', error);
          return {
            content: [{ type: 'text', text: `Error getting free models: ${error instanceof Error ? error.message : String(error)}` }],
            isError: true
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