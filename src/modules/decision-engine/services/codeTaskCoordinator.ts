import { logger } from '../../../utils/logger.js';
import { codeTaskAnalyzer } from './codeTaskAnalyzer.js';
import { dependencyMapper } from './dependencyMapper.js';
import { codeModelSelector } from './codeModelSelector.js';
import { openRouterModule } from '../../openrouter/index.js';
import { costMonitor } from '../../cost-monitor/index.js';
import { CodeTaskAnalysisOptions, DecomposedCodeTask, CodeSubtask } from '../types/codeTask.js';
import { Model } from '../../../types/index.js';

/**
 * Coordinates the entire code task analysis flow
 * This is the main entry point for code task decomposition and model selection
 */
export const codeTaskCoordinator = {
  /**
   * Process a coding task from start to finish
   * 
   * @param task The coding task to process
   * @param options Options for task analysis
   * @returns Results including decomposed task, model assignments, and execution plan
   */
  async processCodeTask(
    task: string,
    options: CodeTaskAnalysisOptions = {}
  ): Promise<{
    decomposedTask: DecomposedCodeTask;
    modelAssignments: Map<string, Model>;
    executionOrder: CodeSubtask[];
    criticalPath: CodeSubtask[];
    dependencyVisualization: string;
    estimatedCost: number;
  }> {
    logger.info('Processing code task:', task);
    
    try {
      // Step 1: Decompose the task into subtasks
      const decomposedTask = await codeTaskAnalyzer.decompose(task, options);
      logger.info(`Decomposed task into ${decomposedTask.subtasks.length} subtasks`);
      
      // Step 2: Resolve any circular dependencies
      const resolvedTask = dependencyMapper.resolveCircularDependencies(decomposedTask);
      
      // Step 3: Determine execution order
      const executionOrder = dependencyMapper.sortByExecutionOrder(resolvedTask);
      
      // Step 4: Find the critical path
      const criticalPath = dependencyMapper.findCriticalPath(resolvedTask);
      
      // Step 5: Generate dependency visualization
      const dependencyVisualization = dependencyMapper.visualizeDependencies(resolvedTask);
      
      // Step 6: Select models for each subtask
      const useResourceEfficient = options.granularity === 'coarse';
      const modelAssignments = await codeModelSelector.selectModelsForSubtasks(
        resolvedTask.subtasks,
        useResourceEfficient
      );
      
      // Step 7: Calculate estimated cost
      const estimatedCost = await this.calculateEstimatedCost(
        resolvedTask.subtasks,
        modelAssignments
      );
      
      return {
        decomposedTask: resolvedTask,
        modelAssignments,
        executionOrder,
        criticalPath,
        dependencyVisualization,
        estimatedCost
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to process code task: ${error.message}`);
      }
      throw new Error('Failed to process code task: Unknown error');
    }
  },
  
  /**
   * Calculate the estimated cost of processing all subtasks
   * 
   * @param subtasks The subtasks to process
   * @param modelAssignments The assigned models for each subtask
   * @returns Estimated cost in USD
   */
  async calculateEstimatedCost(
    subtasks: CodeSubtask[],
    modelAssignments: Map<string, Model>
  ): Promise<number> {
    let totalCost = 0;
    
    for (const subtask of subtasks) {
      const model = modelAssignments.get(subtask.id);
      if (!model) continue;
      
      // Get cost estimate for this subtask
      const estimate = await costMonitor.estimateCost({
        contextLength: Math.round(subtask.estimatedTokens * 0.7), // Approximate input tokens
        outputLength: Math.round(subtask.estimatedTokens * 0.3), // Approximate output tokens
        model: model.id
      });
      
      // Add to total cost
      totalCost += estimate.paid.cost.total;
    }
    
    return totalCost;
  },
  
  /**
   * Execute a single subtask using its assigned model
   * 
   * @param subtask The subtask to execute
   * @param model The model to use
   * @param fullContext Optional additional context for the model
   * @returns The model's response
   */
  async executeSubtask(
    subtask: CodeSubtask,
    model: Model,
    fullContext?: string
  ): Promise<string> {
    // Create a clear, focused prompt for the subtask
    const prompt = `You are tasked with implementing the following specific part of a larger coding task:
    
Task: ${subtask.description}

${fullContext ? `Context:\n${fullContext}\n\n` : ''}Code Type: ${subtask.codeType}
Complexity: ${subtask.complexity.toFixed(2)} (0-1 scale)

Please provide a well-structured, high-quality implementation for this specific part of the task.
Focus only on this subtask, don't worry about other parts of the larger task.`;
    
    try {
      // Call the model using OpenRouter API
      const result = await openRouterModule.callOpenRouterApi(
        model.id,
        prompt,
        60000 // 60 seconds timeout
      );
      
      if (!result.success || !result.text) {
        throw new Error(`Failed to execute subtask: ${result.error}`);
      }
      
      return result.text;
    } catch (error) {
      if (error instanceof Error) {
        return `Error: Failed to execute subtask "${subtask.description}" with model "${model.id}": ${error.message}`;
      }
      return `Error: Failed to execute subtask "${subtask.description}" with model "${model.id}": Unknown error`;
    }
  },
  
  /**
   * Execute all subtasks in the proper order
   * 
   * @param decomposedTask The decomposed task
   * @param modelAssignments The model assignments for each subtask
   * @returns A map of subtask ID to results
   */
  async executeAllSubtasks(
    decomposedTask: DecomposedCodeTask,
    modelAssignments: Map<string, Model>
  ): Promise<Map<string, string>> {
    // Get execution order
    const executionOrder = dependencyMapper.sortByExecutionOrder(decomposedTask);
    const results = new Map<string, string>();
    
    // Process subtasks in order
    for (const subtask of executionOrder) {
      const model = modelAssignments.get(subtask.id);
      if (!model) {
        results.set(subtask.id, `Error: No model assigned for subtask "${subtask.description}"`);
        continue;
      }
      
      // Gather context from dependencies
      let dependencyContext = '';
      for (const depId of subtask.dependencies) {
        const depResult = results.get(depId);
        if (depResult) {
          const depSubtask = decomposedTask.subtasks.find(s => s.id === depId);
          if (depSubtask) {
            dependencyContext += `--- From dependency: ${depSubtask.description} ---\n\n`;
            dependencyContext += depResult + '\n\n';
          }
        }
      }
      
      // Execute the subtask
      const result = await this.executeSubtask(subtask, model, dependencyContext);
      results.set(subtask.id, result);
    }
    
    return results;
  },
  
  /**
   * Synthesize final results after executing all subtasks
   * 
   * @param decomposedTask The decomposed task
   * @param subtaskResults The results from each subtask
   * @returns Synthesized final result
   */
  async synthesizeFinalResult(
    decomposedTask: DecomposedCodeTask,
    subtaskResults: Map<string, string>
  ): Promise<string> {
    // Build a combined result with all outputs
    let combinedResults = `# Results for coding task: ${decomposedTask.originalTask}\n\n`;
    
    // Get execution order for a sensible presentation
    const executionOrder = dependencyMapper.sortByExecutionOrder(decomposedTask);
    
    for (const subtask of executionOrder) {
      const result = subtaskResults.get(subtask.id);
      if (result) {
        combinedResults += `## ${subtask.description}\n\n`;
        combinedResults += '```\n' + result + '\n```\n\n';
      }
    }
    
    // Use a model to synthesize the final result
    try {
      // Find a suitable model for synthesis - preferably a larger one
      const availableModels = await costMonitor.getAvailableModels();
      const freeModels = await costMonitor.getFreeModels();
      
      // Prefer a free model if available and suitable
      let synthesisModel: Model | null = null;
      
      if (freeModels.length > 0) {
        const suitableModel = freeModels.find(model => 
          (model.contextWindow || 0) >= combinedResults.length
        );
        if (suitableModel) {
          synthesisModel = suitableModel;
        }
      }
      
      // If no suitable free model, use GPT-3.5 Turbo
      if (!synthesisModel) {
        synthesisModel = {
          id: 'gpt-3.5-turbo',
          name: 'GPT-3.5 Turbo',
          provider: 'openai',
          capabilities: {
            chat: true,
            completion: true
          },
          costPerToken: {
            prompt: 0.000001,
            completion: 0.000002
          }
        };
      }
      
      const synthesisPrompt = `I've broken down a coding task into subtasks and have results for each. 
Please synthesize these into a coherent final solution.

Original Task: ${decomposedTask.originalTask}

Subtask Results:
${combinedResults}

Please provide a clean, consolidated solution that integrates all the components properly.`;
      
      const result = await openRouterModule.callOpenRouterApi(
        synthesisModel.id,
        synthesisPrompt,
        120000 // 2 minutes timeout
      );
      
      if (!result.success || !result.text) {
        throw new Error(`Failed to synthesize results: ${result.error}`);
      }
      
      return result.text;
    } catch (error) {
      logger.error('Error synthesizing results:', error);
      
      // If synthesis fails, return the combined results without additional processing
      combinedResults += '\n\n## Note\n\nAutomatic synthesis failed. The above components need to be manually integrated.';
      return combinedResults;
    }
  }
};