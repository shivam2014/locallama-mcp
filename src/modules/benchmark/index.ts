import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { config } from '../../config/index.js';
import { costMonitor } from '../cost-monitor/index.js';
import { openRouterModule } from '../openrouter/index.js';
import { logger } from '../../utils/logger.js';
import { 
  BenchmarkConfig, 
  BenchmarkResult, 
  BenchmarkSummary, 
  BenchmarkTaskParams,
  Model
} from '../../types/index.js';

/**
 * Default benchmark configuration
 */
const defaultConfig: BenchmarkConfig = {
  ...config.benchmark,
};

/**
 * Check if OpenRouter API key is configured
 */
function isOpenRouterConfigured(): boolean {
  return !!config.openRouterApiKey;
}

/**
 * Call LM Studio API
 */
async function callLmStudioApi(
  modelId: string,
  task: string,
  timeout: number
): Promise<{
  success: boolean;
  text?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
  };
}> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await axios.post(
      `${config.lmStudioEndpoint}/chat/completions`,
      {
        model: modelId,
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: task }
        ],
        temperature: 0.7,
        max_tokens: 1000,
      },
      {
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
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
    logger.error(`Error calling LM Studio API for model ${modelId}:`, error);
    return { success: false };
  }
}

/**
 * Call Ollama API
 */
async function callOllamaApi(
  modelId: string,
  task: string,
  timeout: number
): Promise<{
  success: boolean;
  text?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
  };
}> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await axios.post(
      `${config.ollamaEndpoint}/chat`,
      {
        model: modelId,
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: task }
        ],
        stream: false,
      },
      {
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
    
    clearTimeout(timeoutId);
    
    if (response.status === 200 && response.data.message) {
      // Ollama doesn't provide token counts directly, so we estimate
      const promptTokens = Math.ceil(task.length / 4);
      const completionTokens = Math.ceil(response.data.message.content.length / 4);
      
      return {
        success: true,
        text: response.data.message.content,
        usage: {
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
        },
      };
    } else {
      return { success: false };
    }
  } catch (error) {
    logger.error(`Error calling Ollama API for model ${modelId}:`, error);
    return { success: false };
  }
}

/**
 * Call OpenRouter API
 */
async function callOpenRouterApi(
  modelId: string,
  task: string,
  timeout: number
): Promise<{
  success: boolean;
  text?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
  };
}> {
  try {
    // Check if API key is configured
    if (!isOpenRouterConfigured()) {
      logger.warn('OpenRouter API key not configured, cannot call OpenRouter API');
      return { success: false };
    }
    
    // Call the OpenRouter API
    const result = await openRouterModule.callOpenRouterApi(modelId, task, timeout);
    
    return {
      success: result.success,
      text: result.text,
      usage: result.usage,
    };
  } catch (error) {
    logger.error(`Error calling OpenRouter API for model ${modelId}:`, error);
    return { success: false };
  }
}

/**
 * Benchmark prompting strategies for OpenRouter models
 */
async function benchmarkPromptingStrategies(
  modelId: string,
  task: string,
  timeout: number
): Promise<{
  success: boolean;
  text?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
  };
  qualityScore?: number;
}> {
  try {
    // Check if API key is configured
    if (!isOpenRouterConfigured()) {
      logger.warn('OpenRouter API key not configured, cannot benchmark prompting strategies');
      return { success: false };
    }
    
    // Benchmark prompting strategies
    const result = await openRouterModule.benchmarkPromptingStrategies(modelId, task, timeout);
    
    if (result.success && result.text) {
      const qualityScore = evaluateQuality(task, result.text);
      
      return {
        success: true,
        text: result.text,
        usage: result.usage,
        qualityScore,
      };
    } else {
      return { success: false };
    }
  } catch (error) {
    logger.error(`Error benchmarking prompting strategies for model ${modelId}:`, error);
    return { success: false };
  }
}

/**
 * Simulate OpenAI API (for testing)
 */
