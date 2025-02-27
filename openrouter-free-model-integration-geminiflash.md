## Plan for Integrating OpenRouter Free Models

This plan outlines the steps to integrate OpenRouter's free models into the `locallama-mcp` server's cost estimation and routing systems.

**Goal:** Enhance the `locallama-mcp` server to effectively utilize OpenRouter's free models, ensuring cost-effective routing decisions while maintaining system reliability.

**Minimal Set of Files for Modification:**

1.  `src/modules/cost-monitor/index.ts`
2.  `src/modules/decision-engine/index.ts`
3.  `src/modules/openrouter/index.ts` and `src/modules/openrouter/types.ts`
4.  `src/config/index.ts`
5.  `src/types/index.ts`

**Phases:**

**Phase 1: API Endpoint and Data Structure Verification**
*   Files: `src/modules/openrouter/index.ts`, `src/modules/openrouter/types.ts`
*   Goal: Verify OpenRouter API interaction and data parsing for free models.
*   Actions:
    *   Review OpenRouter API Documentation for free model endpoints.
    *   Examine the expected JSON response structure for free model listings.
    *   Verify data parsing in `openRouterModule.getFreeModels()` in `src/modules/openrouter/index.ts`.
    *   Update type definitions in `src/modules/openrouter/types.ts` and `src/types/index.ts` if necessary.

**Phase 2: Cost Estimation Logic Refinement**
*   File: `src/modules/cost-monitor/index.ts`
*   Goal: Refine cost estimation in `estimateCost()` for OpenRouter free models.
*   Actions:
    *   Review the `estimateCost()` function in `src/modules/cost-monitor/index.ts`.
    *   Verify that free models are correctly handled and cost is set to zero when `openRouterModel.isFree` is true.
    *   Consider dynamic pricing adjustments if OpenRouter's free tier has usage limits or dynamic pricing (optional).

**Phase 3: Routing Logic Enhancement**
*   File: `src/modules/decision-engine/index.ts`
*   Goal: Enhance routing logic in `decisionEngine` to better utilize OpenRouter free models.
*   Actions:
    *   Refine `getBestFreeModel()` in `src/modules/decision-engine/index.ts` to improve free model selection logic, potentially incorporating performance profiles or model capabilities.
    *   Review factor-based scoring in `routeTask()` and `preemptiveRouting()` to ensure appropriate weighting for free models.
    *   Ensure effective context window checks for free models in `routeTask()`.
    *   Consider making `COMPLEXITY_THRESHOLDS` and `TOKEN_THRESHOLDS` configurable in `src/config/index.ts` (optional).

**Phase 4: Configuration**
*   File: `src/config/index.ts`
*   Goal: Add any necessary configuration parameters.
*   Actions:
    *   If configurable thresholds are implemented in Phase 3, add them to `src/config/index.ts` with default values.

**Phase 5: Testing and Validation**
*   Goal: Thoroughly test the integration.
*   Actions:
    *   Write unit tests for modified functions in `cost-monitor` and `decision-engine`.
    *   Create integration tests to simulate task routing scenarios and verify free model utilization.
    *   Run benchmark tests to evaluate performance and cost-effectiveness with free model integration.

**Implementation Order:**

1.  Phase 1: API Endpoint and Data Structure Verification
2.  Phase 2: Cost Estimation Logic Refinement
3.  Phase 3: Routing Logic Enhancement
4.  Phase 4: Configuration
5.  Phase 5: Testing and Validation

This step-by-step approach ensures a systematic and well-validated integration of OpenRouter free models.