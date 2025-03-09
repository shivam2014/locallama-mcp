# LocalLama MCP Server Specification Document

## Overview
The LocalLama MCP (Model Context Protocol) server is a sophisticated routing system that intelligently directs coding tasks between local language models (LLMs) and paid APIs, optimizing for cost, speed, and quality. This specification document outlines the server's architecture, components, and functionality.

## Core Components

### 1. Main Server (src/index.ts)
The entry point of the MCP server that initializes and coordinates all modules.

### 2. Configuration (src/config/index.ts)
Handles server configuration including:
- Environment variables
- API keys and endpoints
- Model settings
- Routing preferences

### 3. Module Structure

#### 3.1 API Integration Module (src/modules/api-integration/)
##### Resources (resources.ts)
- Manages MCP resources
- Handles API response formatting
- Implements resource templates

##### Tools (tools.ts)
Implements the following MCP tools:
1. `route_task`
   - Purpose: Routes coding tasks to optimal model
   - Input Schema:
   ```typescript
   {
     task: string;               // The coding task to route
     context_length: number;     // Context length in tokens
     expected_output_length?: number; // Expected output length
     complexity?: number;        // Task complexity (0-1)
     priority?: 'speed' | 'cost' | 'quality'; // Routing priority
     preemptive?: boolean;      // Use preemptive routing
   }
   ```

2. `preemptive_route_task`
   - Purpose: Quick routing without API calls
   - Input Schema: Similar to route_task
   - Optimized for speed over accuracy

3. `get_cost_estimate`
   - Purpose: Estimates task cost
   - Input Schema:
   ```typescript
   {
     context_length: number;
     expected_output_length?: number;
     model?: string;
   }
   ```

4. `benchmark_task`
   - Purpose: Benchmarks specific task performance
   - Input Schema:
   ```typescript
   {
     task_id: string;
     task: string;
     context_length: number;
     expected_output_length?: number;
     complexity?: number;
     local_model?: string;
     paid_model?: string;
     runs_per_task?: number;
   }
   ```

5. `benchmark_tasks`
   - Purpose: Batch benchmarking
   - Input Schema: Array of benchmark_task inputs
   - Additional parameters:
     - parallel: boolean
     - max_parallel_tasks: number

6. `get_free_models`
   - Purpose: Lists available free models
   - Updates automatically from OpenRouter

7. `clear_openrouter_tracking`
   - Purpose: Resets OpenRouter usage data

8. `benchmark_free_models`
   - Purpose: Benchmarks available free models
   - Uses same schema as benchmark_tasks

9. `set_model_prompting_strategy`
   - Purpose: Updates model prompting configuration
   - Input Schema:
   ```typescript
   {
     model_id: string;
     system_prompt?: string;
     user_template?: string;
     assistant_template?: string;
     use_chat_format?: boolean;
   }
   ```

#### 3.2 Benchmark Module (src/modules/benchmark/)
Handles performance testing:
- Execution time measurement
- Memory usage tracking
- Response quality evaluation
- Cost tracking
- Parallel benchmarking capabilities

#### 3.3 Cost Monitor Module (src/modules/cost-monitor/)
##### API (api.ts)
- Tracks API usage
- Monitors token consumption
- Calculates running costs
- Implements budget controls

##### Utils (utils.ts)
- Cost calculation helpers
- Token counting utilities
- Budget alert systems

#### 3.4 Decision Engine Module (src/modules/decision-engine/)
Core routing logic implementation:

##### Services
1. BenchmarkService (benchmarkService.ts)
   - Manages benchmark data
   - Analyzes performance metrics
   - Maintains historical records

2. CodeEvaluationService (codeEvaluationService.ts)
   - Evaluates code complexity
   - Analyzes token requirements
   - Estimates computational needs

3. ModelsDb (modelsDb.ts)
   - Maintains model registry
   - Tracks model capabilities
   - Updates model statistics

4. ModelSelector (modelSelector.ts)
   - Implements selection algorithm
   - Balances multiple criteria
   - Applies routing rules

##### Utils
ModelProfiles (modelProfiles.ts)
- Defines model characteristics
- Maintains performance profiles
- Updates capability matrices

#### 3.5 Fallback Handler Module (src/modules/fallback-handler/)
Implements fallback strategies:
- Error recovery
- Alternative model selection
- Graceful degradation paths

#### 3.6 OpenRouter Module (src/modules/openrouter/)
Manages OpenRouter integration:
- API communication
- Model tracking
- Usage optimization
- Type definitions (types.ts)

### 4. Types and Interfaces

