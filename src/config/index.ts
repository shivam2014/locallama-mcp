import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config();

// Determine root directory in a way that works with both runtime and tests
// Use process.cwd() which is compatible with both ESM and CommonJS
const rootDir = process.cwd();

/**
 * Configuration for the LocalLama MCP Server
 */
export const config = {
  // Local LLM endpoints
  lmStudioEndpoint: process.env.LM_STUDIO_ENDPOINT || 'http://localhost:1234/v1',
  ollamaEndpoint: process.env.OLLAMA_ENDPOINT || 'http://localhost:11434/api',
  
  // Default model configuration
  defaultLocalModel: process.env.DEFAULT_LOCAL_MODEL || 'llama3',
  
  // Decision thresholds
  tokenThreshold: parseInt(process.env.TOKEN_THRESHOLD || '1000', 10),
  costThreshold: parseFloat(process.env.COST_THRESHOLD || '0.02'),
  qualityThreshold: parseFloat(process.env.QUALITY_THRESHOLD || '0.7'),
  
  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
  
  // Paths
  rootDir,
};

/**
 * Validate that the configuration is valid
 */
export function validateConfig(): boolean {
  // Validate that the endpoints are valid URLs
  try {
    new URL(config.lmStudioEndpoint);
    new URL(config.ollamaEndpoint);
  } catch (error) {
    console.error('Invalid endpoint URL in configuration:', error);
    return false;
  }
  
  // Validate that the thresholds are valid numbers
  if (isNaN(config.tokenThreshold) || config.tokenThreshold <= 0) {
    console.error('Invalid token threshold:', config.tokenThreshold);
    return false;
  }
  
  if (isNaN(config.costThreshold) || config.costThreshold <= 0) {
    console.error('Invalid cost threshold:', config.costThreshold);
    return false;
  }
  
  if (isNaN(config.qualityThreshold) || config.qualityThreshold <= 0 || config.qualityThreshold > 1) {
    console.error('Invalid quality threshold:', config.qualityThreshold);
    return false;
  }
  
  return true;
}