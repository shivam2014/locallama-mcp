"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.costMonitor = void 0;
var axios_1 = require("axios");
var index_js_1 = require("../../config/index.js");
var logger_js_1 = require("../../utils/logger.js");
var index_js_2 = require("../openrouter/index.js");
/**
 * Cost & Token Monitoring Module
 *
 * This module is responsible for:
 * - Monitoring token usage and costs
 * - Estimating costs for tasks
 * - Retrieving available models
 */
exports.costMonitor = {
    /**
     * Get usage statistics for a specific API
     */
    getApiUsage: function (api) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                logger_js_1.logger.debug("Getting usage for API: ".concat(api));
                // This is a placeholder implementation
                // In a real implementation, this would query the API for usage data
                return [2 /*return*/, {
                        api: api,
                        tokenUsage: {
                            prompt: 1000000,
                            completion: 500000,
                            total: 1500000,
                        },
                        cost: {
                            prompt: 0.01,
                            completion: 0.02,
                            total: 0.03,
                        },
                        timestamp: new Date().toISOString(),
                    }];
            });
        });
    },
    /**
     * Get a list of available models
     */
    getAvailableModels: function () {
        return __awaiter(this, void 0, void 0, function () {
            var models, modelContextWindows, lmStudioResponse, lmStudioModels, error_1, ollamaResponse, ollamaModels, error_2, openRouterModels, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        logger_js_1.logger.debug('Getting available models');
                        models = [];
                        modelContextWindows = {
                            // LM Studio models
                            'llama3': 8192,
                            'llama3-8b': 8192,
                            'llama3-70b': 8192,
                            'mistral-7b': 8192,
                            'mixtral-8x7b': 32768,
                            'qwen2.5-coder-3b-instruct': 32768,
                            'qwen2.5-7b-instruct': 32768,
                            'qwen2.5-72b-instruct': 32768,
                            'phi-3-mini-4k': 4096,
                            'phi-3-medium-4k': 4096,
                            'phi-3-small-8k': 8192,
                            'gemma-7b': 8192,
                            'gemma-2b': 8192,
                            // Ollama models
                            'llama3:8b': 8192,
                            'llama3:70b': 8192,
                            'mistral': 8192,
                            'mixtral': 32768,
                            'qwen2:7b': 32768,
                            'qwen2:72b': 32768,
                            'phi3:mini': 4096,
                            'phi3:small': 8192,
                            'gemma:7b': 8192,
                            'gemma:2b': 8192,
                            // Default fallbacks
                            'default': 4096
                        };
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, axios_1.default.get("".concat(index_js_1.config.lmStudioEndpoint, "/models"))];
                    case 2:
                        lmStudioResponse = _a.sent();
                        if (lmStudioResponse.data && Array.isArray(lmStudioResponse.data.data)) {
                            lmStudioModels = lmStudioResponse.data.data.map(function (model) {
                                // Try to determine context window size
                                var contextWindow = 4096; // Default fallback
                                // Check if we have a known context window size for this model
                                var modelId = model.id.toLowerCase();
                                for (var _i = 0, _a = Object.entries(modelContextWindows); _i < _a.length; _i++) {
                                    var _b = _a[_i], key = _b[0], value = _b[1];
                                    if (modelId.includes(key.toLowerCase())) {
                                        contextWindow = value;
                                        break;
                                    }
                                }
                                return {
                                    id: model.id,
                                    name: model.id,
                                    provider: 'lm-studio',
                                    capabilities: {
                                        chat: true,
                                        completion: true,
                                    },
                                    costPerToken: {
                                        prompt: 0,
                                        completion: 0,
                                    },
                                    contextWindow: contextWindow
                                };
                            });
                            models.push.apply(models, lmStudioModels);
                        }
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _a.sent();
                        logger_js_1.logger.warn('Failed to get models from LM Studio:', error_1);
                        return [3 /*break*/, 4];
                    case 4:
                        _a.trys.push([4, 6, , 7]);
                        return [4 /*yield*/, axios_1.default.get("".concat(index_js_1.config.ollamaEndpoint, "/tags"))];
                    case 5:
                        ollamaResponse = _a.sent();
                        if (ollamaResponse.data && Array.isArray(ollamaResponse.data.models)) {
                            ollamaModels = ollamaResponse.data.models.map(function (model) {
                                // Try to determine context window size
                                var contextWindow = 4096; // Default fallback
                                // Check if we have a known context window size for this model
                                var modelName = model.name.toLowerCase();
                                for (var _i = 0, _a = Object.entries(modelContextWindows); _i < _a.length; _i++) {
                                    var _b = _a[_i], key = _b[0], value = _b[1];
                                    if (modelName.includes(key.toLowerCase())) {
                                        contextWindow = value;
                                        break;
                                    }
                                }
                                // Try to get more detailed model info from Ollama
                                try {
                                    // This is an async operation inside a map, which isn't ideal
                                    // In a production environment, we might want to use Promise.all
                                    // or restructure this to avoid the nested async call
                                    axios_1.default.get("".concat(index_js_1.config.ollamaEndpoint, "/show"), { params: { name: model.name } })
                                        .then(function (response) {
                                        if (response.data && response.data.parameters) {
                                            // Some Ollama models expose context_length or context_window
                                            var ctxLength = response.data.parameters.context_length ||
                                                response.data.parameters.context_window;
                                            if (ctxLength && typeof ctxLength === 'number') {
                                                contextWindow = ctxLength;
                                            }
                                        }
                                    })
                                        .catch(function (err) {
                                        logger_js_1.logger.debug("Failed to get detailed info for Ollama model ".concat(model.name, ":"), err);
                                    });
                                }
                                catch (detailError) {
                                    logger_js_1.logger.debug("Error getting detailed info for Ollama model ".concat(model.name, ":"), detailError);
                                }
                                return {
                                    id: model.name,
                                    name: model.name,
                                    provider: 'ollama',
                                    capabilities: {
                                        chat: true,
                                        completion: true,
                                    },
                                    costPerToken: {
                                        prompt: 0,
                                        completion: 0,
                                    },
                                    contextWindow: contextWindow
                                };
                            });
                            models.push.apply(models, ollamaModels);
                        }
                        return [3 /*break*/, 7];
                    case 6:
                        error_2 = _a.sent();
                        logger_js_1.logger.warn('Failed to get models from Ollama:', error_2);
                        return [3 /*break*/, 7];
                    case 7:
                        _a.trys.push([7, 12, , 13]);
                        if (!index_js_1.config.openRouterApiKey) return [3 /*break*/, 11];
                        if (!(Object.keys(index_js_2.openRouterModule.modelTracking.models).length === 0)) return [3 /*break*/, 9];
                        return [4 /*yield*/, index_js_2.openRouterModule.initialize()];
                    case 8:
                        _a.sent();
                        _a.label = 9;
                    case 9: return [4 /*yield*/, index_js_2.openRouterModule.getAvailableModels()];
                    case 10:
                        openRouterModels = _a.sent();
                        // Add the models to our list
                        models.push.apply(models, openRouterModels);
                        logger_js_1.logger.debug("Added ".concat(openRouterModels.length, " models from OpenRouter"));
                        _a.label = 11;
                    case 11: return [3 /*break*/, 13];
                    case 12:
                        error_3 = _a.sent();
                        logger_js_1.logger.warn('Failed to get models from OpenRouter:', error_3);
                        return [3 /*break*/, 13];
                    case 13:
                        // If no models were found, return some default models
                        if (models.length === 0) {
                            models.push({
                                id: 'llama3',
                                name: 'Llama 3',
                                provider: 'local',
                                capabilities: {
                                    chat: true,
                                    completion: true,
                                },
                                costPerToken: {
                                    prompt: 0,
                                    completion: 0,
                                },
                                contextWindow: 8192 // Default context window for Llama 3
                            });
                        }
                        return [2 /*return*/, models];
                }
            });
        });
    },
    /**
     * Get free models from OpenRouter
     */
    getFreeModels: function () {
        return __awaiter(this, void 0, void 0, function () {
            var error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        logger_js_1.logger.debug('Getting free models');
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 6, , 7]);
                        if (!index_js_1.config.openRouterApiKey) return [3 /*break*/, 5];
                        if (!(Object.keys(index_js_2.openRouterModule.modelTracking.models).length === 0)) return [3 /*break*/, 3];
                        return [4 /*yield*/, index_js_2.openRouterModule.initialize()];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3: return [4 /*yield*/, index_js_2.openRouterModule.getFreeModels()];
                    case 4: 
                    // Get free models from OpenRouter
                    return [2 /*return*/, _a.sent()];
                    case 5: return [3 /*break*/, 7];
                    case 6:
                        error_4 = _a.sent();
                        logger_js_1.logger.warn('Failed to get free models from OpenRouter:', error_4);
                        return [3 /*break*/, 7];
                    case 7: return [2 /*return*/, []];
                }
            });
        });
    },
    /**
     * Estimate the cost for a task
     */
    estimateCost: function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var contextLength, _a, outputLength, model, localCost, promptCost, completionCost, openRouterModel, freeModels, paidCost;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        contextLength = params.contextLength, _a = params.outputLength, outputLength = _a === void 0 ? 0 : _a, model = params.model;
                        logger_js_1.logger.debug("Estimating cost for task with context length ".concat(contextLength, " and output length ").concat(outputLength));
                        localCost = {
                            prompt: 0,
                            completion: 0,
                            total: 0,
                            currency: 'USD',
                        };
                        promptCost = contextLength * 0.000001;
                        completionCost = outputLength * 0.000002;
                        if (!model) return [3 /*break*/, 1];
                        // Check if it's an OpenRouter model
                        if (index_js_1.config.openRouterApiKey && index_js_2.openRouterModule.modelTracking.models[model]) {
                            openRouterModel = index_js_2.openRouterModule.modelTracking.models[model];
                            promptCost = contextLength * openRouterModel.costPerToken.prompt;
                            completionCost = outputLength * openRouterModel.costPerToken.completion;
                            // If it's a free model, set costs to 0
                            if (openRouterModel.isFree) {
                                promptCost = 0;
                                completionCost = 0;
                            }
                        }
                        return [3 /*break*/, 3];
                    case 1:
                        if (!index_js_1.config.openRouterApiKey) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.getFreeModels()];
                    case 2:
                        freeModels = _b.sent();
                        if (freeModels.length > 0) {
                            // We have free models available, so we can set the paid cost to 0
                            // This will make the recommendation favor the free models
                            promptCost = 0;
                            completionCost = 0;
                        }
                        _b.label = 3;
                    case 3:
                        paidCost = {
                            prompt: promptCost,
                            completion: completionCost,
                            total: promptCost + completionCost,
                            currency: 'USD',
                        };
                        return [2 /*return*/, {
                                local: {
                                    cost: localCost,
                                    tokenCount: {
                                        prompt: contextLength,
                                        completion: outputLength,
                                        total: contextLength + outputLength,
                                    },
                                },
                                paid: {
                                    cost: paidCost,
                                    tokenCount: {
                                        prompt: contextLength,
                                        completion: outputLength,
                                        total: contextLength + outputLength,
                                    },
                                },
                                recommendation: paidCost.total > index_js_1.config.costThreshold ? 'local' : 'paid',
                            }];
                }
            });
        });
    },
};
