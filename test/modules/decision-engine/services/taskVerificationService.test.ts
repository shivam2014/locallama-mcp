import { taskVerificationService } from '../../../../src/modules/decision-engine/services/taskVerificationService.js';
import { codeEvaluationService } from '../../../../src/modules/decision-engine/services/codeEvaluationService.js';
import { logger } from '../../../../src/utils/logger.js';

// Mock dependencies
jest.mock('../../../../src/modules/decision-engine/services/codeEvaluationService.js');
jest.mock('../../../../src/utils/logger.js', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('TaskVerificationService', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    taskVerificationService.clearHistory();
  });

  describe('trackAttempt', () => {
    test('should track successful attempt correctly', async () => {
      const verificationResults = {
        linting: true,
        tests: true,
        evaluation: true
      };

      await taskVerificationService.trackAttempt(
        'task1',
        'local',
        'llama3',
        true,
        verificationResults
      );

      const attempts = taskVerificationService.getAttempts('task1');
      expect(attempts.attempts).toHaveLength(1);
      expect(attempts.failureCount).toBe(0);
      expect(attempts.attempts[0].success).toBe(true);
      expect(attempts.attempts[0].verificationResults).toEqual(verificationResults);
    });

    test('should track failed attempt and increment failure count', async () => {
      const verificationResults = {
        linting: false,
        tests: true,
        evaluation: true
      };

      await taskVerificationService.trackAttempt(
        'task2',
        'local',
        'llama3',
        false,
        verificationResults
      );

      const attempts = taskVerificationService.getAttempts('task2');
      expect(attempts.attempts).toHaveLength(1);
      expect(attempts.failureCount).toBe(1);
      expect(attempts.attempts[0].success).toBe(false);
      expect(attempts.attempts[0].verificationResults).toEqual(verificationResults);
    });
  });

  describe('runLinter', () => {
    test('should validate JavaScript code correctly', async () => {
      const jsCode = `
        var x = 1;
        if (x == 2) {
          console.log("test");
        }
      `;

      const result = await taskVerificationService.runLinter(jsCode, 'javascript');
      expect(result.success).toBe(false);
      expect(result.issues).toContain('Avoid using var - prefer const or let');
      expect(result.issues).toContain('Use === instead of ==');
      expect(result.issues).toContain('Remove debug print statements');
    });

    test('should validate Python code correctly', async () => {
      const pythonCode = `
        def MyFunction():
          print "Hello"
          camelCaseVar = 42
      `;

      const result = await taskVerificationService.runLinter(pythonCode, 'python');
      expect(result.success).toBe(false);
      expect(result.issues).toContain('Use print() instead of print');
      expect(result.issues).toContain('Use snake_case for variable names in Python');
    });

    test('should handle clean code successfully', async () => {
      const cleanCode = `
        function add(a, b) {
          return a + b;
        }
      `;

      const result = await taskVerificationService.runLinter(cleanCode, 'javascript');
      expect(result.success).toBe(true);
      expect(result.issues).toHaveLength(0);
    });
  });

  describe('runTests', () => {
    test('should execute test cases successfully', async () => {
      const code = `
        function add(input) {
          return input.a + input.b;
        }
      `;

      const testCases = [
        {
          input: '{"a": 1, "b": 2}',
          expectedOutput: '3'
        },
        {
          input: '{"a": -1, "b": 1}',
          expectedOutput: '0'
        }
      ];

      const result = await taskVerificationService.runTests(code, testCases);
      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(2);
      expect(result.results.every(r => r.passed)).toBe(true);
    });

    test('should handle failing test cases', async () => {
      const code = `
        function add(input) {
          return input.a - input.b; // Bug: subtraction instead of addition
        }
      `;

      const testCases = [
        {
          input: '{"a": 1, "b": 2}',
          expectedOutput: '3'
        }
      ];

      const result = await taskVerificationService.runTests(code, testCases);
      expect(result.success).toBe(false);
      expect(result.results[0].passed).toBe(false);
      expect(result.results[0].error).toBeDefined();
    });

    test('should handle syntax errors in code', async () => {
      const code = `
        function add(input {  // Missing parenthesis
          return input.a + input.b;
        }
      `;

      const testCases = [
        {
          input: '{"a": 1, "b": 2}',
          expectedOutput: '3'
        }
      ];

      const result = await taskVerificationService.runTests(code, testCases);
      expect(result.success).toBe(false);
      expect(result.results[0].passed).toBe(false);
      expect(result.results[0].error).toContain('SyntaxError');
    });
  });

  describe('verifyTaskSolution', () => {
    beforeEach(() => {
      (codeEvaluationService.evaluateCodeQuality as jest.Mock).mockResolvedValue({ score: 0.8 });
    });

    test('should verify successful solution', async () => {
      const code = `
        function add(input) {
          return input.a + input.b;
        }
      `;

      const testCases = [
        {
          input: '{"a": 1, "b": 2}',
          expectedOutput: '3'
        }
      ];

      const success = await taskVerificationService.verifyTaskSolution(
        'task3',
        code,
        'javascript',
        testCases,
        'local',
        'llama3'
      );

      expect(success).toBe(true);
      const attempts = taskVerificationService.getAttempts('task3');
      expect(attempts.attempts).toHaveLength(1);
      expect(attempts.attempts[0].verificationResults.linting).toBe(true);
      expect(attempts.attempts[0].verificationResults.tests).toBe(true);
      expect(attempts.attempts[0].verificationResults.evaluation).toBe(true);
    });

    test('should fail verification for poor quality code', async () => {
      (codeEvaluationService.evaluateCodeQuality as jest.Mock).mockResolvedValue({ score: 0.5 });

      const code = `
        var x = 1;
        if (x == 2) {
          console.log("test");
        }
      `;

      const testCases = [
        {
          input: '{"value": 1}',
          expectedOutput: '1'
        }
      ];

      const success = await taskVerificationService.verifyTaskSolution(
        'task4',
        code,
        'javascript',
        testCases,
        'local',
        'llama3'
      );

      expect(success).toBe(false);
      const attempts = taskVerificationService.getAttempts('task4');
      expect(attempts.attempts).toHaveLength(1);
      expect(attempts.attempts[0].verificationResults.linting).toBe(false);
      expect(attempts.attempts[0].verificationResults.evaluation).toBe(false);
    });
  });
});