async function simulateOpenAiApi(
  task: string,
  timeout: number
): Promise<{
  success: boolean;
  text?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
  };
}> {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
  
  // Simulate success rate
  const success = Math.random() > 0.1; // 90% success rate
  
  if (success) {
    // Estimate token counts
    const promptTokens = Math.ceil(task.length / 4);
    const completionTokens = Math.ceil(promptTokens * 0.8); // Simulate response length
    
    return {
      success: true,
      text: `Simulated response for: ${task.substring(0, 50)}...`,
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
      },
    };
  } else {
    return { success: false };
  }
}

/**
 * Simulate generic API (for testing)
 */
async function simulateGenericApi(
  task: string,
  timeout: number
): Promise<{
  success: boolean;
  text?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
  };
}> {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, Math.random() * 1500 + 1000));
  
  // Simulate success rate
  const success = Math.random() > 0.2; // 80% success rate
  
  if (success) {
    // Estimate token counts
    const promptTokens = Math.ceil(task.length / 4);
    const completionTokens = Math.ceil(promptTokens * 0.7); // Simulate response length
    
    return {
      success: true,
      text: `Simulated generic API response for: ${task.substring(0, 50)}...`,
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
      },
    };
  } else {
    return { success: false };
  }
}

/**
 * Evaluate the quality of a response
 */
function evaluateQuality(task: string, response: string): number {
  // This is a placeholder implementation
  // In a real implementation, this would use a more sophisticated evaluation method
  
  // Simple heuristics for quality evaluation:
  // 1. Response length relative to task length
  const lengthScore = Math.min(1, response.length / (task.length * 0.8));
  
  // 2. Response contains code if task asks for code
  const codeScore = task.toLowerCase().includes('code') && response.includes('```') ? 1 : 0.5;
  
  // 3. Response structure (paragraphs, bullet points, etc.)
  const structureScore = (
    response.includes('\n\n') || 
    response.includes('- ') || 
    response.includes('1. ')
  ) ? 1 : 0.7;
  
  // Combine scores with weights
  return (lengthScore * 0.4) + (codeScore * 0.3) + (structureScore * 0.3);
}

/**
 * Save a benchmark result to disk
 */
async function saveResult(result: BenchmarkResult, resultsPath: string): Promise<void> {
  try {
    // Create results directory if it doesn't exist
    await fs.mkdir(resultsPath, { recursive: true });
    
    // Create a filename based on the task ID and timestamp
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const filename = `${result.taskId}-${timestamp}.json`;
    const filePath = path.join(resultsPath, filename);
    
    // Write the result to disk
    await fs.writeFile(filePath, JSON.stringify(result, null, 2));
    
    logger.info(`Saved benchmark result to ${filePath}`);
  } catch (error) {
    logger.error('Error saving benchmark result:', error);
  }
}

/**
 * Save a benchmark summary to disk
 */
async function saveSummary(summary: BenchmarkSummary, resultsPath: string): Promise<void> {
  try {
    // Create results directory if it doesn't exist
    await fs.mkdir(resultsPath, { recursive: true });
    
    // Create a filename based on the timestamp
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const filename = `summary-${timestamp}.json`;
    const filePath = path.join(resultsPath, filename);
    
    // Write the summary to disk
    await fs.writeFile(filePath, JSON.stringify(summary, null, 2));
    
    logger.info(`Saved benchmark summary to ${filePath}`);
  } catch (error) {
    logger.error('Error saving benchmark summary:', error);
  }
}

/**
 * Run a benchmark for a specific model
 */
