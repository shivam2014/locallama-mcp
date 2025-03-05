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
  // If the response is empty or only whitespace, return 0
  if (!response || response.trim().length === 0) {
    return 0;
  }

  // 1. Relevance - analyze if the response addresses the task
  const relevanceScore = calculateRelevanceScore(task, response);
  
  // 2. Completeness - analyze if the response is comprehensive
  const completenessScore = calculateCompletenessScore(task, response);
  
  // 3. Structure - analyze the formatting and structure of the response
  const structureScore = calculateStructureScore(task, response);
  
  // 4. Accuracy - analyze specific elements for accuracy
  const accuracyScore = calculateAccuracyScore(task, response);
  
  // 5. Content quality - analyze the quality of the content
  const contentQualityScore = calculateContentQualityScore(task, response);
  
  // Weight the scores according to their importance
  // Weights should add up to 1.0
  const weightedScore = 
    relevanceScore * 0.3 +
    completenessScore * 0.25 +
    structureScore * 0.15 +
    accuracyScore * 0.2 +
    contentQualityScore * 0.1;
  
  // Return normalized score between 0 and 1
  return Math.min(Math.max(weightedScore, 0), 1);
}

/**
 * Calculate how relevant the response is to the task
 */
function calculateRelevanceScore(task: string, response: string): number {
  // Convert to lowercase for case-insensitive matching
  const taskLower = task.toLowerCase();
  const responseLower = response.toLowerCase();

  // Extract key terms from the task
  const keyTerms = extractKeyTerms(taskLower);
  
  // Count how many key terms appear in the response
  let matchedTerms = 0;
  for (const term of keyTerms) {
    if (responseLower.includes(term)) {
      matchedTerms++;
    }
  }
  
  // Calculate relevance as the ratio of matched terms to total terms
  const termMatchRatio = keyTerms.length > 0 ? matchedTerms / keyTerms.length : 0;
  
  // Check if the response directly addresses the task
  let directAddressingScore = 0;
  
  // Check for question-answer patterns
  if (taskLower.includes('?')) {
    // If task is a question, check if response provides an answer
    if (responseLower.includes('yes') || 
        responseLower.includes('no') || 
        responseLower.includes('the answer is') ||
        responseLower.includes('to answer your question')) {
      directAddressingScore = 0.8;
    }
  }
  
  // Check for command-execution patterns
  if (taskLower.includes('explain') || 
      taskLower.includes('describe') || 
      taskLower.includes('list') ||
      taskLower.includes('provide')) {
    
    // Check if the response follows the command
    if (responseLower.includes('here is') || 
        responseLower.includes('below is') || 
        responseLower.includes('following is')) {
      directAddressingScore = 0.9;
    }
  }
  
  return Math.max(termMatchRatio * 0.7 + directAddressingScore * 0.3, 0.1);
}

/**
 * Calculate how comprehensive the response is
 */
function calculateCompletenessScore(task: string, response: string): number {
  // Calculate completeness based on response length relative to task complexity
  const taskLower = task.toLowerCase();
  const responseLower = response.toLowerCase();
  
  // Estimate task complexity by length and question type markers
  let taskComplexity = Math.min(task.length / 300, 1); // Normalize based on length
  
  // Check for multiple questions or aspects to address
  const questionCount = (taskLower.match(/\?/g) || []).length;
  if (questionCount > 1) {
    taskComplexity += 0.2 * Math.min(questionCount, 5);
  }
  
  // Check for comprehensive request markers
  if (taskLower.includes('detailed') || 
      taskLower.includes('thorough') || 
      taskLower.includes('comprehensive') ||
      taskLower.includes('explain') ||
      taskLower.includes('elaborate')) {
    taskComplexity += 0.3;
  }
  
  // Check for specific list requests
  if (taskLower.includes('list') || 
      taskLower.includes('enumerate') || 
      taskLower.includes('steps')) {
    taskComplexity += 0.2;
  }
  
  // Calculate the expected response length based on task complexity
  const expectedMinLength = 100 + (taskComplexity * 500);
  
  // Compare actual response length to expected length
  const lengthScore = Math.min(response.length / expectedMinLength, 1.5);
  
  // Check for addressing multiple aspects
  const paragraphCount = (response.match(/\n\s*\n/g) || []).length + 1;
  const sectionScore = Math.min(paragraphCount / Math.max(questionCount, 1), 1.5);
  
  // Calculate completeness score
  const rawScore = (lengthScore * 0.6) + (sectionScore * 0.4);
  
  // Cap at 1.0 but allow minimum score based on length
  return Math.min(Math.max(rawScore, response.length / 1000), 1);
}

