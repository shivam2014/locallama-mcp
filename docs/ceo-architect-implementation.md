# CEO Architect Mode Implementation

## Current Implementation Analysis

### Implemented Components
1. Task Routing
   - `route_task` tool with priority, context_length, and complexity parameters
   - Cost estimation via `get_cost_estimate` tool
   - Basic routing between local LLM and paid APIs
   - Comprehensive code evaluation service

### Missing Components
1. Task Verification
   - Need to add `run_linter` tool for syntax/style verification
   - Need to add `run_tests` tool for test case validation
   - Need to implement verification retry logic
   - Need to track delegation attempts and failures

## Implementation Plan

### 1. Task Verification Service
Create a new service (`taskVerificationService.ts`) that will:
- Track task attempts and their outcomes
- Implement retry logic
- Handle verification workflow

```typescript
interface TaskAttempt {
  taskId: string;
  provider: 'local' | 'paid';
  modelId: string;
  timestamp: number;
  success: boolean;
  verificationResults: {
    linting: boolean;
    tests: boolean;
    evaluation: boolean;
  };
}

interface TaskTracker {
  attempts: TaskAttempt[];
  failureCount: number;
  lastAttempt: number;
}
```

### 2. New MCP Tools
Add two new tools to the API integration:

#### run_linter Tool
```typescript
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
}
```

#### run_tests Tool
```typescript
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
          }
        }
      }
    },
    required: ['code', 'testCases']
  }
}
```

### 3. Enhanced Decision Engine
Modify the decision engine to:
- Track task delegation attempts
- Implement verification workflow:
  1. Run linter
  2. Run tests
  3. Evaluate code quality
- Switch to paid API after 2 failures
- Store verification results

### 4. Integration Points
1. Modify `routeTask` to include verification:
```typescript
async routeTask(params: TaskRoutingParams): Promise<RoutingDecision> {
  // Check previous attempts
  const attempts = await taskVerificationService.getAttempts(params.taskId);
  
  // If failed twice with local LLM, force paid API
  if (attempts.failureCount >= 2) {
    return this.forcePaidApi(params);
  }
  
  // Normal routing logic...
}
```

2. Add verification workflow:
```typescript
async verifyTask(taskId: string, code: string): Promise<boolean> {
  // Run linter
  const lintResult = await this.runLinter(code);
  if (!lintResult.success) return false;
  
  // Run tests
  const testResult = await this.runTests(code);
  if (!testResult.success) return false;
  
  // Evaluate code quality
  const evalResult = await codeEvaluationService.evaluateCodeQuality(task, code);
  return evalResult.score >= 0.7;
}
```

## Next Steps
1. Switch to Code mode to implement these changes
2. Create the TaskVerificationService
3. Add the new MCP tools
4. Modify the decision engine
5. Test the complete workflow

## Migration Plan
1. Implement changes in a new branch
2. Add unit tests for new components
3. Test with existing codebase
4. Deploy updates
5. Monitor verification success rates