async function runModelBenchmark(
  type: 'local' | 'paid',
  model: Model,
  task: string,
  contextLength: number,
  expectedOutputLength: number,
  config: BenchmarkConfig
): Promise<{
  timeTaken: number;
  successRate: number;
  qualityScore: number;
  tokenUsage: {
    prompt: number;
    completion: number;
    total: number;
  };
  output?: string;
}> {
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
      logger.debug(`Run ${i + 1}/${config.runsPerTask} for ${model.id}`);
      
      // Measure response time
      const startTime = Date.now();
      
      // Call the appropriate API based on model provider
      let response;
      let success = false;
      let qualityScore = 0;
      let promptTokens = 0;
      let completionTokens = 0;
      
      if (model.provider === 'lm-studio') {
        // Call LM Studio API
        response = await callLmStudioApi(model.id, task, config.taskTimeout);
        success = response.success;
        qualityScore = evaluateQuality(task, response.text || '');
        promptTokens = response.usage?.prompt_tokens || contextLength;
        completionTokens = response.usage?.completion_tokens || expectedOutputLength;
        if (success) {
          output = response.text || '';
        }
      } else if (model.provider === 'ollama') {
        // Call Ollama API
        response = await callOllamaApi(model.id, task, config.taskTimeout);
        success = response.success;
        qualityScore = evaluateQuality(task, response.text || '');
        promptTokens = response.usage?.prompt_tokens || contextLength;
        completionTokens = response.usage?.completion_tokens || expectedOutputLength;
        if (success) {
          output = response.text || '';
        }
      } else if (model.provider === 'openrouter') {
        // For OpenRouter models, we need to check if it's the first run
        // If it is, we'll benchmark prompting strategies to find the best one
        if (i === 0) {
          // Benchmark prompting strategies
          const benchmarkResult = await benchmarkPromptingStrategies(model.id, task, config.taskTimeout);
          success = benchmarkResult.success;
          qualityScore = benchmarkResult.qualityScore || 0;
          promptTokens = benchmarkResult.usage?.prompt_tokens || contextLength;
          completionTokens = benchmarkResult.usage?.completion_tokens || expectedOutputLength;
          if (success) {
            output = benchmarkResult.text || '';
          }
        } else {
          // For subsequent runs, use the best prompting strategy
          response = await callOpenRouterApi(model.id, task, config.taskTimeout);
          success = response.success;
          qualityScore = evaluateQuality(task, response.text || '');
          promptTokens = response.usage?.prompt_tokens || contextLength;
          completionTokens = response.usage?.completion_tokens || expectedOutputLength;
          if (success) {
            output = response.text || '';
          }
        }
      } else if (model.provider === 'openai') {
        // Call OpenAI API (simulated for now)
        response = await simulateOpenAiApi(task, config.taskTimeout);
        success = response.success;
        qualityScore = evaluateQuality(task, response.text || '');
        promptTokens = response.usage?.prompt_tokens || contextLength;
        completionTokens = response.usage?.completion_tokens || expectedOutputLength;
        if (success) {
          output = response.text || '';
        }
      } else {
        // Simulate other APIs
        response = await simulateGenericApi(task, config.taskTimeout);
        success = response.success;
        qualityScore = evaluateQuality(task, response.text || '');
        promptTokens = contextLength;
        completionTokens = expectedOutputLength;
        if (success) {
          output = response.text || '';
        }
      }
      
      const endTime = Date.now();
      const timeTaken = endTime - startTime;
      
      // Update results
      totalTimeTaken += timeTaken;
      if (success) {
        successCount++;
      }
      totalQualityScore += qualityScore;
      tokenUsage.prompt += promptTokens;
      tokenUsage.completion += completionTokens;
      tokenUsage.total += promptTokens + completionTokens;
      
    } catch (error) {
      logger.error(`Error in run ${i + 1} for ${model.id}:`, error);
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
 * Generate a summary from benchmark results
 */
function generateSummary(results: BenchmarkResult[]): BenchmarkSummary {
  if (results.length === 0) {
    throw new Error('No benchmark results to summarize');
  }
  
  // Initialize summary
  const summary: BenchmarkSummary = {
    taskCount: results.length,
    avgContextLength: 0,
    avgOutputLength: 0,
    avgComplexity: 0,
    local: {
      avgTimeTaken: 0,
      avgSuccessRate: 0,
      avgQualityScore: 0,
      totalTokenUsage: {
        prompt: 0,
        completion: 0,
        total: 0,
      },
    },
    paid: {
      avgTimeTaken: 0,
      avgSuccessRate: 0,
      avgQualityScore: 0,
      totalTokenUsage: {
        prompt: 0,
        completion: 0,
        total: 0,
      },
      totalCost: 0,
    },
    comparison: {
      timeRatio: 0,
      successRateDiff: 0,
      qualityScoreDiff: 0,
      costSavings: 0,
    },
    timestamp: new Date().toISOString(),
  };
  
  // Calculate averages and totals
  let totalContextLength = 0;
  let totalOutputLength = 0;
  let totalComplexity = 0;
  
  let totalLocalTimeTaken = 0;
  let totalLocalSuccessRate = 0;
  let totalLocalQualityScore = 0;
  
  let totalPaidTimeTaken = 0;
  let totalPaidSuccessRate = 0;
  let totalPaidQualityScore = 0;
  
  for (const result of results) {
    totalContextLength += result.contextLength;
    totalOutputLength += result.outputLength;
    totalComplexity += result.complexity;
    
    totalLocalTimeTaken += result.local.timeTaken;
    totalLocalSuccessRate += result.local.successRate;
    totalLocalQualityScore += result.local.qualityScore;
    
    summary.local.totalTokenUsage.prompt += result.local.tokenUsage.prompt;
    summary.local.totalTokenUsage.completion += result.local.tokenUsage.completion;
    summary.local.totalTokenUsage.total += result.local.tokenUsage.total;
    
    totalPaidTimeTaken += result.paid.timeTaken;
    totalPaidSuccessRate += result.paid.successRate;
    totalPaidQualityScore += result.paid.qualityScore;
    
    summary.paid.totalTokenUsage.prompt += result.paid.tokenUsage.prompt;
    summary.paid.totalTokenUsage.completion += result.paid.tokenUsage.completion;
    summary.paid.totalTokenUsage.total += result.paid.tokenUsage.total;
    
    summary.paid.totalCost += result.paid.cost;
  }
  
  // Calculate averages
  summary.avgContextLength = totalContextLength / results.length;
  summary.avgOutputLength = totalOutputLength / results.length;
  summary.avgComplexity = totalComplexity / results.length;
  
  summary.local.avgTimeTaken = totalLocalTimeTaken / results.length;
  summary.local.avgSuccessRate = totalLocalSuccessRate / results.length;
  summary.local.avgQualityScore = totalLocalQualityScore / results.length;
  
  summary.paid.avgTimeTaken = totalPaidTimeTaken / results.length;
  summary.paid.avgSuccessRate = totalPaidSuccessRate / results.length;
  summary.paid.avgQualityScore = totalPaidQualityScore / results.length;
  
  // Calculate comparisons
  summary.comparison.timeRatio = summary.local.avgTimeTaken / summary.paid.avgTimeTaken;
  summary.comparison.successRateDiff = summary.local.avgSuccessRate - summary.paid.avgSuccessRate;
  summary.comparison.qualityScoreDiff = summary.local.avgQualityScore - summary.paid.avgQualityScore;
  summary.comparison.costSavings = summary.paid.totalCost;
  
  return summary;
}

/**
 * Run a benchmark for a single task
 */
async function benchmarkTask(
  params: BenchmarkTaskParams & { skipPaidModel?: boolean },
  config: BenchmarkConfig = defaultConfig
): Promise<BenchmarkResult> {
  const { taskId, task, contextLength, expectedOutputLength, complexity, skipPaidModel } = params;
  
  logger.info(`Benchmarking task ${taskId}: ${task.substring(0, 50)}...`);
  
  // Get available models
  const availableModels = await costMonitor.getAvailableModels();
  
  // Determine which models to use
  const localModel = params.localModel 
    ? availableModels.find(m => m.id === params.localModel && (m.provider === 'local' || m.provider === 'lm-studio' || m.provider === 'ollama'))
    : availableModels.find(m => m.provider === 'local' || m.provider === 'lm-studio' || m.provider === 'ollama');
  
  // For paid model, check if we should use a free model from OpenRouter
  let paidModel: Model | undefined;
  
  if (params.paidModel) {
    // If a specific paid model is requested, use it
    paidModel = availableModels.find(m => m.id === params.paidModel && m.provider !== 'local' && m.provider !== 'lm-studio' && m.provider !== 'ollama');
  } else {
    // Check if OpenRouter API key is configured and free models are available
    if (isOpenRouterConfigured()) {
      try {
        // Initialize OpenRouter module if needed
        if (Object.keys(openRouterModule.modelTracking.models).length === 0) {
          await openRouterModule.initialize();
        }
        
        // Get free models
        const freeModels = await costMonitor.getFreeModels();
        
        if (freeModels.length > 0) {
          // Find the best free model for this task
          const bestFreeModel = freeModels.find(m => {
            // Check if the model can handle the context length
            return m.contextWindow && m.contextWindow >= (contextLength + expectedOutputLength);
          });
          
          if (bestFreeModel) {
            paidModel = bestFreeModel;
            logger.info(`Using free model ${bestFreeModel.id} from OpenRouter`);
          }
        }
      } catch (error) {
        logger.error('Error getting free models from OpenRouter:', error);
      }
    }
    
    // If no free model is available or suitable, use the default paid model
    if (!paidModel) {
      paidModel = { 
        id: 'gpt-3.5-turbo', 
        name: 'GPT-3.5 Turbo', 
        provider: 'openai', 
        capabilities: { chat: true, completion: true }, 
        costPerToken: { prompt: 0.000001, completion: 0.000002 } 
      };
    }
  }
  
  if (!localModel) {
    throw new Error('No local model available for benchmarking');
  }
  
  // Initialize result
  const result: BenchmarkResult = {
    taskId,
    task,
    contextLength,
    outputLength: 0, // Will be updated after benchmarking
    complexity,
    local: {
      model: localModel.id,
      timeTaken: 0,
      successRate: 0,
      qualityScore: 0,
      tokenUsage: {
        prompt: 0,
        completion: 0,
        total: 0,
      },
      output: '',
    },
    paid: {
      model: paidModel?.id || 'gpt-3.5-turbo',
      timeTaken: 0,
      successRate: 0,
      qualityScore: 0,
      tokenUsage: {
        prompt: 0,
        completion: 0,
        total: 0,
      },
      cost: 0,
      output: '',
    },
    timestamp: new Date().toISOString(),
  };
  
  // Run benchmark for local model
  logger.info(`Benchmarking local model: ${localModel.id}`);
  const localResults = await runModelBenchmark(
    'local',
    localModel,
    task,
    contextLength,
    expectedOutputLength,
    config
  );
  
  result.local.timeTaken = localResults.timeTaken;
  result.local.successRate = localResults.successRate;
  result.local.qualityScore = localResults.qualityScore;
  result.local.tokenUsage = localResults.tokenUsage;
  result.local.output = localResults.output || '';
  result.outputLength = localResults.tokenUsage.completion;
  
  // Run benchmark for paid model if available and not skipped
  if (paidModel && !skipPaidModel) {
    logger.info(`Benchmarking paid model: ${paidModel.id}`);
    const paidResults = await runModelBenchmark(
      'paid',
      paidModel,
      task,
      contextLength,
      expectedOutputLength,
      config
    );
    
    result.paid.timeTaken = paidResults.timeTaken;
    result.paid.successRate = paidResults.successRate;
    result.paid.qualityScore = paidResults.qualityScore;
    result.paid.tokenUsage = paidResults.tokenUsage;
    result.paid.output = paidResults.output || '';
    result.paid.cost = paidResults.tokenUsage.prompt * (paidModel.costPerToken?.prompt || 0) + 
                       paidResults.tokenUsage.completion * (paidModel.costPerToken?.completion || 0);
    
    // Use the paid model's output length if it's available
    if (paidResults.tokenUsage.completion > 0) {
      result.outputLength = paidResults.tokenUsage.completion;
    }
  }
  
  // Save result if configured
  if (config.saveResults) {
    await saveResult(result, config.resultsPath);
  }
  
  return result;
}

/**
 * Run a benchmark for multiple tasks
 */
async function benchmarkTasks(
  tasks: BenchmarkTaskParams[],
  config: BenchmarkConfig = defaultConfig
): Promise<BenchmarkSummary> {
  logger.info(`Benchmarking ${tasks.length} tasks`);
  
  // Run tasks sequentially or in parallel
  let results: BenchmarkResult[] = [];
  
  if (config.parallel) {
    // Run tasks in parallel with a limit on concurrency
    const chunks = [];
    for (let i = 0; i < tasks.length; i += config.maxParallelTasks) {
      chunks.push(tasks.slice(i, i + config.maxParallelTasks));
    }
    
    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map(task => benchmarkTask(task, config))
      );
      results.push(...chunkResults);
    }
  } else {
    // Run tasks sequentially
    for (const task of tasks) {
      const result = await benchmarkTask(task, config);
      results.push(result);
    }
  }
  
  // Generate summary
  const summary = generateSummary(results);
  
  // Save summary if configured
  if (config.saveResults) {
    await saveSummary(summary, config.resultsPath);
  }
  
  return summary;
}

