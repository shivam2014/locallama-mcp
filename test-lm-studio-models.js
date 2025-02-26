#!/usr/bin/env node

/**
 * LM Studio Models Test Script
 * 
 * This script tests all available LM Studio models with a simple coding task
 * and optionally tests a paid API if credentials are available.
 */

import { benchmarkModule } from './dist/modules/benchmark/index.js';
import { logger } from './dist/utils/logger.js';
import { costMonitor } from './dist/modules/cost-monitor/index.js';
import fs from 'fs/promises';

// Simple coding task for testing
const simpleTask = {
  taskId: 'simple-function',
  task: 'Write a JavaScript function that calculates the factorial of a number.',
  contextLength: 200,
  expectedOutputLength: 300,
  complexity: 0.2,
};

/**
 * Test a specific LM Studio model
 */
async function testLmStudioModel(modelId) {
  logger.info(`Testing LM Studio model: ${modelId}`);
  
  try {
    const result = await benchmarkModule.benchmarkTask({
      ...simpleTask,
      localModel: modelId,
      // We're not testing against a paid model here
      skipPaidModel: true
    });
    
    logger.info(`Test completed for ${modelId}`);
    logger.info(`Time taken: ${result.local.timeTaken}ms`);
    logger.info(`Success rate: ${result.local.successRate}`);
    logger.info(`Quality score: ${result.local.qualityScore}`);
    
    return result;
  } catch (error) {
    logger.error(`Error testing model ${modelId}:`, error);
    return null;
  }
}

/**
 * Main function
 */
async function main() {
  logger.info('Starting LM Studio models test');
  
  // Get available models
  const availableModels = await costMonitor.getAvailableModels();
  const lmStudioModels = availableModels.filter(model => 
    model.provider === 'lm-studio' && 
    !model.id.includes('embed') // Skip embedding models
  );
  
  logger.info(`Found ${lmStudioModels.length} LM Studio models`);
  
  if (lmStudioModels.length === 0) {
    logger.warn('No LM Studio models found. Make sure LM Studio is running.');
    return;
  }
  
  // Test each model
  const results = {};
  for (const model of lmStudioModels) {
    const result = await testLmStudioModel(model.id);
    if (result) {
      results[model.id] = {
        timeTaken: result.local.timeTaken,
        successRate: result.local.successRate,
        qualityScore: result.local.qualityScore,
        output: result.local.output
      };
    }
  }
  
  // Save results
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const filePath = `./lm-studio-test-results-${timestamp}.json`;
  
  await fs.writeFile(filePath, JSON.stringify(results, null, 2));
  logger.info(`Results saved to ${filePath}`);
  
  // Generate a simple report
  let report = `# LM Studio Models Test Results\n\n`;
  report += `*Generated on: ${new Date().toISOString()}*\n\n`;
  report += `## Model Performance\n\n`;
  report += `| Model | Time (ms) | Success Rate | Quality Score |\n`;
  report += `|-------|-----------|--------------|---------------|\n`;
  
  for (const [modelId, result] of Object.entries(results)) {
    report += `| ${modelId} | ${result.timeTaken} | ${result.successRate} | ${result.qualityScore} |\n`;
  }
  
  const reportPath = `./lm-studio-test-report-${timestamp}.md`;
  await fs.writeFile(reportPath, report);
  logger.info(`Report saved to ${reportPath}`);
}

// Run the main function
main().catch(error => {
  logger.error('Error running tests:', error);
});