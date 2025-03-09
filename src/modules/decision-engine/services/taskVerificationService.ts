import { codeEvaluationService } from './codeEvaluationService.js';
import { logger } from '../../../utils/logger.js';

interface TaskAttempt {
  taskId: string;
  provider: 'local' | 'paid';
  modelId: string;
  timestamp: number;
  success: boolean;
  verificationResults: {
    linting: boolean;
    tests: boolean;
    evaluation: boolean;
  };
}

interface TaskTracker {
  attempts: TaskAttempt[];
  failureCount: number;
  lastAttempt: number;
}

/**
 * Task Verification Service
 * Handles verification of task outputs including linting, testing, and code evaluation
 */
class TaskVerificationServiceImpl {
  private taskHistory: Map<string, TaskTracker> = new Map();

  /**
   * Track a new task attempt
   */
  async trackAttempt(
    taskId: string,
    provider: 'local' | 'paid',
    modelId: string,
    success: boolean,
    verificationResults: { linting: boolean; tests: boolean; evaluation: boolean }
  ): Promise<void> {
    const attempt: TaskAttempt = {
      taskId,
      provider,
      modelId,
      timestamp: Date.now(),
      success,
      verificationResults
    };

    const tracker = this.taskHistory.get(taskId) || {
      attempts: [],
      failureCount: 0,
      lastAttempt: 0
    };

    tracker.attempts.push(attempt);
    if (!success) tracker.failureCount++;
    tracker.lastAttempt = attempt.timestamp;

    this.taskHistory.set(taskId, tracker);
    logger.debug(`Tracked attempt for task ${taskId}, success: ${success}, failures: ${tracker.failureCount}`);
  }

  /**
   * Get task attempt history
   */
  getAttempts(taskId: string): TaskTracker {
    return (
      this.taskHistory.get(taskId) || {
        attempts: [],
        failureCount: 0,
        lastAttempt: 0
      }
    );
  }

  /**
   * Run linter on code
   */
  async runLinter(code: string, language: string): Promise<{ success: boolean; issues: string[] }> {
    try {
      // Use appropriate linter based on language
      const issues: string[] = [];
      
      switch (language.toLowerCase()) {
        case 'javascript':
        case 'typescript':
          // Example ESLint checks
          if (code.includes('var ')) {
            issues.push('Avoid using var - prefer const or let');
          }
          if (code.includes('==')) {
            issues.push('Use === instead of ==');
          }
          break;

        case 'python':
          // Example Python checks
          if (code.includes('print ')) {
            issues.push('Use print() instead of print');
          }
          if (/[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]+)*/.test(code)) {
            issues.push('Use snake_case for variable names in Python');
          }
          break;

        default:
          logger.warn(`No specific linter rules for language: ${language}`);
      }

      // Common checks across languages
      if (code.includes('TODO')) {
        issues.push('Remove TODO comments before submission');
      }
      if (code.includes('console.log') || code.includes('print(')) {
        issues.push('Remove debug print statements');
      }

      return {
        success: issues.length === 0,
        issues
      };
    } catch (error) {
      logger.error('Error running linter:', error);
      return {
        success: false,
        issues: [`Linting failed: ${error instanceof Error ? error.message : String(error)}`]
      };
    }
  }

  /**
   * Run tests on code
   */
  async runTests(
    code: string, 
    testCases: Array<{ input: string; expectedOutput: string }>
  ): Promise<{ success: boolean; results: Array<{ passed: boolean; error?: string }> }> {
    try {
      // Basic test runner using Function constructor
      // Note: This is a simplified example - in production you'd want proper sandboxing
      const results = testCases.map(test => {
        try {
          const fn = new Function('input', code + '\nreturn ' + code.split('function ')[1].split('(')[0] + '(input);');
          const output = fn(JSON.parse(test.input));
          const passed = JSON.stringify(output) === test.expectedOutput;
          return { passed, error: passed ? undefined : 'Output did not match expected result' };
        } catch (error) {
          return { 
            passed: false, 
            error: error instanceof Error ? error.message : String(error)
          };
        }
      });

      return {
        success: results.every(r => r.passed),
        results
      };
    } catch (error) {
      logger.error('Error running tests:', error);
      return {
        success: false,
        results: [{
          passed: false,
          error: `Test execution failed: ${error instanceof Error ? error.message : String(error)}`
        }]
      };
    }
  }

  /**
   * Verify a task solution
   * Runs linting, testing, and code evaluation
   */
  async verifyTaskSolution(
    taskId: string,
    code: string,
    language: string,
    testCases: Array<{ input: string; expectedOutput: string }>,
    provider: 'local' | 'paid',
    modelId: string
  ): Promise<boolean> {
    // Run linter
    const lintResult = await this.runLinter(code, language);
    
    // Run tests
    const testResult = await this.runTests(code, testCases);
    
    // Run code evaluation
    const evalResult = await codeEvaluationService.evaluateCodeQuality(
      taskId, // Using taskId as task description for now
      code,
      'general',
      { useModel: true }
    );

    const success = lintResult.success && 
                   testResult.success && 
                   (typeof evalResult === 'number' ? evalResult >= 0.7 : evalResult.score >= 0.7);

    // Track this attempt
    await this.trackAttempt(taskId, provider, modelId, success, {
      linting: lintResult.success,
      tests: testResult.success,
      evaluation: typeof evalResult === 'number' ? evalResult >= 0.7 : evalResult.score >= 0.7
    });

    return success;
  }

  /**
   * Clear task history
   */
  clearHistory(taskId?: string): void {
    if (taskId) {
      this.taskHistory.delete(taskId);
    } else {
      this.taskHistory.clear();
    }
  }
}

// Export singleton instance
export const taskVerificationService = new TaskVerificationServiceImpl();