/**
 * Benchmark free models from OpenRouter
 */
async function benchmarkFreeModels(
  tasks: BenchmarkTaskParams[],
  config: BenchmarkConfig = defaultConfig
): Promise<BenchmarkSummary> {
  logger.info('Benchmarking free models from OpenRouter');
  
  // Check if OpenRouter API key is configured
  if (!isOpenRouterConfigured()) {
    throw new Error('OpenRouter API key not configured, cannot benchmark free models');
  }
  
  // Initialize OpenRouter module if needed
  if (Object.keys(openRouterModule.modelTracking.models).length === 0) {
    await openRouterModule.initialize();
  }
  
  // Get free models
  const freeModels = await costMonitor.getFreeModels();
  
  if (freeModels.length === 0) {
    throw new Error('No free models available from OpenRouter');
  }
  
  logger.info(`Found ${freeModels.length} free models from OpenRouter`);
  
  // Run benchmarks for each free model
  const results: BenchmarkResult[] = [];
  
  for (const freeModel of freeModels) {
    logger.info(`Benchmarking free model: ${freeModel.id}`);
    
    for (const task of tasks) {
      // Create a copy of the task with the free model as the paid model
      const taskWithFreeModel: BenchmarkTaskParams = {
        ...task,
        paidModel: freeModel.id,
      };
      
      // Run the benchmark
      const result = await benchmarkTask(taskWithFreeModel, config);
      results.push(result);
    }
  }
  
  // Generate summary
  const summary = generateSummary(results);
  
  // Save summary if configured
  if (config.saveResults) {
    // Create a special filename for free models
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const filename = `free-models-summary-${timestamp}.json`;
    const filePath = path.join(config.resultsPath, filename);
    
    // Write the summary to disk
    await fs.writeFile(filePath, JSON.stringify(summary, null, 2));
    
    logger.info(`Saved free models benchmark summary to ${filePath}`);
  }
  
  return summary;
}

/**
 * Benchmark Module
 * 
 * This module is responsible for benchmarking the performance of local LLMs vs paid APIs.
 * It measures:
 * - Response time
 * - Success rate
 * - Output quality
 * - Token usage
 * - Cost
 */
export const benchmarkModule = {
  defaultConfig,
  benchmarkTask,
  benchmarkTasks,
  benchmarkFreeModels,
  runModelBenchmark,
  callLmStudioApi,
  callOllamaApi,
  callOpenRouterApi,
  simulateOpenAiApi,
  simulateGenericApi,
  evaluateQuality,
  generateSummary,
  saveResult,
  saveSummary,
};