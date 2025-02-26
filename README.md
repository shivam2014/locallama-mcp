# LocalLama MCP Server

An MCP Server that works with Cline.Bot to optimize costs by intelligently routing coding tasks between local LLMs and paid APIs.

## Overview

LocalLama MCP Server is designed to reduce token usage and costs by dynamically deciding whether to offload a coding task to a local, less capable instruct LLM (e.g., LM Studio, Ollama) versus using a paid API.

## Key Components

### Cost & Token Monitoring Module

- Queries the current API service for context usage, cumulative costs, API token prices, and available credits
- Gathers real-time data to inform the decision engine

### Decision Engine

- Defines rules that compare the cost of using the paid API against the cost (and potential quality trade-offs) of offloading to a local LLM
- Includes configurable thresholds for when to offload
- Uses preemptive routing based on benchmark data to make faster decisions without API calls

### API Integration & Configurability

- Provides a configuration interface that allows users to specify the endpoints for their local instances (e.g., LM Studio, Ollama)
- Interacts with these endpoints using standardized API calls

### Fallback & Error Handling

- Implements fallback mechanisms in case the paid API's data is unavailable or the local service fails
- Includes robust logging and error handling strategies

### Benchmarking System

- Compares performance of local LLM models against paid API models
- Measures response time, success rate, quality score, and token usage
- Generates detailed reports for analysis and decision-making

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/locallama-mcp.git
cd locallama-mcp

# Install dependencies
npm install

# Build the project
npm run build
```

## Configuration

Copy the `.env.example` file to create your own `.env` file:

```bash
cp .env.example .env
```

Then edit the `.env` file with your specific configuration:

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

# API Keys (replace with your actual keys)
OPENROUTER_API_KEY=your_openrouter_api_key_here

# Logging
LOG_LEVEL=debug
```

## Usage

### Starting the Server

```bash
npm start
```

### Using with Cline.Bot

To use this MCP Server with Cline.Bot, add it to your Cline MCP settings:

```json
{
  "mcpServers": {
    "locallama": {
      "command": "node",
      "args": ["/path/to/locallama-mcp/dist/index.js"],
      "env": {},
      "disabled": false
    }
  }
}
```

### Running Benchmarks

The project includes a comprehensive benchmarking system to compare local LLM models against paid API models:

```bash
# Run a simple benchmark
node run-benchmarks.js

# Run a comprehensive benchmark across multiple models
node run-benchmarks.js comprehensive
```

Benchmark results are stored in the `benchmark-results` directory and include:
- Individual task performance metrics in JSON format
- Summary reports in JSON and Markdown formats
- Comprehensive analysis of model performance

## Benchmark Results

The repository includes benchmark results that provide valuable insights into the performance of different models. These results:

1. Do not contain any sensitive API keys or personal information
2. Provide performance metrics that help inform the decision engine
3. Include response times, success rates, quality scores, and token usage statistics
4. Are useful for anyone who wants to understand the trade-offs between local LLMs and paid APIs

## Development

### Running in Development Mode

```bash
npm run dev
```

### Running Tests

```bash
npm test
```

## Security Notes

- The `.gitignore` file is configured to prevent sensitive data from being committed to the repository
- API keys and other secrets should be stored in your `.env` file, which is excluded from version control
- Benchmark results included in the repository do not contain sensitive information

## License

ISC