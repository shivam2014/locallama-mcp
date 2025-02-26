#!/usr/bin/env node

/**
 * Benchmark Runner Script
 * 
 * This script runs benchmarks for different types of coding tasks to compare
 * the performance of local LLMs vs paid APIs.
 */

import { benchmarkModule } from './dist/modules/benchmark/index.js';
import { logger } from './dist/utils/logger.js';
import { costMonitor } from './dist/modules/cost-monitor/index.js';
import fs from 'fs/promises';

// Define benchmark tasks
const benchmarkTasks = [
  // Simple tasks
  {
    taskId: 'simple-function',
    task: 'Write a JavaScript function that calculates the factorial of a number.',
    contextLength: 200,
    expectedOutputLength: 300,
    complexity: 0.2,
  },
  {
    taskId: 'simple-validation',
    task: 'Write a function to validate an email address using regular expressions.',
    contextLength: 250,
    expectedOutputLength: 350,
    complexity: 0.3,
  },
  
  // Medium complexity tasks
  {
    taskId: 'medium-algorithm',
    task: 'Implement a binary search algorithm in JavaScript with proper error handling and edge cases.',
    contextLength: 500,
    expectedOutputLength: 700,
    complexity: 0.5,
  },
  {
    taskId: 'medium-api',
    task: 'Create a simple Express.js API endpoint that handles user registration with validation and error handling.',
    contextLength: 600,
    expectedOutputLength: 800,
    complexity: 0.6,
  },
  
  // Complex tasks
  {
    taskId: 'complex-design-pattern',
    task: 'Implement a TypeScript class that uses the Observer design pattern for a pub/sub event system with strong typing.',
    contextLength: 800,
    expectedOutputLength: 1200,
    complexity: 0.8,
  },
  {
    taskId: 'complex-async',
    task: 'Create a React component that fetches data from an API, handles loading states, errors, and implements pagination with proper TypeScript types.',
    contextLength: 1000,
    expectedOutputLength: 1500,
    complexity: 0.9,
  },
];

// Default local LLM models to benchmark if no configuration is found
const defaultLocalModels = [
  'qwen2.5-coder-3b-instruct',  // Default model
  'llama3',                     // General purpose model
  'codellama:7b-instruct',      // Code-specific model
  'mistral:7b-instruct-v0.2',   // Alternative model
  'phi3:mini',                  // Smaller, efficient model
];

// Default paid API models to benchmark if no configuration is found
const defaultPaidModels = [
  'gpt-3.5-turbo',              // OpenAI base model
  'gpt-4o',                     // OpenAI advanced model
  'claude-3-sonnet-20240229',   // Claude 3 Sonnet
  'gemini-1.5-pro',             // Gemini Pro
  'mistral-large-latest',       // Mistral Large
];

/**
 * Load model configuration from file
 */
async function loadModelConfig() {
  try {
    const configData = await fs.readFile('./benchmark-models.json', 'utf8');
    const config = JSON.parse(configData);
    
    logger.info('Loaded model configuration from benchmark-models.json');
    logger.info(`Found ${config.paidModels.length} paid models and ${config.localModels.length} local models`);
    
    return {
      localModels: config.localModels,
      paidModels: config.paidModels
    };
  } catch (error) {
    logger.warn('Could not load model configuration file. Using default models.');
    logger.warn('Run model-selector.js first to customize which models to benchmark.');
    
    return {
      localModels: defaultLocalModels,
      paidModels: defaultPaidModels
    };
  }
}

/**
 * Run a benchmark for a specific local model against a specific paid model
 */
async function runModelComparison(localModel, paidModel, task) {
  logger.info(`Comparing ${localModel} vs ${paidModel} on task: ${task.taskId}`);
  
  try {
    const result = await benchmarkModule.benchmarkTask({
      ...task,
      localModel: localModel,
      paidModel: paidModel
    });
    
    logger.info(`Benchmark completed for ${task.taskId}`);
    logger.info(`Local model (${result.local.model}): ${result.local.timeTaken}ms, Success: ${result.local.successRate}, Quality: ${result.local.qualityScore}`);
    logger.info(`Paid model (${result.paid.model}): ${result.paid.timeTaken}ms, Success: ${result.paid.successRate}, Quality: ${result.paid.qualityScore}`);
    logger.info(`Cost savings: $${result.paid.cost.toFixed(4)}`);
    
    return result;
  } catch (error) {
    logger.error(`Error running benchmark for ${localModel} vs ${paidModel} on ${task.taskId}:`, error);
    return null;
  }
}

