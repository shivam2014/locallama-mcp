import { decisionEngine } from './dist/modules/decision-engine/index.js';
import { logger } from './dist/utils/logger.js';

/**
 * Benchmark free models from OpenRouter
 * This script runs the benchmarkFreeModels method to gather performance data
 * for free models available from OpenRouter
 */
async function main() {
  try {
    logger.info('Initializing decision engine...');
    await decisionEngine.initialize();
    
    logger.info('Starting benchmark of free models...');
    await decisionEngine.benchmarkFreeModels();
    
    logger.info('Benchmark completed successfully');
  } catch (error) {
    logger.error('Error running benchmark:', error);
  }
}

main().catch(console.error);