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

### API Integration & Configurability

- Provides a configuration interface that allows users to specify the endpoints for their local instances (e.g., LM Studio, Ollama)
- Interacts with these endpoints using standardized API calls

### Fallback & Error Handling

- Implements fallback mechanisms in case the paid API's data is unavailable or the local service fails
- Includes robust logging and error handling strategies

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

Create a `.env` file in the root directory with the following variables:

```
# Local LLM Endpoints
LM_STUDIO_ENDPOINT=http://localhost:1234/v1
OLLAMA_ENDPOINT=http://localhost:11434/api

# Configuration
DEFAULT_LOCAL_MODEL=llama3
TOKEN_THRESHOLD=1000
COST_THRESHOLD=0.02
QUALITY_THRESHOLD=0.7

# Logging
LOG_LEVEL=info
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

## Development

### Running in Development Mode

```bash
npm run dev
```

### Running Tests

```bash
npm test
```

## License

ISC