/**
 * Calculate how well-structured the response is
 */
function calculateStructureScore(task: string, response: string): number {
  let structureScore = 0.5; // Default middle score
  
  // Check for paragraphs
  const paragraphs = response.split(/\n\s*\n/);
  if (paragraphs.length > 1) {
    structureScore += 0.1;
  }
  
  // Check for headings or sections
  const hasHeadings = /^#+\s.+|^[A-Z][A-Za-z\s]+:$/m.test(response);
  if (hasHeadings) {
    structureScore += 0.1;
  }
  
  // Check for bullet points or numbered lists
  const hasBullets = /^[\s-*•]|\d+\.\s/m.test(response);
  if (hasBullets) {
    structureScore += 0.1;
  }
  
  // Check for code blocks when needed
  const taskNeedsCode = /code|function|program|script|implement/i.test(task);
  const hasCodeBlocks = /```[\s\S]+?```|`[^`]+`/.test(response);
  
  if (taskNeedsCode && hasCodeBlocks) {
    structureScore += 0.2;
  } else if (taskNeedsCode && !hasCodeBlocks) {
    structureScore -= 0.3; // Penalize for missing code when requested
  }
  
  // Check for proper citation or reference if needed
  const needsCitation = /reference|cite|source|according to|research/i.test(task);
  const hasCitation = /according to|cited by|referenced in|\[\d+\]|[(\d+)]/i.test(response);
  
  if (needsCitation && hasCitation) {
    structureScore += 0.1;
  }
  
  // Normalize score between 0 and 1
  return Math.min(Math.max(structureScore, 0), 1);
}

/**
 * Calculate accuracy of specific elements in the response
 */
function calculateAccuracyScore(task: string, response: string): number {
  // This is a complex metric that ideally would use embedding models
  // Here we'll implement a heuristic version
  
  let accuracyScore = 0.7; // Start with a reasonable default
  
  // Check for factual statements and hedging language
  const factualStatementsCount = (response.match(/is|are|was|were|will be|has been|have been/g) || []).length;
  const hedgingLanguageCount = (response.match(/might|maybe|perhaps|possibly|could|seems|appears|likely|unlikely|probably/g) || []).length;
  
  // If there are many factual statements with little hedging, it's either very accurate or overconfident
  if (factualStatementsCount > 10 && hedgingLanguageCount < 2) {
    // Could be overconfident, slightly reduce score
    accuracyScore -= 0.1;
  }
  
  // Check for self-contradictions
  if (response.includes("however") || response.includes("on the other hand") || response.includes("but ")) {
    // The presence of contrast markers is good for nuanced answers
    accuracyScore += 0.05;
  }
  
  // Check for error admissions or limitations
  if (response.toLowerCase().includes("i'm not sure") || 
      response.toLowerCase().includes("i don't know") || 
      response.toLowerCase().includes("it's important to note") || 
      response.toLowerCase().includes("limitation")) {
    // Honesty about limitations is good
    accuracyScore += 0.1;
  }
  
  // Check for specific technical accuracy indicators in code
  if (/```[\s\S]+?```/.test(response)) {
    const codeBlocks = response.match(/```[\s\S]+?```/g) || [];
    let codeScore = 0;
    
    for (const codeBlock of codeBlocks) {
      const code = codeBlock.replace(/```[\w]*\n/, '').replace(/```$/, '');
      
      // Check for basic syntax errors
      const unbalancedBraces = (code.match(/{/g) || []).length !== (code.match(/}/g) || []).length;
      const unbalancedParentheses = (code.match(/\(/g) || []).length !== (code.match(/\)/g) || []).length;
      const unbalancedBrackets = (code.match(/\[/g) || []).length !== (code.match(/\]/g) || []).length;
      
      if (unbalancedBraces || unbalancedParentheses || unbalancedBrackets) {
        codeScore -= 0.1;
      } else {
        codeScore += 0.1;
      }
      
      // Check for common patterns in good code
      if (code.includes("return ") || code.includes("function ")) {
        codeScore += 0.05;
      }
      
      // Check for error handling
      if (code.includes("try ") && code.includes("catch ")) {
        codeScore += 0.05;
      }
    }
    
    // Adjust accuracy score based on code quality
    accuracyScore += Math.min(Math.max(codeScore, -0.2), 0.2);
  }
  
  // Normalize score between 0 and 1
  return Math.min(Math.max(accuracyScore, 0), 1);
}

/**
 * Calculate the general quality of the content
 */
function calculateContentQualityScore(task: string, response: string): number {
  let qualityScore = 0.6; // Start with a middle-range default
  
  // Check for overly generic or template-like responses
  const genericPhrases = [
    "i'd be happy to help",
    "i hope this helps",
    "let me know if you have any questions",
    "as an ai language model",
    "as requested"
  ];
  
  let genericCount = 0;
  for (const phrase of genericPhrases) {
    if (response.toLowerCase().includes(phrase)) {
      genericCount++;
    }
  }
  
  // Penalize for too many generic phrases
  qualityScore -= genericCount * 0.05;
  
  // Check for response variety
  const sentences = response.split(/[.!?]+\s+/);
  const uniqueSentenceStarts = new Set();
  
  for (const sentence of sentences) {
    if (sentence.length > 5) {
      const firstThreeWords = sentence.trim().split(/\s+/).slice(0, 3).join(' ').toLowerCase();
      uniqueSentenceStarts.add(firstThreeWords);
    }
  }
  
  // Reward for variety in sentence structure
  const sentenceVarietyRatio = sentences.length > 0 ? uniqueSentenceStarts.size / sentences.length : 0;
  qualityScore += sentenceVarietyRatio * 0.2;
  
  // Check for technical jargon when appropriate
  const technicalTask = /technical|code|program|algorithm|function|system|framework|architecture/i.test(task);
  const containsTechnicalTerms = /function|algorithm|method|framework|architecture|system|module|component|parameter/i.test(response);
  
  if (technicalTask && containsTechnicalTerms) {
    qualityScore += 0.1;
  } else if (technicalTask && !containsTechnicalTerms) {
    qualityScore -= 0.1;
  }
  
  // Check for informational density (ratio of non-stop words to total words)
  const words = response.split(/\s+/);
  const stopWords = ['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'from', 'by'];
  let nonStopWordCount = 0;
  
  for (const word of words) {
    if (!stopWords.includes(word.toLowerCase())) {
      nonStopWordCount++;
    }
  }
  
  const informationalDensity = words.length > 0 ? nonStopWordCount / words.length : 0;
  qualityScore += (informationalDensity - 0.7) * 0.2; // Adjust based on difference from expected density
  
  // Normalize score between 0 and 1
  return Math.min(Math.max(qualityScore, 0), 1);
}

/**
 * Extract key terms from the task for relevance matching
 */
function extractKeyTerms(task: string): string[] {
  // Remove common stop words
  const stopWords = ['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'from', 'by', 
                    'is', 'are', 'am', 'was', 'were', 'be', 'being', 'been',
                    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall', 'should',
                    'can', 'could', 'may', 'might', 'must', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
                    'who', 'what', 'where', 'when', 'why', 'how', 'which', 'me', 'him', 'her', 'them', 'us'];
  
  // Split into words and filter out stop words and short words
  const words = task.split(/\W+/).filter(word => 
    word.length > 2 && !stopWords.includes(word.toLowerCase())
  );
  
  // Extract unique key terms
  const keyTerms = Array.from(new Set(words));
  
  // Add specific phrases if they exist in the task
  const phrases = [
    'machine learning',
    'deep learning',
    'artificial intelligence',
    'natural language processing',
    'data science',
    'neural network',
    'computer vision',
    'reinforcement learning',
    'software engineering',
    'web development',
    'mobile app',
    'front end',
    'back end',
    'database',
    'full stack'
  ];
  
  for (const phrase of phrases) {
    if (task.toLowerCase().includes(phrase)) {
      keyTerms.push(phrase);
    }
  }
  
  return keyTerms;
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