export interface Model {
  id: string;
  name: string;
  provider: 'local' | 'paid';
  contextWindow?: number;
  isFree?: boolean;
}

export interface TaskRoutingParams {
  task: string;
  contextLength: number;
  expectedOutputLength?: number;
  complexity?: number;
  priority?: 'speed' | 'cost' | 'quality';
}

export interface RoutingDecision {
  provider: 'local' | 'paid';
  model: string;
  factors: {
    cost?: {
      local: number;
      paid: number;
      wasFactor: boolean;
      weight?: number;
    };
    complexity?: {
      score: number;
      wasFactor: boolean;
      weight?: number;
    };
    tokenUsage?: {
      contextLength: number;
      outputLength: number;
      totalTokens?: number;
      wasFactor: boolean;
      weight?: number;
    };
    priority?: {
      value: 'speed' | 'cost' | 'quality';
      wasFactor: boolean;
      weight?: number;
    };
    contextWindow?: {
      wasFactor: boolean;
      weight?: number;
    };
    benchmarkPerformance?: {
      wasFactor: boolean;
      weight?: number;
    };
    previousAttempts?: {
      failureCount: number;
      wasFactor: boolean;
      weight?: number;
    };
  };
  confidence: number;
  explanation: string;
  scores: {
    local: number;
    paid: number;
  };
  preemptive?: boolean;
  verificationRequired?: boolean;
}

export interface ModelPerformanceProfile {
  responseTime: number;
  successRate: number;
  tokenCost: number;
  qualityScore: number;
}

export interface CodeEvaluationOptions {
  useModel?: boolean;
  modelId?: string;
  timeoutMs?: number;
  detailedAnalysis?: boolean;
}

export interface ModelCodeEvaluationResult {
  qualityScore: number;
  explanation: string;
  isValid: boolean;
  suggestions?: string[];
  implementationIssues?: string[];
  alternativeSolutions?: string[];
}