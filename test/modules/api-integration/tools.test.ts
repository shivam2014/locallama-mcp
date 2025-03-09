import { setupToolHandlers } from '../../../src/modules/api-integration/tools.js';
import { decisionEngine } from '../../../src/modules/decision-engine/index.js';
import { costMonitor } from '../../../src/modules/cost-monitor/index.js';
import { taskVerificationService } from '../../../src/modules/decision-engine/services/taskVerificationService.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

// Mock dependencies
jest.mock('../../../src/modules/decision-engine/index.js');
jest.mock('../../../src/modules/cost-monitor/index.js');
jest.mock('../../../src/modules/decision-engine/services/taskVerificationService.js');
jest.mock('../../../src/modules/api-integration/tools.js', () => {
  const originalModule = jest.requireActual('../../../src/modules/api-integration/tools.js');
  return {
    ...originalModule,
    isOpenRouterConfigured: () => false
  };
});
jest.mock('../../../src/utils/logger.js', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('API Integration - Tools', () => {
  let server: Server;
  let listToolsHandler: any;
  let callToolHandler: any;
  
  beforeEach(() => {
    // Reset mocks
    jest.resetAllMocks();
    
    // Create a mock server
    server = {
      setRequestHandler: jest.fn((schema, handler) => {
        if (schema === ListToolsRequestSchema) {
          listToolsHandler = handler;
        } else if (schema === CallToolRequestSchema) {
          callToolHandler = handler;
        }
      }),
      onerror: jest.fn(),
      connect: jest.fn(),
      close: jest.fn(),
    } as unknown as Server;
    
    // Set up tool handlers
    setupToolHandlers(server);
    
    // Setup mock responses
    (decisionEngine.routeTask as jest.Mock).mockResolvedValue({
      provider: 'local',
      model: 'llama3',
      factors: {
        cost: {
          local: 0,
          paid: 0.007,
          wasFactor: true,
          weight: 0.3
        },
        complexity: {
          score: 0.6,
          wasFactor: true,
          weight: 0.3
        },
        tokenUsage: {
          contextLength: 5000,
          outputLength: 1000,
          totalTokens: 6000,
          wasFactor: true,
          weight: 0.2
        },
        priority: {
          value: 'cost',
          wasFactor: true,
          weight: 0.2
        }
      },
      confidence: 0.75,
      explanation: 'Local model is cheaper',
      scores: {
        local: 0.8,
        paid: 0.5
      }
    });
    
    (costMonitor.estimateCost as jest.Mock).mockResolvedValue({
      local: {
        cost: {
          prompt: 0,
          completion: 0,
          total: 0,
          currency: 'USD'
        },
        tokenCount: {
          prompt: 5000,
          completion: 1000,
          total: 6000
        }
      },
      paid: {
        cost: {
          prompt: 0.005,
          completion: 0.002,
          total: 0.007,
          currency: 'USD'
        },
        tokenCount: {
          prompt: 5000,
          completion: 1000,
          total: 6000
        }
      },
      recommendation: 'local'
    });
  });
  
  describe('ListToolsRequestSchema', () => {
    test('returns list of available tools', async () => {
      const result = await listToolsHandler();
      
      expect(result.tools).toHaveLength(7);
      expect(result.tools.map((t: { name: string }) => t.name)).toEqual([
        'route_task',
        'run_linter',
        'run_tests',
        'preemptive_route_task',
        'get_cost_estimate',
        'benchmark_task',
        'benchmark_tasks'
      ]);
      
      // Verify input schemas
      const routeTaskSchema = result.tools[0].inputSchema;
      expect(routeTaskSchema.required).toContain('task');
      expect(routeTaskSchema.required).toContain('context_length');
      
      const costEstimateSchema = result.tools[5].inputSchema;
      expect(costEstimateSchema.required).toContain('context_length');
    });
  });
  
  describe('CallToolRequestSchema', () => {
    test('handles route_task tool call', async () => {
      const result = await callToolHandler({
        params: {
          name: 'route_task',
          arguments: {
            task: 'Create a React component',
            context_length: 5000,
            expected_output_length: 1000,
            complexity: 0.6,
            priority: 'cost'
          }
        }
      });
      
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      
      const decision = JSON.parse(result.content[0].text);
      expect(decision.provider).toBe('local');
      expect(decision.model).toBe('llama3');
      
      expect(decisionEngine.routeTask).toHaveBeenCalledWith({
        task: 'Create a React component',
        contextLength: 5000,
        expectedOutputLength: 1000,
        complexity: 0.6,
        priority: 'cost'
      });
    });

    test('handles run_linter tool call', async () => {
      // Mock linter success response
      (taskVerificationService.runLinter as jest.Mock).mockResolvedValue({
        success: true,
        issues: []
      });

      const result = await callToolHandler({
        params: {
          name: 'run_linter',
          arguments: {
            code: 'function add(a, b) { return a + b; }',
            language: 'javascript'
          }
        }
      });

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');

      const linterResult = JSON.parse(result.content[0].text);
      expect(linterResult.success).toBe(true);
      expect(linterResult.issues).toHaveLength(0);

      expect(taskVerificationService.runLinter).toHaveBeenCalledWith(
        'function add(a, b) { return a + b; }',
        'javascript'
      );
    });

    test('handles run_linter tool call with issues', async () => {
      // Mock linter response with issues
      (taskVerificationService.runLinter as jest.Mock).mockResolvedValue({
        success: false,
        issues: ['Use const instead of var', 'Use === instead of ==']
      });

      const result = await callToolHandler({
        params: {
          name: 'run_linter',
          arguments: {
            code: 'var x = 1; if (x == 2) {}',
            language: 'javascript'
          }
        }
      });

      const linterResult = JSON.parse(result.content[0].text);
      expect(linterResult.success).toBe(false);
      expect(linterResult.issues).toHaveLength(2);
    });

    test('handles run_tests tool call', async () => {
      // Mock test runner success response
      (taskVerificationService.runTests as jest.Mock).mockResolvedValue({
        success: true,
        results: [
          { passed: true },
          { passed: true }
        ]
      });

      const result = await callToolHandler({
        params: {
          name: 'run_tests',
          arguments: {
            code: 'function add(input) { return input.a + input.b; }',
            testCases: [
              {
                input: '{"a": 1, "b": 2}',
                expectedOutput: '3'
              },
              {
                input: '{"a": -1, "b": 1}',
                expectedOutput: '0'
              }
            ]
          }
        }
      });

      expect(result.content).toHaveLength(1);
      const testResults = JSON.parse(result.content[0].text);
      expect(testResults.success).toBe(true);
      expect(testResults.results).toHaveLength(2);
      expect(testResults.results.every((r: { passed: boolean }) => r.passed)).toBe(true);
    });

    test('handles run_tests tool call with failures', async () => {
      // Mock test runner response with failures
      (taskVerificationService.runTests as jest.Mock).mockResolvedValue({
        success: false,
        results: [
          { passed: false, error: 'Expected 3 but got -1' }
        ]
      });

      const result = await callToolHandler({
        params: {
          name: 'run_tests',
          arguments: {
            code: 'function add(input) { return input.a - input.b; }', // Bug: subtraction instead of addition
            testCases: [
              {
                input: '{"a": 1, "b": 2}',
                expectedOutput: '3'
              }
            ]
          }
        }
      });

      const testResults = JSON.parse(result.content[0].text);
      expect(testResults.success).toBe(false);
      expect(testResults.results[0].passed).toBe(false);
      expect(testResults.results[0].error).toBeDefined();
    });
    
    test('handles get_cost_estimate tool call', async () => {
      const result = await callToolHandler({
        params: {
          name: 'get_cost_estimate',
          arguments: {
            context_length: 5000,
            expected_output_length: 1000,
            model: 'llama3'
          }
        }
      });
      
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      
      const estimate = JSON.parse(result.content[0].text);
      expect(estimate.local.cost.total).toBe(0);
      expect(estimate.paid.cost.total).toBe(0.007);
      
      expect(costMonitor.estimateCost).toHaveBeenCalledWith({
        contextLength: 5000,
        outputLength: 1000,
        model: 'llama3'
      });
    });
    
    test('handles missing arguments', async () => {
      const result = await callToolHandler({
        params: {
          name: 'route_task',
          arguments: null
        }
      });
      
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Missing arguments');
    });
    
    test('handles missing required arguments for route_task', async () => {
      const result = await callToolHandler({
        params: {
          name: 'route_task',
          arguments: {
            // Missing 'task'
            context_length: 5000
          }
        }
      });
      
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Missing required argument: task');
    });
    
    test('handles missing required arguments for get_cost_estimate', async () => {
      const result = await callToolHandler({
        params: {
          name: 'get_cost_estimate',
          arguments: {
            // Missing 'context_length'
            expected_output_length: 1000
          }
        }
      });
      
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Missing required argument: context_length');
    });
    
    test('handles unknown tool name', async () => {
      await expect(
        callToolHandler({
          params: {
            name: 'unknown_tool',
            arguments: {}
          }
        })
      ).rejects.toThrow(McpError);
    });
    
    test('handles errors from decision engine', async () => {
      (decisionEngine.routeTask as jest.Mock).mockRejectedValue(new Error('Internal error'));
      
      const result = await callToolHandler({
        params: {
          name: 'route_task',
          arguments: {
            task: 'Create a React component',
            context_length: 5000
          }
        }
      });
      
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error routing task');
    });
    
    test('handles errors from cost monitor', async () => {
      (costMonitor.estimateCost as jest.Mock).mockRejectedValue(new Error('Internal error'));
      
      const result = await callToolHandler({
        params: {
          name: 'get_cost_estimate',
          arguments: {
            context_length: 5000
          }
        }
      });
      
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error getting cost estimate');
    });
  });
});