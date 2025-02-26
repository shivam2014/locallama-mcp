#!/usr/bin/env node

/**
 * Comprehensive Benchmark Script
 * 
 * This script tests both LM Studio models and OpenRouter models with a variety of coding tasks.
 * It saves the results to files for analysis.
 */

import { benchmarkModule } from './dist/modules/benchmark/index.js';
import { logger } from './dist/utils/logger.js';
import { costMonitor } from './dist/modules/cost-monitor/index.js';
import { config } from './dist/config/index.js';
import fs from 'fs/promises';
import axios from 'axios';

// Define benchmark tasks of varying complexity
const benchmarkTasks = [
  // Simple task
  {
    taskId: 'simple-function',
    task: 'Write a JavaScript function that calculates the factorial of a number.',
    contextLength: 200,
    expectedOutputLength: 300,
    complexity: 0.2,
  },
  // Medium task
  {
    taskId: 'medium-algorithm',
    task: 'Implement a binary search algorithm in JavaScript with proper error handling and edge cases.',
    contextLength: 500,
    expectedOutputLength: 700,
    complexity: 0.5,
  },
  // Complex task
  {
    taskId: 'complex-design-pattern',
    task: 'Implement a TypeScript class that uses the Observer design pattern for a pub/sub event system with strong typing.',
    contextLength: 800,
    expectedOutputLength: 1200,
    complexity: 0.8,
  },
];

// OpenRouter models to test
const openRouterModels = [
  'anthropic/claude-3-opus-20240229',
  'anthropic/claude-3-sonnet-20240229',
  'anthropic/claude-3-haiku-20240307',
  'google/gemini-1.5-pro-latest',
  'meta-llama/llama-3-70b-instruct',
  'mistralai/mistral-large-latest',
  'openai/gpt-4o',
  'openai/gpt-3.5-turbo'
];

/**
 * Call OpenRouter API
 */
