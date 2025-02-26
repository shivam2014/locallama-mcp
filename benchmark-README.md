# LocalLama MCP Benchmarking System

This benchmarking system allows you to compare the performance of local LLM models against paid API models for coding tasks. It helps you make informed decisions about which models to use for different types of tasks based on performance, quality, and cost considerations.

## Overview

The benchmarking system consists of several components:

1. **Benchmark Module**: Core functionality for running benchmarks and collecting metrics
2. **Model Selector**: Interactive tool to select which models to benchmark
3. **Benchmark Runner**: Script to run benchmarks with different modes
4. **Results Analysis**: Tools to analyze and visualize benchmark results

## Getting Started

### Prerequisites

- Node.js 18+ installed
- Local LLM setup (optional, but recommended):
  - LM Studio with models installed, or
  - Ollama with models installed
- API keys for paid services (optional):
  - OpenAI
  - Anthropic
  - Google
  - Mistral
  - Others as needed

### Configuration

1. Set up your environment variables in the `.env` file:

```
# Local LLM Endpoints
LM_STUDIO_ENDPOINT=http://localhost:1234/v1
OLLAMA_ENDPOINT=http://localhost:11434/api

# Configuration
DEFAULT_LOCAL_MODEL=qwen2.5-coder-3b-instruct
TOKEN_THRESHOLD=1500
COST_THRESHOLD=0.02
QUALITY_THRESHOLD=0.7

# Benchmark Configuration
BENCHMARK_RUNS_PER_TASK=3
BENCHMARK_PARALLEL=false
BENCHMARK_MAX_PARALLEL_TASKS=2
BENCHMARK_TASK_TIMEOUT=60000
BENCHMARK_SAVE_RESULTS=true
BENCHMARK_RESULTS_PATH=./benchmark-results

# Logging
LOG_LEVEL=debug
```

2. Build the TypeScript code:

```bash
npm run build
```

## Using the Benchmarking System

### Step 1: Select Models to Benchmark

Run the model selector to choose which models you want to benchmark:

```bash
node model-selector.js
```

This interactive tool will:
- Ask which API providers you have access to
- Let you select which models to benchmark for each provider
- Ask which local LLM models you have installed
- Save your selections to `benchmark-models.json`

### Step 2: Run Benchmarks

There are several ways to run benchmarks:

#### Comprehensive Benchmark (Recommended)

This mode compares all selected local models against all selected paid models:

```bash
node run-benchmarks.js comprehensive
```

#### Single Task Benchmark

Run a benchmark for a single task:

```bash
node run-benchmarks.js single 0  # Run the first task
```

#### Sequential Benchmarks

Run benchmarks for all tasks sequentially:

```bash
node run-benchmarks.js sequential
```

#### Default Benchmark

Run a standard benchmark with default settings:

```bash
node run-benchmarks.js
```

### Step 3: Analyze Results

After running benchmarks, results are saved to the `benchmark-results` directory:

- Individual task results: `[task-id]-[timestamp].json`
- Summary results: `summary-[timestamp].json`
- Comprehensive results: `comprehensive-summary-[timestamp].json`
- Markdown report: `benchmark-report-[timestamp].md`

The markdown report provides a human-readable summary of the benchmark results, including:
- Model comparisons
- Task results
- Recommendations

## Benchmark Metrics

The benchmarking system collects the following metrics:

- **Response Time**: How long it takes for a model to generate a response (in milliseconds)
- **Success Rate**: The percentage of tasks completed successfully
- **Quality Score**: A measure of the quality of the generated code (0-1)
- **Token Usage**: The number of tokens used for prompts and completions
- **Cost**: The estimated cost of using paid API models

## Customizing Benchmarks

### Adding New Tasks

To add new benchmark tasks, edit the `benchmarkTasks` array in `run-benchmarks.js`:

```javascript
const benchmarkTasks = [
  {
    taskId: 'your-task-id',
    task: 'Your task description here',
    contextLength: 500,  // Estimated context length in tokens
    expectedOutputLength: 700,  // Estimated output length in tokens
    complexity: 0.5,  // Task complexity (0-1)
  },
  // Add more tasks here
];
```

### Adjusting Benchmark Parameters

You can adjust benchmark parameters in the `.env` file:

- `BENCHMARK_RUNS_PER_TASK`: Number of runs per task for more accurate results
- `BENCHMARK_PARALLEL`: Whether to run tasks in parallel
- `BENCHMARK_MAX_PARALLEL_TASKS`: Maximum number of parallel tasks
- `BENCHMARK_TASK_TIMEOUT`: Timeout for each task in milliseconds
- `BENCHMARK_SAVE_RESULTS`: Whether to save results to disk
- `BENCHMARK_RESULTS_PATH`: Path to save results

## Integration with Decision Engine

The benchmark results can be used to refine the decision engine's routing logic:

1. Run comprehensive benchmarks to gather performance data
2. Analyze the results to identify which models perform best for different types of tasks
3. Update the decision engine's weights and thresholds based on the benchmark results
4. Implement model-specific routing strategies based on task characteristics

## Troubleshooting

### Common Issues

- **Connection Errors**: Ensure that your local LLM servers (LM Studio, Ollama) are running
- **API Errors**: Verify that your API keys are valid and properly configured
- **Timeout Errors**: Increase the `BENCHMARK_TASK_TIMEOUT` value for complex tasks
- **Memory Issues**: Reduce the number of parallel tasks or run benchmarks sequentially

### Logs

Check the console output for detailed logs. You can adjust the log level in the `.env` file:

```
LOG_LEVEL=debug  # Options: debug, info, warn, error
```

## Contributing

Contributions to the benchmarking system are welcome! Here are some ways you can contribute:

- Add new benchmark tasks
- Improve the quality evaluation algorithm
- Add support for new models
- Enhance the results visualization
- Optimize the benchmarking process

## License

This project is licensed under the ISC License.