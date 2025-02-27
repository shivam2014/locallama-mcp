# OpenRouter Integration in locallama-mcp

This document describes the integration of OpenRouter with the `locallama-mcp` server, focusing on the use of free models for cost-effective task routing.

## Configuration

The OpenRouter integration requires an API key, which should be set as an environment variable:

```bash
OPENROUTER_API_KEY=your-openrouter-api-key
```

You can set this environment variable in a `.env` file in the project's root directory, or directly in your shell environment. The server uses the `dotenv` package to load environment variables from a `.env` file.

## Free Model Selection

The `locallama-mcp` server automatically detects and prioritizes free models from OpenRouter. The process works as follows:

1.  **Model List Retrieval:** The server queries the OpenRouter API (`https://openrouter.ai/api/v1/models`) to get a list of available models. This happens:
    *   When the server starts.
    *   Every 24 hours.
    *   When manually triggered (see "Forcing an Update" below).
2.  **Free Model Identification:** The server identifies free models by checking the `pricing` information in the API response. A model is considered free if both the `prompt` and `completion` pricing are 0 (or very close to 0, accounting for floating-point precision).
3.  **Cost Estimation:** The `costMonitor` module estimates the cost of using each model. For free models, the cost is always set to 0.
4.  **Routing Decisions:** The `decisionEngine` module prioritizes free models when routing tasks. If a free model is available and suitable for the task (based on complexity and context window), it will be selected over paid models.

## Model List Updates

The list of available models (including free models) is updated every 24 hours. The server stores the model data in a file named `openrouter-models.json` in the project's root directory.

## Forcing an Update

If you need to force an update of the model list (e.g., if new free models have been added to OpenRouter), you can:

1.  **Delete the `openrouter-models.json` file:** This will force the server to fetch the latest model list from OpenRouter on the next request or on server restart.
2. **Restart the server:** Restarting will also trigger a model list update.

## Troubleshooting

*   **No Free Models Available:** If no free models are being used, check the following:
    *   Ensure the `OPENROUTER_API_KEY` environment variable is set correctly.
    *   Check the server logs for any errors related to OpenRouter (search for "OpenRouter error").
    *   Force an update of the model list (see above).
    *   Verify that there are actually free models available on OpenRouter.
*   **OpenRouter API Errors:** The server logs will contain information about any errors encountered while communicating with the OpenRouter API. Common errors include:
    *   `authentication_error`: The API key is invalid.
    *   `rate_limit_exceeded`: You have exceeded your OpenRouter API rate limit.
    *   `invalid_request_error`: There is an issue with the request sent to the OpenRouter API.
    *   `context_length_exceeded`: The requested context length exceeds the model's limit.
    *   `model_not_found`: The requested model does not exist.