async function callOpenRouterApi(
  modelId,
  task,
  timeout
) {
  if (!config.openRouterApiKey) {
    logger.error('OpenRouter API key is not configured');
    return { success: false };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: modelId,
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: task }
        ],
        temperature: 0.7,
        max_tokens: 1500,
      },
      {
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.openRouterApiKey}`,
          'HTTP-Referer': 'https://locallama-mcp.example.com',
          'X-Title': 'LocalLama MCP Benchmark'
        },
      }
    );
    
    clearTimeout(timeoutId);
    
    if (response.status === 200 && response.data.choices && response.data.choices.length > 0) {
      return {
        success: true,
        text: response.data.choices[0].message.content,
        usage: response.data.usage,
      };
    } else {
      return { success: false };
    }
  } catch (error) {
    logger.error(`Error calling OpenRouter API for model ${modelId}:`, error);
    return { success: false };
  }
}

/**
 * Run a benchmark for an OpenRouter model
 */
async function runOpenRouterBenchmark(
  modelId,
  task,
  contextLength,
  expectedOutputLength,
  config
) {
  // Initialize results
  let totalTimeTaken = 0;
  let successCount = 0;
  let totalQualityScore = 0;
  const tokenUsage = {
    prompt: 0,
    completion: 0,
    total: 0,
  };
  let output = '';
  
  // Run multiple times to get average performance
  for (let i = 0; i < config.runsPerTask; i++) {
    try {
      logger.debug(`Run ${i + 1}/${config.runsPerTask} for ${modelId}`);
      
      // Measure response time
      const startTime = Date.now();
      
      // Call OpenRouter API
      const response = await callOpenRouterApi(modelId, task, config.taskTimeout);
      const success = response.success;
      const qualityScore = benchmarkModule.evaluateQuality(task, response.text || '');
      const promptTokens = response.usage?.prompt_tokens || contextLength;
      const completionTokens = response.usage?.completion_tokens || expectedOutputLength;
      
      const endTime = Date.now();
      const timeTaken = endTime - startTime;
      
      // Update results
      totalTimeTaken += timeTaken;
      if (success) {
        successCount++;
        output = response.text || '';
      }
      totalQualityScore += qualityScore;
      tokenUsage.prompt += promptTokens;
      tokenUsage.completion += completionTokens;
      tokenUsage.total += promptTokens + completionTokens;
      
    } catch (error) {
      logger.error(`Error in run ${i + 1} for ${modelId}:`, error);
    }
  }
  
  // Calculate averages
  const avgTimeTaken = totalTimeTaken / config.runsPerTask;
  const successRate = successCount / config.runsPerTask;
  const avgQualityScore = totalQualityScore / config.runsPerTask;
  
  // Average the token usage
  tokenUsage.prompt = Math.round(tokenUsage.prompt / config.runsPerTask);
  tokenUsage.completion = Math.round(tokenUsage.completion / config.runsPerTask);
  tokenUsage.total = Math.round(tokenUsage.total / config.runsPerTask);
  
  return {
    timeTaken: avgTimeTaken,
    successRate,
    qualityScore: avgQualityScore,
    tokenUsage,
    output
  };
}

/**
 * Test a specific LM Studio model
 */
async function testLmStudioModel(modelId, task) {
  logger.info(`Testing LM Studio model: ${modelId} on task: ${task.taskId}`);
  
  try {
    const result = await benchmarkModule.benchmarkTask({
      ...task,
      localModel: modelId,
      // We're not testing against a paid model here
      skipPaidModel: true
    });
    
    logger.info(`Test completed for ${modelId} on ${task.taskId}`);
    logger.info(`Time taken: ${result.local.timeTaken}ms`);
    logger.info(`Success rate: ${result.local.successRate}`);
    logger.info(`Quality score: ${result.local.qualityScore}`);
    
    return {
      timeTaken: result.local.timeTaken,
      successRate: result.local.successRate,
      qualityScore: result.local.qualityScore,
      tokenUsage: result.local.tokenUsage,
      output: result.local.output
    };
  } catch (error) {
    logger.error(`Error testing model ${modelId} on ${task.taskId}:`, error);
    return null;
  }
}

/**
 * Test an OpenRouter model
 */
async function testOpenRouterModel(modelId, task) {
  logger.info(`Testing OpenRouter model: ${modelId} on task: ${task.taskId}`);
  
  try {
    const result = await runOpenRouterBenchmark(
      modelId,
      task.task,
      task.contextLength,
      task.expectedOutputLength,
      config.benchmark
    );
    
    logger.info(`Test completed for ${modelId} on ${task.taskId}`);
    logger.info(`Time taken: ${result.timeTaken}ms`);
    logger.info(`Success rate: ${result.successRate}`);
    logger.info(`Quality score: ${result.qualityScore}`);
    
    return result;
  } catch (error) {
    logger.error(`Error testing model ${modelId} on ${task.taskId}:`, error);
    return null;
  }
}

/**
 * Generate a markdown report from benchmark results
 */
async function generateMarkdownReport(results) {
  let markdown = `# Comprehensive Benchmark Results: Local LLMs vs OpenRouter Models\n\n`;
  markdown += `*Generated on: ${new Date().toISOString()}*\n\n`;
  
  markdown += `## Overview\n\n`;
  markdown += `This report compares the performance of local LM Studio models against various models available through OpenRouter for coding tasks.\n\n`;
  
  // Task descriptions
  markdown += `## Tasks\n\n`;
  benchmarkTasks.forEach(task => {
    markdown += `### ${task.taskId}\n\n`;
    markdown += `**Description:** ${task.task}\n\n`;
    markdown += `**Complexity:** ${task.complexity}\n\n`;
  });
  
  // Results by task
  for (const taskId of Object.keys(results)) {
    markdown += `## Results for ${taskId}\n\n`;
    
    // LM Studio models
    markdown += `### LM Studio Models\n\n`;
    markdown += `| Model | Time (ms) | Success Rate | Quality Score |\n`;
    markdown += `|-------|-----------|--------------|---------------|\n`;
    
    const lmStudioResults = results[taskId].lmStudio;
    for (const [modelId, result] of Object.entries(lmStudioResults)) {
      if (result) {
        markdown += `| ${modelId} | ${result.timeTaken.toFixed(0)} | ${result.successRate.toFixed(2)} | ${result.qualityScore.toFixed(2)} |\n`;
      }
    }
    
    markdown += `\n`;
    
    // OpenRouter models
    markdown += `### OpenRouter Models\n\n`;
    markdown += `| Model | Time (ms) | Success Rate | Quality Score |\n`;
    markdown += `|-------|-----------|--------------|---------------|\n`;
    
    const openRouterResults = results[taskId].openRouter;
    for (const [modelId, result] of Object.entries(openRouterResults)) {
      if (result) {
        markdown += `| ${modelId} | ${result.timeTaken.toFixed(0)} | ${result.successRate.toFixed(2)} | ${result.qualityScore.toFixed(2)} |\n`;
      }
    }
    
    markdown += `\n`;
    
    // Sample outputs
    markdown += `### Sample Outputs\n\n`;
    
    // LM Studio sample
    const lmStudioModels = Object.keys(lmStudioResults);
    if (lmStudioModels.length > 0) {
      const sampleModel = lmStudioModels[0];
      const sampleResult = lmStudioResults[sampleModel];
      
      if (sampleResult && sampleResult.output) {
        markdown += `#### LM Studio: ${sampleModel}\n\n`;
        markdown += "```\n";
        markdown += sampleResult.output.substring(0, 1000) + (sampleResult.output.length > 1000 ? "..." : "");
        markdown += "\n```\n\n";
      }
    }
    
    // OpenRouter sample
    const openRouterModelsWithResults = Object.keys(openRouterResults);
    if (openRouterModelsWithResults.length > 0) {
      const sampleModel = openRouterModelsWithResults[0];
      const sampleResult = openRouterResults[sampleModel];
      
      if (sampleResult && sampleResult.output) {
        markdown += `#### OpenRouter: ${sampleModel}\n\n`;
        markdown += "```\n";
        markdown += sampleResult.output.substring(0, 1000) + (sampleResult.output.length > 1000 ? "..." : "");
        markdown += "\n```\n\n";
      }
    }
  }
  
  // Recommendations
  markdown += `## Recommendations\n\n`;
  markdown += `Based on these benchmark results, the following recommendations can be made:\n\n`;
  markdown += `1. For simple coding tasks, consider using [best local model for simple tasks] as it provides the best balance of performance and quality.\n\n`;
  markdown += `2. For complex tasks where quality is critical, [best OpenRouter model for complex tasks] performs well.\n\n`;
  markdown += `3. When response time is the priority, [fastest model] offers significantly faster responses.\n\n`;
  markdown += `4. For cost-sensitive applications with high usage volume, using local LLMs can result in significant cost savings.\n\n`;
  
  // Save the report
  try {
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const filePath = `./comprehensive-benchmark-report-${timestamp}.md`;
    
    await fs.mkdir('./benchmark-results', { recursive: true });
    await fs.writeFile(filePath, markdown);
    
    logger.info(`Saved comprehensive benchmark report to ${filePath}`);
    return filePath;
  } catch (error) {
    logger.error('Error saving benchmark report:', error);
    return null;
  }
}