#### 4.1 Benchmark Types (src/types/benchmark.ts)
```typescript
interface BenchmarkResult {
  execution_time: number;
  memory_usage: number;
  token_count: number;
  cost: number;
  quality_metrics: QualityMetrics;
}

interface QualityMetrics {
  accuracy: number;
  completeness: number;
  efficiency: number;
}
```

#### 4.2 Core Types (src/types/index.ts)
```typescript
interface TaskConfig {
  priority: 'speed' | 'cost' | 'quality';
  complexity: number;
  token_budget: number;
  time_constraint?: number;
}

interface ModelCapabilities {
  max_tokens: number;
  cost_per_token: number;
  average_speed: number;
  specializations: string[];
}
```

### 5. Utilities

#### 5.1 Logger (src/utils/logger.ts)
Implements structured logging:
- Error tracking
- Performance monitoring
- Usage statistics
- Debug information

## Configuration

### 1. Environment Variables (.env)
```bash
OPENROUTER_API_KEY=your_key_here
MAX_PARALLEL_TASKS=5
DEFAULT_PRIORITY=cost
TOKEN_BUDGET=1000000
COST_ALERT_THRESHOLD=10
```

### 2. OpenRouter Models (openrouter-models.json)
```json
{
  "models": [
    {
      "id": "model-id",
      "capabilities": {},
      "cost_config": {},
      "performance_profile": {}
    }
  ]
}
```

## Usage

### 1. Basic Task Routing
```typescript
const result = await mcp.use_tool('route_task', {
  task: 'Implement a sorting algorithm',
  context_length: 500,
  priority: 'speed'
});
```

### 2. Cost Estimation
```typescript
const estimate = await mcp.use_tool('get_cost_estimate', {
  context_length: 1000,
  expected_output_length: 500
});
```

### 3. Benchmarking
```typescript
const benchmark = await mcp.use_tool('benchmark_task', {
  task_id: 'sort-algo-1',
  task: 'Implement quicksort',
  context_length: 800,
  runs_per_task: 3
});
```

## Integration Guidelines

1. **Resource Access**
   - Use URI templates for dynamic resources
   - Implement proper error handling
   - Cache responses when appropriate

2. **Tool Usage**
   - Validate input parameters
   - Handle tool timeouts
   - Implement retry logic

3. **Error Handling**
   - Implement graceful degradation
   - Log errors appropriately
   - Provide meaningful error messages

## Testing

### 1. Unit Tests
Located in test/ directory:
- API integration tests
- Benchmark tests
- Cost monitoring tests
- Decision engine tests

### 2. Test Configuration (jest.config.js)
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80
    }
  }
};
```

## Performance Considerations

1. **Optimization Strategies**
   - Caching of frequent operations
   - Parallel processing where applicable
   - Resource pooling
   - Connection reuse

2. **Resource Management**
   - Memory usage monitoring
   - Connection pooling
   - Token budget enforcement
   - Rate limiting

3. **Scaling Considerations**
   - Horizontal scaling support
   - Load balancing ready
   - State management
   - Distributed operation capability

## Security

1. **Authentication**
   - API key management
   - Rate limiting
   - Request validation

2. **Data Protection**
   - Input sanitization
   - Output validation
   - Sensitive data handling

3. **Access Control**
   - Tool usage restrictions
   - Resource access limits
   - Budget enforcement

## Monitoring and Maintenance

1. **Logging**
   - Performance metrics
   - Error tracking
   - Usage statistics
   - Cost monitoring

2. **Alerting**
   - Cost thresholds
   - Error rates
   - Performance degradation
   - Resource exhaustion

3. **Updates**
   - Model registry updates
   - Performance profile updates
   - Configuration updates
   - Security patches

## Implementation Recommendations

1. **Best Practices**
   - Follow TypeScript best practices
   - Implement proper error handling
   - Use appropriate logging levels
   - Maintain test coverage

2. **Integration Patterns**
   - Use dependency injection
   - Implement proper interfaces
   - Follow SOLID principles
   - Use appropriate design patterns

3. **Performance Optimization**
   - Implement caching strategies
   - Use connection pooling
   - Optimize resource usage
   - Implement proper cleanup

## Future Considerations

1. **Extensibility**
   - Plugin architecture
   - Custom model support
   - Additional tools
   - Enhanced benchmarking

2. **Scalability**
   - Distributed operation
   - Load balancing
   - Horizontal scaling
   - State management

3. **Integration**
   - Additional APIs
   - More model providers
   - Enhanced monitoring
   - Advanced analytics