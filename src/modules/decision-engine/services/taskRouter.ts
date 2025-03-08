import { logger } from '../../../utils/logger.js';
import { Model } from '../../../types/index.js';
import { COMPLEXITY_THRESHOLDS } from '../types/index.js';
import { modelPerformanceTracker } from './modelPerformance.js';
import { costMonitor } from '../../cost-monitor/index.js';
import { CodeSubtask } from '../types/codeTask.js';

interface RoutingStrategy {
  name: string;
  prioritizeSpeed: boolean;
  prioritizeQuality: boolean;
  requireLocalOnly: boolean;
}

/**
 * Service for smart task distribution and load balancing
 */
export const taskRouter = {
  // Define routing strategies
  strategies: {
    costEfficient: {
      name: 'Cost-Priority Balance',
      prioritizeSpeed: false,
      prioritizeQuality: false,
      requireLocalOnly: true
    },
    qualityFirst: {
      name: 'Quality-First Routing',
      prioritizeSpeed: false,
      prioritizeQuality: true,
      requireLocalOnly: false
    },
    speedFirst: {
      name: 'Speed-First Routing',
      prioritizeSpeed: true,
      prioritizeQuality: false,
      requireLocalOnly: true
    },
    resourceEfficient: {
      name: 'Resource-Efficient Routing',
      prioritizeSpeed: true,
      prioritizeQuality: false,
      requireLocalOnly: true
    }
  },

  /**
   * Select the best routing strategy based on task characteristics
   */
  selectStrategy(
    complexity: number,
    priority: 'speed' | 'quality' | 'cost' | 'efficiency' = 'cost'
  ): RoutingStrategy {
    if (priority === 'speed') {
      return this.strategies.speedFirst;
    }
    if (priority === 'quality' || complexity >= COMPLEXITY_THRESHOLDS.COMPLEX) {
      return this.strategies.qualityFirst;
    }
    if (priority === 'efficiency') {
      return this.strategies.resourceEfficient;
    }
    return this.strategies.costEfficient;
  },

  /**
   * Route a task to the most appropriate model
   */
  async routeTask(
    task: {
      complexity: number;
      estimatedTokens: number;
      priority?: 'speed' | 'quality' | 'cost' | 'efficiency';
    }
  ): Promise<Model | null> {
    try {
      const strategy = this.selectStrategy(task.complexity, task.priority);
      logger.debug(`Selected strategy: ${strategy.name} for task with complexity ${task.complexity}`);

      // Get best performing models based on strategy
      const models = modelPerformanceTracker.getBestPerformingModels(
        task.complexity,
        3,
        {
          prioritizeSpeed: strategy.prioritizeSpeed,
          prioritizeQuality: strategy.prioritizeQuality,
          requireLocalOnly: strategy.requireLocalOnly
        }
      );

      // If we have performance data, use it
      if (models.length > 0) {
        return models[0];
      }

      // Fallback to basic model selection if no performance data
      const availableModels = await costMonitor.getAvailableModels();
      return this.fallbackModelSelection(availableModels, task, strategy);
    } catch (error) {
      logger.error('Error routing task:', error);
      return null;
    }
  },

  /**
   * Route multiple subtasks efficiently
   */
  async routeSubtasks(
    subtasks: CodeSubtask[],
    globalPriority?: 'speed' | 'quality' | 'cost' | 'efficiency'
  ): Promise<Map<string, Model>> {
    const routingMap = new Map<string, Model>();
    
    try {
      // Sort subtasks by complexity (descending) to handle complex tasks first
      const sortedSubtasks = [...subtasks].sort((a, b) => b.complexity - a.complexity);

      for (const subtask of sortedSubtasks) {
        const model = await this.routeTask({
          complexity: subtask.complexity,
          estimatedTokens: subtask.estimatedTokens,
          priority: globalPriority
        });

        if (model) {
          routingMap.set(subtask.id, model);
        }
      }
    } catch (error) {
      logger.error('Error routing subtasks:', error);
    }

    return routingMap;
  },

  /**
   * Fallback model selection when no performance data is available
   */
  private fallbackModelSelection(
    models: Model[],
    task: { complexity: number; estimatedTokens: number },
    strategy: RoutingStrategy
  ): Model | null {
    // Filter models based on strategy
    const eligibleModels = models.filter(model => {
      if (strategy.requireLocalOnly) {
        return (model.provider === 'local' || 
                model.provider === 'lm-studio' || 
                model.provider === 'ollama') &&
               (!model.contextWindow || model.contextWindow >= task.estimatedTokens);
      }
      return !model.contextWindow || model.contextWindow >= task.estimatedTokens;
    });

    if (eligibleModels.length === 0) {
      return null;
    }

    // For complex tasks, prefer models with larger context windows
    if (task.complexity >= COMPLEXITY_THRESHOLDS.MEDIUM) {
      return eligibleModels.reduce((best, current) => {
        return (!best || (current.contextWindow || 0) > (best.contextWindow || 0)) 
          ? current 
          : best;
      }, eligibleModels[0]);
    }

    // For simple tasks, use the first eligible model
    return eligibleModels[0];
  }
};