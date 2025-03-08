import { logger } from '../../../utils/logger.js';
import { DecomposedCodeTask, CodeSubtask } from '../types/codeTask.js';

/**
 * Service for mapping dependencies between code subtasks
 */
export const dependencyMapper = {
  /**
   * Sort subtasks by execution order based on their dependencies
   * 
   * @param decomposedTask The decomposed code task with subtasks and dependencies
   * @returns A sorted list of subtasks in execution order
   */
  sortByExecutionOrder(decomposedTask: DecomposedCodeTask): CodeSubtask[] {
    const { subtasks, dependencyMap } = decomposedTask;
    
    // Map of subtask IDs to their subtask objects for easy lookup
    const subtaskMap = new Map<string, CodeSubtask>();
    subtasks.forEach(subtask => {
      subtaskMap.set(subtask.id, subtask);
    });
    
    // Keep track of visited and sorted subtasks
    const visited = new Set<string>();
    const temp = new Set<string>();
    const sorted: CodeSubtask[] = [];
    
    // Topological sort using depth-first search
    const visit = (subtaskId: string): void => {
      // If already in sorted result, skip
      if (visited.has(subtaskId)) return;
      
      // Check for cyclic dependencies
      if (temp.has(subtaskId)) {
        logger.warn(`Cyclic dependency detected involving subtask: ${subtaskId}`);
        return;
      }
      
      // Mark as being processed
      temp.add(subtaskId);
      
      // Process all dependencies first
      const dependencies = dependencyMap[subtaskId] || [];
      for (const depId of dependencies) {
        if (subtaskMap.has(depId)) {
          visit(depId);
        }
      }
      
      // Mark as processed and add to result
      temp.delete(subtaskId);
      visited.add(subtaskId);
      
      const subtask = subtaskMap.get(subtaskId);
      if (subtask) {
        sorted.push(subtask);
      }
    };
    
    // Visit all subtasks
    for (const subtask of subtasks) {
      if (!visited.has(subtask.id)) {
        visit(subtask.id);
      }
    }
    
    return sorted.reverse();
  },
  
  /**
   * Check for and resolve circular dependencies
   * 
   * @param decomposedTask The decomposed code task
   * @returns An updated decomposed task with resolved dependencies
   */
  resolveCircularDependencies(decomposedTask: DecomposedCodeTask): DecomposedCodeTask {
    const { subtasks, dependencyMap } = decomposedTask;
    const updatedDependencyMap = { ...dependencyMap };
    
    // Detect and resolve circular dependencies
    const visited = new Set<string>();
    const path: string[] = [];
    const circularDependencies: string[][] = [];
    
    // DFS to detect cycles
    const detectCycle = (current: string, path: string[] = []): boolean => {
      if (path.includes(current)) {
        // Cycle detected, extract the cycle
        const cycleStart = path.indexOf(current);
        circularDependencies.push(path.slice(cycleStart).concat(current));
        return true;
      }
      
      if (visited.has(current)) return false;
      
      visited.add(current);
      path.push(current);
      
      for (const dependency of updatedDependencyMap[current] || []) {
        if (detectCycle(dependency, [...path])) {
          return true;
        }
      }
      
      path.pop();
      return false;
    };
    
    // Check each subtask for cycles
    for (const subtask of subtasks) {
      if (!visited.has(subtask.id)) {
        detectCycle(subtask.id, []);
      }
    }
    
    // Resolve circular dependencies by removing the weakest link
    for (const cycle of circularDependencies) {
      logger.warn(`Resolving circular dependency: ${cycle.join(' -> ')}`);
      
      // Find the "weakest" link (lowest complexity or least dependencies)
      let weakestLink = cycle[0];
      let minDependencies = (updatedDependencyMap[cycle[0]] || []).length;
      
      for (let i = 1; i < cycle.length - 1; i++) {
        const deps = (updatedDependencyMap[cycle[i]] || []).length;
        if (deps < minDependencies) {
          minDependencies = deps;
          weakestLink = cycle[i];
        }
      }
      
      // Remove the dependency that creates the cycle
      const sourceIdx = cycle.indexOf(weakestLink);
      const targetIdx = (sourceIdx + 1) % cycle.length;
      const target = cycle[targetIdx];
      
      updatedDependencyMap[weakestLink] = (updatedDependencyMap[weakestLink] || [])
        .filter(dep => dep !== target);
      
      logger.debug(`Removed dependency from ${weakestLink} to ${target}`);
    }
    
    // Update subtasks to reflect the changes in dependencies
    const updatedSubtasks = subtasks.map(subtask => ({
      ...subtask,
      dependencies: updatedDependencyMap[subtask.id] || []
    }));
    
    return {
      ...decomposedTask,
      subtasks: updatedSubtasks,
      dependencyMap: updatedDependencyMap
    };
  },
  
  /**
   * Generate a visual representation of dependencies
   * 
   * @param decomposedTask The decomposed code task
   * @returns A string with a visual representation of dependencies
   */
  visualizeDependencies(decomposedTask: DecomposedCodeTask): string {
    const { subtasks, dependencyMap } = decomposedTask;
    
    // Create a map for easy lookup
    const subtaskMap = new Map<string, CodeSubtask>();
    subtasks.forEach(subtask => {
      subtaskMap.set(subtask.id, subtask);
    });
    
    // Sort subtasks by execution order
    const orderedSubtasks = this.sortByExecutionOrder(decomposedTask);
    
    // Build visualization
    let visualization = '# Code Task Dependencies\n\n';
    visualization += `Original Task: ${decomposedTask.originalTask}\n\n`;
    visualization += '## Execution Order\n\n';
    
    orderedSubtasks.forEach((subtask, index) => {
      visualization += `${index + 1}. ${subtask.description} (ID: ${subtask.id.slice(0, 8)}..., Complexity: ${subtask.complexity})\n`;
    });
    
    visualization += '\n## Dependency Graph\n\n```\n';
    
    // Create a simple ASCII dependency graph
    orderedSubtasks.forEach((subtask, index) => {
      const id = subtask.id;
      const shortId = id.slice(0, 8);
      const deps = dependencyMap[id] || [];
      
      visualization += `[${shortId}] ${subtask.description.slice(0, 40)}${subtask.description.length > 40 ? '...' : ''}\n`;
      
      if (deps.length > 0) {
        deps.forEach(depId => {
          const depSubtask = subtaskMap.get(depId);
          if (depSubtask) {
            const shortDepId = depId.slice(0, 8);
            visualization += `  ├── depends on [${shortDepId}] ${depSubtask.description.slice(0, 30)}${depSubtask.description.length > 30 ? '...' : ''}\n`;
          }
        });
      } else {
        visualization += '  └── (no dependencies)\n';
      }
      
      visualization += '\n';
    });
    
    visualization += '```\n';
    
    return visualization;
  },
  
  /**
   * Calculate the critical path and detailed metrics
   * 
   * @param decomposedTask The decomposed code task
   * @returns An object containing critical path and detailed analysis
   */
  analyzeTaskPath(decomposedTask: DecomposedCodeTask): {
    criticalPath: CodeSubtask[];
    metrics: NonNullable<CodeComplexityResult['metrics']>['criticalPath'];
  } {
    const criticalPath = this.findCriticalPath(decomposedTask);
    const { subtasks, dependencyMap } = decomposedTask;

    // Calculate total duration and find bottlenecks
    const duration = criticalPath.reduce((sum, task) => sum + task.estimatedTokens, 0);
    
    // Analyze potential bottlenecks
    const bottlenecks = criticalPath.map(task => {
      // Calculate impact based on:
      // 1. Number of dependent tasks
      // 2. Complexity score
      // 3. Position in critical path
      const dependentTasks = subtasks.filter(s => 
        (dependencyMap[s.id] || []).includes(task.id)
      ).length;

      const positionImpact = criticalPath.indexOf(task) / criticalPath.length;
      const impact = (
        (task.complexity * 0.4) +
        (dependentTasks / subtasks.length * 0.4) +
        (positionImpact * 0.2)
      );

      return {
        id: task.id,
        description: task.description,
        impact
      };
    }).filter(b => b.impact > 0.5); // Only include significant bottlenecks

    // Calculate parallelization potential
    const independentPaths = this.findIndependentPaths(decomposedTask);
    const maxParallelPaths = independentPaths.length;
    const totalTasks = subtasks.length;
    const parallelizationScore = Math.min(
      maxParallelPaths / Math.ceil(Math.sqrt(totalTasks)),
      1
    );

    return {
      criticalPath,
      metrics: {
        duration,
        bottlenecks,
        parallelizationScore
      }
    };
  },

  /**
   * Find independent paths that can be executed in parallel
   * 
   * @param decomposedTask The decomposed code task
   * @returns Array of independent task paths
   */
  findIndependentPaths(decomposedTask: DecomposedCodeTask): CodeSubtask[][] {
    const { subtasks, dependencyMap } = decomposedTask;
    const paths: CodeSubtask[][] = [];
    const visited = new Set<string>();

    // Helper function to check if two tasks are independent
    const areIndependent = (task1: CodeSubtask, task2: CodeSubtask): boolean => {
      const deps1 = new Set(dependencyMap[task1.id] || []);
      const deps2 = new Set(dependencyMap[task2.id] || []);
      return !deps1.has(task2.id) && !deps2.has(task1.id);
    };

    // Find paths of independent tasks
    for (const startTask of subtasks) {
      if (visited.has(startTask.id)) continue;

      const currentPath: CodeSubtask[] = [startTask];
      visited.add(startTask.id);

      // Try to extend the path with independent tasks
      for (const task of subtasks) {
        if (visited.has(task.id)) continue;

        // Check if task is independent from all tasks in current path
        const isIndependentFromPath = currentPath.every(
          pathTask => areIndependent(task, pathTask)
        );

        if (isIndependentFromPath) {
          currentPath.push(task);
          visited.add(task.id);
        }
      }

      if (currentPath.length > 0) {
        paths.push(currentPath);
      }
    }

    return paths;
  },

  /**
   * Calculate the critical path of subtasks based on their dependencies and estimated token counts
   * 
   * @param decomposedTask The decomposed code task
   * @returns An array of subtasks representing the critical path
   */
  findCriticalPath(decomposedTask: DecomposedCodeTask): CodeSubtask[] {
    const { subtasks, dependencyMap } = decomposedTask;
    
    // Create a map for easy lookup
    const subtaskMap = new Map<string, CodeSubtask>();
    subtasks.forEach(subtask => {
      subtaskMap.set(subtask.id, subtask);
    });
    
    // Calculate earliest start and finish times
    const earliestStart = new Map<string, number>();
    const earliestFinish = new Map<string, number>();
    const latestStart = new Map<string, number>();
    const latestFinish = new Map<string, number>();
    const slack = new Map<string, number>();
    
    // Sort subtasks topologically
    const orderedSubtasks = this.sortByExecutionOrder(decomposedTask);
    
    // Forward pass - calculate earliest start and finish
    orderedSubtasks.forEach(subtask => {
      const id = subtask.id;
      const deps = dependencyMap[id] || [];
      let maxDependencyFinish = 0;
      
      // Find the maximum finish time of all dependencies
      for (const depId of deps) {
        const depFinish = earliestFinish.get(depId) || 0;
        maxDependencyFinish = Math.max(maxDependencyFinish, depFinish);
      }
      
      const start = maxDependencyFinish;
      const finish = start + subtask.estimatedTokens;
      
      earliestStart.set(id, start);
      earliestFinish.set(id, finish);
    });
    
    // Find the project completion time
    const projectDuration = Math.max(...subtasks.map(s => earliestFinish.get(s.id) || 0));
    
    // Backward pass - calculate latest start and finish
    [...orderedSubtasks].reverse().forEach(subtask => {
      const id = subtask.id;
      let minLatestStart = projectDuration;
      
      // Find tasks that depend on this one
      for (const s of subtasks) {
        if ((dependencyMap[s.id] || []).includes(id)) {
          const sLatestStart = latestStart.get(s.id) || projectDuration;
          minLatestStart = Math.min(minLatestStart, sLatestStart);
        }
      }
      
      const finish = subtasks.some(s => (dependencyMap[s.id] || []).includes(id)) ? 
                        minLatestStart : projectDuration;
      const start = finish - subtask.estimatedTokens;
      
      latestFinish.set(id, finish);
      latestStart.set(id, start);
      
      // Calculate slack
      slack.set(id, (latestStart.get(id) || 0) - (earliestStart.get(id) || 0));
    });
    
    // Tasks with zero slack are on the critical path
    const criticalPath = subtasks.filter(subtask => (slack.get(subtask.id) || 0) === 0)
      .sort((a, b) => (earliestStart.get(a.id) || 0) - (earliestStart.get(b.id) || 0));
    
    return criticalPath;
  }
};