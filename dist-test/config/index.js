"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.validateConfig = validateConfig;
var dotenv_1 = require("dotenv");
// Load environment variables from .env file
dotenv_1.default.config();
// Determine root directory in a way that works with both runtime and tests
// Use process.cwd() which is compatible with both ESM and CommonJS
var rootDir = process.cwd();
/**
 * Configuration for the LocalLama MCP Server
 */
exports.config = {
    // Local LLM endpoints
    lmStudioEndpoint: process.env.LM_STUDIO_ENDPOINT || 'http://localhost:1234/v1',
    ollamaEndpoint: process.env.OLLAMA_ENDPOINT || 'http://localhost:11434/api',
    // Default model configuration
    defaultLocalModel: process.env.DEFAULT_LOCAL_MODEL || 'llama3',
    // Decision thresholds
    tokenThreshold: parseInt(process.env.TOKEN_THRESHOLD || '1000', 10),
    costThreshold: parseFloat(process.env.COST_THRESHOLD || '0.02'),
    qualityThreshold: parseFloat(process.env.QUALITY_THRESHOLD || '0.7'),
    // API Keys
    openRouterApiKey: process.env.OPENROUTER_API_KEY,
    // Benchmark configuration
    benchmark: {
        runsPerTask: parseInt(process.env.BENCHMARK_RUNS_PER_TASK || '3', 10),
        parallel: process.env.BENCHMARK_PARALLEL === 'true',
        maxParallelTasks: parseInt(process.env.BENCHMARK_MAX_PARALLEL_TASKS || '2', 10),
        taskTimeout: parseInt(process.env.BENCHMARK_TASK_TIMEOUT || '60000', 10),
        saveResults: process.env.BENCHMARK_SAVE_RESULTS !== 'false',
        resultsPath: process.env.BENCHMARK_RESULTS_PATH || './benchmark-results',
    },
    // Logging
    logLevel: process.env.LOG_LEVEL || 'info',
    // Paths
    rootDir: rootDir,
};
/**
 * Validate that the configuration is valid
 */
function validateConfig() {
    // Validate that the endpoints are valid URLs
    try {
        new URL(exports.config.lmStudioEndpoint);
        new URL(exports.config.ollamaEndpoint);
    }
    catch (error) {
        console.error('Invalid endpoint URL in configuration:', error);
        return false;
    }
    // Validate that the thresholds are valid numbers
    if (isNaN(exports.config.tokenThreshold) || exports.config.tokenThreshold <= 0) {
        console.error('Invalid token threshold:', exports.config.tokenThreshold);
        return false;
    }
    if (isNaN(exports.config.costThreshold) || exports.config.costThreshold <= 0) {
        console.error('Invalid cost threshold:', exports.config.costThreshold);
        return false;
    }
    if (isNaN(exports.config.qualityThreshold) || exports.config.qualityThreshold <= 0 || exports.config.qualityThreshold > 1) {
        console.error('Invalid quality threshold:', exports.config.qualityThreshold);
        return false;
    }
    return true;
}