/**
 * Main function
 */
async function main() {
  logger.info('Starting comprehensive benchmark');
  
  // Check if OpenRouter API key is configured
  if (!config.openRouterApiKey || config.openRouterApiKey === 'your_openrouter_api_key_here') {
    logger.warn('OpenRouter API key is not configured. Only local models will be tested.');
  }
  
  // Get available LM Studio models
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
  
  // Initialize results structure
  const results = {};
  
  // Run benchmarks for each task
  for (const task of benchmarkTasks) {
    results[task.taskId] = {
      lmStudio: {},
      openRouter: {}
    };
    
    // Test LM Studio models
    for (const model of lmStudioModels) {
      const result = await testLmStudioModel(model.id, task);
      if (result) {
        results[task.taskId].lmStudio[model.id] = result;
      }
    }
    
    // Test OpenRouter models if API key is configured
    if (config.openRouterApiKey && config.openRouterApiKey !== 'your_openrouter_api_key_here') {
      for (const modelId of openRouterModels) {
        const result = await testOpenRouterModel(modelId, task);
        if (result) {
          results[task.taskId].openRouter[modelId] = result;
        }
      }
    }
  }
  
  // Save results
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const filePath = `./benchmark-results/comprehensive-results-${timestamp}.json`;
  
  await fs.mkdir('./benchmark-results', { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(results, null, 2));
  logger.info(`Results saved to ${filePath}`);
  
  // Generate report
  const reportPath = await generateMarkdownReport(results);
  if (reportPath) {
    logger.info(`Comprehensive benchmark report generated at: ${reportPath}`);
  }
}

// Run the main function
main().catch(error => {
  logger.error('Error running comprehensive benchmark:', error);
});