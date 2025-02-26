"use strict";
/**
 * OpenRouter API response types
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenRouterErrorType = void 0;
/**
 * OpenRouter error types
 */
var OpenRouterErrorType;
(function (OpenRouterErrorType) {
    /** Rate limit exceeded */
    OpenRouterErrorType["RATE_LIMIT"] = "rate_limit";
    /** Authentication error */
    OpenRouterErrorType["AUTHENTICATION"] = "authentication";
    /** Invalid request */
    OpenRouterErrorType["INVALID_REQUEST"] = "invalid_request";
    /** Model not found */
    OpenRouterErrorType["MODEL_NOT_FOUND"] = "model_not_found";
    /** Context length exceeded */
    OpenRouterErrorType["CONTEXT_LENGTH_EXCEEDED"] = "context_length_exceeded";
    /** Server error */
    OpenRouterErrorType["SERVER_ERROR"] = "server_error";
    /** Unknown error */
    OpenRouterErrorType["UNKNOWN"] = "unknown";
})(OpenRouterErrorType || (exports.OpenRouterErrorType = OpenRouterErrorType = {}));