/**
 * Run a comprehensive benchmark comparing all local models against all paid models
 */
async function runComprehensiveBenchmark() {
  // Load model configuration
  const { localModels: selectedLocalModels, paidModels: selectedPaidModels } = await loadModelConfig();
  
  logger.info(`Running comprehensive benchmark with ${selectedLocalModels.length} local models, ${selectedPaidModels.length} paid models, and ${benchmarkTasks.length} tasks`);
  
  const results = [];
  const summaries = {};
  
  // Get available models to check which ones are actually available
  const availableModels = await costMonitor.getAvailableModels();
  const availableLocalModels = selectedLocalModels.filter(model => 
    availableModels.some(m => m.id === model || m.id.includes(model))
  );
  
  if (availableLocalModels.length === 0) {
    logger.warn('No local models are available. Using default model from configuration.');
    availableLocalModels.push(process.env.DEFAULT_LOCAL_MODEL || 'qwen2.5-coder-3b-instruct');
  }
  
  logger.info(`Available local models: ${availableLocalModels.join(', ')}`);
  
  // Run benchmarks for each local model against each paid model
  for (const localModel of availableLocalModels) {
    summaries[localModel] = {};
    
    for (const paidModel of selectedPaidModels) {
      summaries[localModel][paidModel] = {
        tasks: 0,
        localAvgTime: 0,
        localAvgSuccessRate: 0,
        localAvgQualityScore: 0,
        paidAvgTime: 0,
        paidAvgSuccessRate: 0,
        paidAvgQualityScore: 0,
        totalCostSavings: 0,
      };
      
      for (const task of benchmarkTasks) {
        const result = await runModelComparison(localModel, paidModel, task);
        
        if (result) {
          results.push(result);
          
          // Update summary
          const summary = summaries[localModel][paidModel];
          summary.tasks++;
          summary.localAvgTime += result.local.timeTaken;
          summary.localAvgSuccessRate += result.local.successRate;
          summary.localAvgQualityScore += result.local.qualityScore;
          summary.paidAvgTime += result.paid.timeTaken;
          summary.paidAvgSuccessRate += result.paid.successRate;
          summary.paidAvgQualityScore += result.paid.qualityScore;
          summary.totalCostSavings += result.paid.cost;
        }
      }
      
      // Calculate averages
      const summary = summaries[localModel][paidModel];
      if (summary.tasks > 0) {
        summary.localAvgTime /= summary.tasks;
        summary.localAvgSuccessRate /= summary.tasks;
        summary.localAvgQualityScore /= summary.tasks;
        summary.paidAvgTime /= summary.tasks;
        summary.paidAvgSuccessRate /= summary.tasks;
        summary.paidAvgQualityScore /= summary.tasks;
      }
      
      // Log summary for this model pair
      logger.info(`\nSummary for ${localModel} vs ${paidModel}:`);
      logger.info(`Tasks: ${summary.tasks}`);
      logger.info(`Local Avg Time: ${summary.localAvgTime.toFixed(2)}ms`);
      logger.info(`Local Avg Success Rate: ${summary.localAvgSuccessRate.toFixed(2)}`);
      logger.info(`Local Avg Quality Score: ${summary.localAvgQualityScore.toFixed(2)}`);
      logger.info(`Paid Avg Time: ${summary.paidAvgTime.toFixed(2)}ms`);
      logger.info(`Paid Avg Success Rate: ${summary.paidAvgSuccessRate.toFixed(2)}`);
      logger.info(`Paid Avg Quality Score: ${summary.paidAvgQualityScore.toFixed(2)}`);
      logger.info(`Total Cost Savings: $${summary.totalCostSavings.toFixed(4)}`);
      logger.info(`Time Ratio (Local/Paid): ${(summary.localAvgTime / summary.paidAvgTime).toFixed(2)}x`);
      logger.info(`Success Rate Diff: ${(summary.localAvgSuccessRate - summary.paidAvgSuccessRate).toFixed(2)}`);
      logger.info(`Quality Score Diff: ${(summary.localAvgQualityScore - summary.paidAvgQualityScore).toFixed(2)}`);
    }
  }
  
  // Save comprehensive results
  try {
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const filePath = `./benchmark-results/comprehensive-summary-${timestamp}.json`;
    
    await fs.mkdir('./benchmark-results', { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(summaries, null, 2));
    
    logger.info(`Saved comprehensive benchmark summary to ${filePath}`);
  } catch (error) {
    logger.error('Error saving comprehensive benchmark summary:', error);
  }
  
  return summaries;
}

/**
 * Run a single benchmark task
 */
async function runSingleBenchmark(taskIndex = 0) {
  if (taskIndex >= benchmarkTasks.length) {
    logger.info('All individual benchmarks completed.');
    return;
  }
  
  const task = benchmarkTasks[taskIndex];
  logger.info(`Running benchmark for task: ${task.taskId}`);
  
  try {
    const result = await benchmarkModule.benchmarkTask(task);
    logger.info(`Benchmark completed for ${task.taskId}`);
    logger.info(`Local model (${result.local.model}): ${result.local.timeTaken}ms, Success: ${result.local.successRate}, Quality: ${result.local.qualityScore}`);
    logger.info(`Paid model (${result.paid.model}): ${result.paid.timeTaken}ms, Success: ${result.paid.successRate}, Quality: ${result.paid.qualityScore}`);
    logger.info(`Cost savings: $${result.paid.cost.toFixed(4)}`);
    
    // Run next task
    await runSingleBenchmark(taskIndex + 1);
  } catch (error) {
    logger.error(`Error running benchmark for ${task.taskId}:`, error);
    // Continue with next task even if this one fails
    await runSingleBenchmark(taskIndex + 1);
  }
}

/**
 * Run all benchmarks in batch mode
 */
async function runAllBenchmarks() {
  logger.info(`Running batch benchmark for ${benchmarkTasks.length} tasks`);
  
  try {
    // Configure benchmark options
    const config = {
      ...benchmarkModule.defaultConfig,
      runsPerTask: 3,
      parallel: false,
      maxParallelTasks: 2,
    };
    
    // Run all benchmarks
    const summary = await benchmarkModule.benchmarkTasks(benchmarkTasks, config);
    
    // Log summary results
    logger.info('Benchmark Summary:');
    logger.info(`Tasks: ${summary.taskCount}`);
    logger.info(`Avg Context Length: ${summary.avgContextLength} tokens`);
    logger.info(`Avg Output Length: ${summary.avgOutputLength} tokens`);
    logger.info(`Avg Complexity: ${summary.avgComplexity.toFixed(2)}`);
    
    logger.info('\nLocal Model Performance:');
    logger.info(`Avg Time: ${summary.local.avgTimeTaken}ms`);
    logger.info(`Avg Success Rate: ${summary.local.avgSuccessRate.toFixed(2)}`);
    logger.info(`Avg Quality Score: ${summary.local.avgQualityScore.toFixed(2)}`);
    logger.info(`Total Tokens: ${summary.local.totalTokenUsage.total}`);
    
    logger.info('\nPaid Model Performance:');
    logger.info(`Avg Time: ${summary.paid.avgTimeTaken}ms`);
    logger.info(`Avg Success Rate: ${summary.paid.avgSuccessRate.toFixed(2)}`);
    logger.info(`Avg Quality Score: ${summary.paid.avgQualityScore.toFixed(2)}`);
    logger.info(`Total Tokens: ${summary.paid.totalTokenUsage.total}`);
    logger.info(`Total Cost: $${summary.paid.totalCost.toFixed(4)}`);
    
    logger.info('\nComparison:');
    logger.info(`Time Ratio (Local/Paid): ${summary.comparison.timeRatio.toFixed(2)}x`);
    logger.info(`Success Rate Diff: ${summary.comparison.successRateDiff.toFixed(2)}`);
    logger.info(`Quality Score Diff: ${summary.comparison.qualityScoreDiff.toFixed(2)}`);
    logger.info(`Cost Savings: $${summary.comparison.costSavings.toFixed(4)}`);
    
    return summary;
  } catch (error) {
    logger.error('Error running batch benchmarks:', error);
    return null;
  }
}

/**
 * Generate a markdown report from benchmark results
 */
async function generateMarkdownReport(summaries) {
  let markdown = `# Benchmark Results: Local LLMs vs Paid APIs\n\n`;
  markdown += `*Generated on: ${new Date().toISOString()}*\n\n`;
  
  markdown += `## Overview\n\n`;
  markdown += `This report compares the performance of various local LLM models against paid API models for coding tasks.\n\n`;
  
  markdown += `## Model Comparisons\n\n`;
  
  for (const [localModel, paidModelResults] of Object.entries(summaries)) {
    markdown += `### Local Model: ${localModel}\n\n`;
    
    markdown += `| Paid Model | Time Ratio (Local/Paid) | Success Rate Diff | Quality Score Diff | Cost Savings |\n`;
    markdown += `|------------|-------------------------|-------------------|-------------------|-------------|\n`;
    
    for (const [paidModel, summary] of Object.entries(paidModelResults)) {
      if (summary.tasks > 0) {
        const timeRatio = (summary.localAvgTime / summary.paidAvgTime).toFixed(2);
        const successRateDiff = (summary.localAvgSuccessRate - summary.paidAvgSuccessRate).toFixed(2);
        const qualityScoreDiff = (summary.localAvgQualityScore - summary.paidAvgQualityScore).toFixed(2);
        const costSavings = summary.totalCostSavings.toFixed(4);
        
        markdown += `| ${paidModel} | ${timeRatio}x | ${successRateDiff} | ${qualityScoreDiff} | $${costSavings} |\n`;
      }
    }
    
    markdown += `\n`;
  }
  
  markdown += `## Task Results\n\n`;
  markdown += `The benchmark included the following tasks:\n\n`;
  
  benchmarkTasks.forEach(task => {
    markdown += `### ${task.taskId}\n\n`;
    markdown += `**Description:** ${task.task}\n\n`;
    markdown += `**Complexity:** ${task.complexity}\n\n`;
    markdown += `**Context Length:** ${task.contextLength} tokens\n\n`;
    markdown += `**Expected Output Length:** ${task.expectedOutputLength} tokens\n\n`;
  });
  
  markdown += `## Recommendations\n\n`;
  markdown += `Based on these benchmark results, the following recommendations can be made:\n\n`;
  markdown += `1. For simple coding tasks, consider using [best local model for simple tasks] as it provides the best balance of performance and quality.\n\n`;
  markdown += `2. For complex tasks where quality is critical, [best local model for complex tasks] performs well compared to paid APIs.\n\n`;
  markdown += `3. When response time is the priority, paid APIs like [fastest paid API] offer significantly faster responses.\n\n`;
  markdown += `4. For cost-sensitive applications with high usage volume, using local LLMs can result in significant cost savings.\n\n`;
  
  // Save the report
  try {
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const filePath = `./benchmark-results/benchmark-report-${timestamp}.md`;
    
    await fs.mkdir('./benchmark-results', { recursive: true });
    await fs.writeFile(filePath, markdown);
    
    logger.info(`Saved benchmark report to ${filePath}`);
    return filePath;
  } catch (error) {
    logger.error('Error saving benchmark report:', error);
    return null;
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const mode = args[0] || 'all'; // Default to 'all'
const taskIndex = parseInt(args[1] || '0', 10);

// Run benchmarks based on mode
if (mode === 'single') {
  if (taskIndex >= 0 && taskIndex < benchmarkTasks.length) {
    logger.info(`Running single benchmark for task: ${benchmarkTasks[taskIndex].taskId}`);
    benchmarkModule.benchmarkTask(benchmarkTasks[taskIndex])
      .then(result => {
        logger.info('Benchmark completed:', JSON.stringify(result, null, 2));
      })
      .catch(error => {
        logger.error('Error running benchmark:', error);
      });
  } else {
    logger.error(`Invalid task index: ${taskIndex}. Must be between 0 and ${benchmarkTasks.length - 1}.`);
  }
} else if (mode === 'sequential') {
  runSingleBenchmark(0)
    .catch(error => {
      logger.error('Error running sequential benchmarks:', error);
    });
} else if (mode === 'comprehensive') {
  runComprehensiveBenchmark()
    .then(summaries => {
      return generateMarkdownReport(summaries);
    })
    .then(reportPath => {
      if (reportPath) {
        logger.info(`Benchmark report generated at: ${reportPath}`);
      }
    })
    .catch(error => {
      logger.error('Error running comprehensive benchmarks:', error);
    });
} else {
  // Default to 'all'
  runAllBenchmarks()
    .catch(error => {
      logger.error('Error running all benchmarks:', error);
    });
}