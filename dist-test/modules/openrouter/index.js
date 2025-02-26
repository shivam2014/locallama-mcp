"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.openRouterModule = void 0;
var axios_1 = require("axios");
var promises_1 = require("fs/promises");
var path_1 = require("path");
var index_js_1 = require("../../config/index.js");
var logger_js_1 = require("../../utils/logger.js");
var types_js_1 = require("./types.js");
// File path for storing OpenRouter model tracking data
var TRACKING_FILE_PATH = path_1.default.join(index_js_1.config.rootDir, 'openrouter-models.json');
// Default prompting strategies for different model families
var DEFAULT_PROMPTING_STRATEGIES = {
    'openai': {
        systemPrompt: 'You are a helpful assistant.',
        useChat: true
    },
    'anthropic': {
        systemPrompt: 'You are Claude, a helpful AI assistant.',
        useChat: true
    },
    'google': {
        systemPrompt: 'You are a helpful AI assistant.',
        useChat: true
    },
    'mistral': {
        systemPrompt: 'You are a helpful AI assistant.',
        useChat: true
    },
    'default': {
        systemPrompt: 'You are a helpful AI assistant.',
        useChat: true
    }
};
/**
 * OpenRouter Module
 *
 * This module is responsible for:
 * - Querying OpenRouter for available models
 * - Tracking free models
 * - Handling errors from OpenRouter
 * - Determining the best prompting strategy for each model
 */
exports.openRouterModule = {
    // In-memory cache of model tracking data
    modelTracking: {
        models: {},
        lastUpdated: '',
        freeModels: []
    },
    // In-memory cache of prompting strategies
    promptingStrategies: {},
    /**
     * Initialize the OpenRouter module
     * Loads tracking data from disk if available
     */
    initialize: function () {
        return __awaiter(this, void 0, void 0, function () {
            var data, error_1, strategiesPath, data, error_2, now, lastUpdated, hoursSinceLastUpdate, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        logger_js_1.logger.debug('Initializing OpenRouter module');
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 12, , 13]);
                        // Check if API key is configured
                        if (!index_js_1.config.openRouterApiKey) {
                            logger_js_1.logger.warn('OpenRouter API key not configured, free models will not be available');
                            return [2 /*return*/];
                        }
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, promises_1.default.readFile(TRACKING_FILE_PATH, 'utf8')];
                    case 3:
                        data = _a.sent();
                        this.modelTracking = JSON.parse(data);
                        logger_js_1.logger.debug("Loaded OpenRouter tracking data with ".concat(Object.keys(this.modelTracking.models).length, " models"));
                        return [3 /*break*/, 5];
                    case 4:
                        error_1 = _a.sent();
                        logger_js_1.logger.debug('No existing OpenRouter tracking data found, will create new tracking data');
                        this.modelTracking = {
                            models: {},
                            lastUpdated: new Date().toISOString(),
                            freeModels: []
                        };
                        return [3 /*break*/, 5];
                    case 5:
                        _a.trys.push([5, 7, , 8]);
                        strategiesPath = path_1.default.join(index_js_1.config.rootDir, 'openrouter-strategies.json');
                        return [4 /*yield*/, promises_1.default.readFile(strategiesPath, 'utf8')];
                    case 6:
                        data = _a.sent();
                        this.promptingStrategies = JSON.parse(data);
                        logger_js_1.logger.debug("Loaded OpenRouter prompting strategies for ".concat(Object.keys(this.promptingStrategies).length, " models"));
                        return [3 /*break*/, 8];
                    case 7:
                        error_2 = _a.sent();
                        logger_js_1.logger.debug('No existing OpenRouter prompting strategies found');
                        this.promptingStrategies = {};
                        return [3 /*break*/, 8];
                    case 8:
                        now = new Date();
                        lastUpdated = new Date(this.modelTracking.lastUpdated);
                        hoursSinceLastUpdate = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60);
                        if (!(hoursSinceLastUpdate > 24)) return [3 /*break*/, 10];
                        logger_js_1.logger.info('OpenRouter models data is more than 24 hours old, updating...');
                        return [4 /*yield*/, this.updateModels()];
                    case 9:
                        _a.sent();
                        return [3 /*break*/, 11];
                    case 10:
                        logger_js_1.logger.debug("OpenRouter models data is ".concat(hoursSinceLastUpdate.toFixed(1), " hours old, no update needed"));
                        _a.label = 11;
                    case 11: return [3 /*break*/, 13];
                    case 12:
                        error_3 = _a.sent();
                        logger_js_1.logger.error('Error initializing OpenRouter module:', error_3);
                        return [3 /*break*/, 13];
                    case 13: return [2 /*return*/];
                }
            });
        });
    },
    /**
     * Update the list of available models from OpenRouter
     */
    updateModels: function () {
        return __awaiter(this, void 0, void 0, function () {
            var response, models, freeModels, updatedModels, _i, models_1, model, isFree, existingModel, error_4;
            var _a, _b, _c, _d, _e, _f, _g;
            return __generator(this, function (_h) {
                switch (_h.label) {
                    case 0:
                        logger_js_1.logger.debug('Updating OpenRouter models');
                        _h.label = 1;
                    case 1:
                        _h.trys.push([1, 6, , 7]);
                        // Check if API key is configured
                        if (!index_js_1.config.openRouterApiKey) {
                            logger_js_1.logger.warn('OpenRouter API key not configured, free models will not be available');
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, axios_1.default.get('https://openrouter.ai/api/v1/models', {
                                headers: {
                                    'Authorization': "Bearer ".concat(index_js_1.config.openRouterApiKey),
                                    'HTTP-Referer': 'https://locallama-mcp.local', // Required by OpenRouter
                                    'X-Title': 'LocalLama MCP'
                                }
                            })];
                    case 2:
                        response = _h.sent();
                        if (!(response.data && Array.isArray(response.data.data))) return [3 /*break*/, 4];
                        models = response.data.data;
                        freeModels = [];
                        updatedModels = {};
                        for (_i = 0, models_1 = models; _i < models_1.length; _i++) {
                            model = models_1[_i];
                            isFree = ((_a = model.pricing) === null || _a === void 0 ? void 0 : _a.prompt) === 0 && ((_b = model.pricing) === null || _b === void 0 ? void 0 : _b.completion) === 0;
                            // If the model is free, add it to the list
                            if (isFree) {
                                freeModels.push(model.id);
                            }
                            existingModel = this.modelTracking.models[model.id];
                            updatedModels[model.id] = {
                                id: model.id,
                                name: model.name || model.id,
                                provider: this.getProviderFromModelId(model.id),
                                isFree: isFree,
                                contextWindow: model.context_length || 4096,
                                capabilities: {
                                    chat: ((_c = model.features) === null || _c === void 0 ? void 0 : _c.chat) || false,
                                    completion: ((_d = model.features) === null || _d === void 0 ? void 0 : _d.completion) || false,
                                    vision: ((_e = model.features) === null || _e === void 0 ? void 0 : _e.vision) || false
                                },
                                costPerToken: {
                                    prompt: ((_f = model.pricing) === null || _f === void 0 ? void 0 : _f.prompt) || 0,
                                    completion: ((_g = model.pricing) === null || _g === void 0 ? void 0 : _g.completion) || 0
                                },
                                promptingStrategy: (existingModel === null || existingModel === void 0 ? void 0 : existingModel.promptingStrategy) || {
                                    systemPrompt: this.getDefaultPromptingStrategy(model.id).systemPrompt,
                                    userPrompt: this.getDefaultPromptingStrategy(model.id).userPrompt,
                                    assistantPrompt: this.getDefaultPromptingStrategy(model.id).assistantPrompt,
                                    useChat: this.getDefaultPromptingStrategy(model.id).useChat || true
                                },
                                lastUpdated: new Date().toISOString(),
                                version: (existingModel === null || existingModel === void 0 ? void 0 : existingModel.version) || '1.0'
                            };
                        }
                        // Update the tracking data
                        this.modelTracking = {
                            models: updatedModels,
                            lastUpdated: new Date().toISOString(),
                            freeModels: freeModels
                        };
                        // Save the tracking data to disk
                        return [4 /*yield*/, this.saveTrackingData()];
                    case 3:
                        // Save the tracking data to disk
                        _h.sent();
                        logger_js_1.logger.info("Updated OpenRouter models: ".concat(Object.keys(updatedModels).length, " total, ").concat(freeModels.length, " free"));
                        return [3 /*break*/, 5];
                    case 4:
                        logger_js_1.logger.warn('Invalid response from OpenRouter API:', response.data);
                        _h.label = 5;
                    case 5: return [3 /*break*/, 7];
                    case 6:
                        error_4 = _h.sent();
                        this.handleOpenRouterError(error_4);
                        return [3 /*break*/, 7];
                    case 7: return [2 /*return*/];
                }
            });
        });
    },
    /**
     * Get the provider from a model ID
     */
    getProviderFromModelId: function (modelId) {
        if (modelId.includes('openai'))
            return 'openai';
        if (modelId.includes('anthropic'))
            return 'anthropic';
        if (modelId.includes('claude'))
            return 'anthropic';
        if (modelId.includes('google'))
            return 'google';
        if (modelId.includes('gemini'))
            return 'google';
        if (modelId.includes('mistral'))
            return 'mistral';
        if (modelId.includes('meta'))
            return 'meta';
        if (modelId.includes('llama'))
            return 'meta';
        return 'unknown';
    },
    /**
     * Get the default prompting strategy for a model
     */
    getDefaultPromptingStrategy: function (modelId) {
        var provider = this.getProviderFromModelId(modelId);
        var defaultStrategy = DEFAULT_PROMPTING_STRATEGIES[provider] || DEFAULT_PROMPTING_STRATEGIES.default;
        return {
            systemPrompt: defaultStrategy.systemPrompt,
            userPrompt: defaultStrategy.userPrompt,
            assistantPrompt: defaultStrategy.assistantPrompt,
            useChat: defaultStrategy.useChat || true
        };
    },
    /**
     * Save the tracking data to disk
     */
    saveTrackingData: function () {
        return __awaiter(this, void 0, void 0, function () {
            var error_5;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, promises_1.default.writeFile(TRACKING_FILE_PATH, JSON.stringify(this.modelTracking, null, 2))];
                    case 1:
                        _a.sent();
                        logger_js_1.logger.debug('Saved OpenRouter tracking data to disk');
                        return [3 /*break*/, 3];
                    case 2:
                        error_5 = _a.sent();
                        logger_js_1.logger.error('Error saving OpenRouter tracking data:', error_5);
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    },
    /**
     * Save the prompting strategies to disk
     */
    savePromptingStrategies: function () {
        return __awaiter(this, void 0, void 0, function () {
            var strategiesPath, error_6;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        strategiesPath = path_1.default.join(index_js_1.config.rootDir, 'openrouter-strategies.json');
                        return [4 /*yield*/, promises_1.default.writeFile(strategiesPath, JSON.stringify(this.promptingStrategies, null, 2))];
                    case 1:
                        _a.sent();
                        logger_js_1.logger.debug('Saved OpenRouter prompting strategies to disk');
                        return [3 /*break*/, 3];
                    case 2:
                        error_6 = _a.sent();
                        logger_js_1.logger.error('Error saving OpenRouter prompting strategies:', error_6);
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    },
    /**
     * Get all available models from OpenRouter
     */
    getAvailableModels: function () {
        return __awaiter(this, void 0, void 0, function () {
            var now, lastUpdated, hoursSinceLastUpdate, models, _i, _a, _b, modelId, model, error_7;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        logger_js_1.logger.debug('Getting available models from OpenRouter');
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 4, , 5]);
                        // Check if API key is configured
                        if (!index_js_1.config.openRouterApiKey) {
                            logger_js_1.logger.warn('OpenRouter API key not configured, free models will not be available');
                            return [2 /*return*/, []];
                        }
                        now = new Date();
                        lastUpdated = new Date(this.modelTracking.lastUpdated);
                        hoursSinceLastUpdate = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60);
                        if (!(hoursSinceLastUpdate > 24)) return [3 /*break*/, 3];
                        logger_js_1.logger.info('OpenRouter models data is more than 24 hours old, updating...');
                        return [4 /*yield*/, this.updateModels()];
                    case 2:
                        _c.sent();
                        _c.label = 3;
                    case 3:
                        models = [];
                        for (_i = 0, _a = Object.entries(this.modelTracking.models); _i < _a.length; _i++) {
                            _b = _a[_i], modelId = _b[0], model = _b[1];
                            models.push({
                                id: modelId,
                                name: model.name,
                                provider: 'openrouter',
                                capabilities: {
                                    chat: model.capabilities.chat,
                                    completion: model.capabilities.completion
                                },
                                costPerToken: {
                                    prompt: model.costPerToken.prompt,
                                    completion: model.costPerToken.completion
                                },
                                contextWindow: model.contextWindow
                            });
                        }
                        return [2 /*return*/, models];
                    case 4:
                        error_7 = _c.sent();
                        this.handleOpenRouterError(error_7);
                        return [2 /*return*/, []];
                    case 5: return [2 /*return*/];
                }
            });
        });
    },
    /**
     * Get free models from OpenRouter
     */
    getFreeModels: function () {
        return __awaiter(this, void 0, void 0, function () {
            var allModels, error_8;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        logger_js_1.logger.debug('Getting free models from OpenRouter');
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        // Check if API key is configured
                        if (!index_js_1.config.openRouterApiKey) {
                            logger_js_1.logger.warn('OpenRouter API key not configured, free models will not be available');
                            return [2 /*return*/, []];
                        }
                        return [4 /*yield*/, this.getAvailableModels()];
                    case 2:
                        allModels = _a.sent();
                        // Filter for free models
                        return [2 /*return*/, allModels.filter(function (model) {
                                return _this.modelTracking.freeModels.includes(model.id);
                            })];
                    case 3:
                        error_8 = _a.sent();
                        this.handleOpenRouterError(error_8);
                        return [2 /*return*/, []];
                    case 4: return [2 /*return*/];
                }
            });
        });
    },
    /**
     * Update the prompting strategy for a model based on benchmark results
     */
    updatePromptingStrategy: function (modelId, strategy, successRate, qualityScore) {
        return __awaiter(this, void 0, void 0, function () {
            var existingStrategy, error_9;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        logger_js_1.logger.debug("Updating prompting strategy for model ".concat(modelId));
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 7, , 8]);
                        existingStrategy = this.promptingStrategies[modelId] || {
                            modelId: modelId,
                            useChat: true,
                            successRate: 0,
                            qualityScore: 0,
                            lastUpdated: new Date().toISOString()
                        };
                        if (!(successRate > existingStrategy.successRate ||
                            (successRate === existingStrategy.successRate && qualityScore > existingStrategy.qualityScore))) return [3 /*break*/, 5];
                        // Update the strategy
                        this.promptingStrategies[modelId] = __assign(__assign(__assign({}, existingStrategy), strategy), { successRate: successRate, qualityScore: qualityScore, lastUpdated: new Date().toISOString() });
                        if (!this.modelTracking.models[modelId]) return [3 /*break*/, 3];
                        this.modelTracking.models[modelId].promptingStrategy = {
                            systemPrompt: strategy.systemPrompt || existingStrategy.systemPrompt,
                            userPrompt: strategy.userPrompt || existingStrategy.userPrompt,
                            assistantPrompt: strategy.assistantPrompt || existingStrategy.assistantPrompt,
                            useChat: strategy.useChat !== undefined ? strategy.useChat : existingStrategy.useChat
                        };
                        // Save the tracking data
                        return [4 /*yield*/, this.saveTrackingData()];
                    case 2:
                        // Save the tracking data
                        _a.sent();
                        _a.label = 3;
                    case 3: 
                    // Save the prompting strategies
                    return [4 /*yield*/, this.savePromptingStrategies()];
                    case 4:
                        // Save the prompting strategies
                        _a.sent();
                        logger_js_1.logger.info("Updated prompting strategy for model ".concat(modelId, " with success rate ").concat(successRate, " and quality score ").concat(qualityScore));
                        return [3 /*break*/, 6];
                    case 5:
                        logger_js_1.logger.debug("Existing strategy for model ".concat(modelId, " is better (").concat(existingStrategy.successRate, "/").concat(existingStrategy.qualityScore, " vs ").concat(successRate, "/").concat(qualityScore, ")"));
                        _a.label = 6;
                    case 6: return [3 /*break*/, 8];
                    case 7:
                        error_9 = _a.sent();
                        logger_js_1.logger.error("Error updating prompting strategy for model ".concat(modelId, ":"), error_9);
                        return [3 /*break*/, 8];
                    case 8: return [2 /*return*/];
                }
            });
        });
    },
    /**
     * Get the best prompting strategy for a model
     */
    getPromptingStrategy: function (modelId) {
        return this.promptingStrategies[modelId];
    },
    /**
     * Handle errors from OpenRouter
     */
    handleOpenRouterError: function (error) {
        var _a, _b;
        if (axios_1.default.isAxiosError(error)) {
            var axiosError = error;
            if ((_b = (_a = axiosError.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.error) {
                var errorData = axiosError.response.data.error;
                // Handle specific error types
                if (errorData.type === 'rate_limit_exceeded') {
                    logger_js_1.logger.warn('OpenRouter rate limit exceeded:', errorData.message);
                    return types_js_1.OpenRouterErrorType.RATE_LIMIT;
                }
                else if (errorData.type === 'authentication_error') {
                    logger_js_1.logger.error('OpenRouter authentication error:', errorData.message);
                    return types_js_1.OpenRouterErrorType.AUTHENTICATION;
                }
                else if (errorData.type === 'invalid_request_error') {
                    logger_js_1.logger.error('OpenRouter invalid request error:', errorData.message);
                    return types_js_1.OpenRouterErrorType.INVALID_REQUEST;
                }
                else if (errorData.message.includes('context length')) {
                    logger_js_1.logger.warn('OpenRouter context length exceeded:', errorData.message);
                    return types_js_1.OpenRouterErrorType.CONTEXT_LENGTH_EXCEEDED;
                }
                else if (errorData.message.includes('model not found')) {
                    logger_js_1.logger.warn('OpenRouter model not found:', errorData.message);
                    return types_js_1.OpenRouterErrorType.MODEL_NOT_FOUND;
                }
                else {
                    logger_js_1.logger.error('OpenRouter error:', errorData.message);
                    return types_js_1.OpenRouterErrorType.SERVER_ERROR;
                }
            }
            else if (axiosError.response && axiosError.response.status === 429) {
                logger_js_1.logger.warn('OpenRouter rate limit exceeded');
                return types_js_1.OpenRouterErrorType.RATE_LIMIT;
            }
            else if (axiosError.response && (axiosError.response.status === 401 || axiosError.response.status === 403)) {
                logger_js_1.logger.error('OpenRouter authentication error');
                return types_js_1.OpenRouterErrorType.AUTHENTICATION;
            }
            else if (axiosError.response && axiosError.response.status === 400) {
                logger_js_1.logger.error('OpenRouter invalid request error');
                return types_js_1.OpenRouterErrorType.INVALID_REQUEST;
            }
            else if (axiosError.response && axiosError.response.status === 404) {
                logger_js_1.logger.warn('OpenRouter resource not found');
                return types_js_1.OpenRouterErrorType.MODEL_NOT_FOUND;
            }
            else if (axiosError.response && axiosError.response.status >= 500) {
                logger_js_1.logger.error('OpenRouter server error');
                return types_js_1.OpenRouterErrorType.SERVER_ERROR;
            }
        }
        logger_js_1.logger.error('Unknown OpenRouter error:', error);
        return types_js_1.OpenRouterErrorType.UNKNOWN;
    },
    /**
     * Call OpenRouter API with a task
     */
    callOpenRouterApi: function (modelId, task, timeout) {
        return __awaiter(this, void 0, void 0, function () {
            var model, strategy, controller_1, timeoutId, messages, response, error_10, errorType;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        logger_js_1.logger.debug("Calling OpenRouter API for model ".concat(modelId));
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        // Check if API key is configured
                        if (!index_js_1.config.openRouterApiKey) {
                            logger_js_1.logger.warn('OpenRouter API key not configured, free models will not be available');
                            return [2 /*return*/, { success: false, error: types_js_1.OpenRouterErrorType.AUTHENTICATION }];
                        }
                        model = this.modelTracking.models[modelId];
                        if (!model) {
                            logger_js_1.logger.warn("Model ".concat(modelId, " not found in OpenRouter tracking data"));
                            return [2 /*return*/, { success: false, error: types_js_1.OpenRouterErrorType.MODEL_NOT_FOUND }];
                        }
                        strategy = this.getPromptingStrategy(modelId) || {
                            modelId: modelId,
                            systemPrompt: 'You are a helpful assistant.',
                            useChat: true,
                            successRate: 0,
                            qualityScore: 0,
                            lastUpdated: new Date().toISOString()
                        };
                        controller_1 = new AbortController();
                        timeoutId = setTimeout(function () { return controller_1.abort(); }, timeout);
                        messages = [];
                        if (strategy.systemPrompt) {
                            messages.push({ role: 'system', content: strategy.systemPrompt });
                        }
                        if (strategy.userPrompt) {
                            messages.push({ role: 'user', content: strategy.userPrompt.replace('{{task}}', task) });
                        }
                        else {
                            messages.push({ role: 'user', content: task });
                        }
                        return [4 /*yield*/, axios_1.default.post('https://openrouter.ai/api/v1/chat/completions', {
                                model: modelId,
                                messages: messages,
                                temperature: 0.7,
                                max_tokens: 1000,
                            }, {
                                signal: controller_1.signal,
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': "Bearer ".concat(index_js_1.config.openRouterApiKey),
                                    'HTTP-Referer': 'https://locallama-mcp.local', // Required by OpenRouter
                                    'X-Title': 'LocalLama MCP'
                                },
                            })];
                    case 2:
                        response = _a.sent();
                        clearTimeout(timeoutId);
                        // Process the response
                        if (response.status === 200 && response.data.choices && response.data.choices.length > 0) {
                            return [2 /*return*/, {
                                    success: true,
                                    text: response.data.choices[0].message.content,
                                    usage: response.data.usage,
                                }];
                        }
                        else {
                            logger_js_1.logger.warn('Invalid response from OpenRouter API:', response.data);
                            return [2 /*return*/, { success: false, error: types_js_1.OpenRouterErrorType.INVALID_REQUEST }];
                        }
                        return [3 /*break*/, 4];
                    case 3:
                        error_10 = _a.sent();
                        errorType = this.handleOpenRouterError(error_10);
                        return [2 /*return*/, { success: false, error: errorType }];
                    case 4: return [2 /*return*/];
                }
            });
        });
    },
    /**
     * Benchmark a model with different prompting strategies
     */
    benchmarkPromptingStrategies: function (modelId, task, timeout) {
        return __awaiter(this, void 0, void 0, function () {
            var model, strategiesToTry, bestStrategy, bestResponse, bestQualityScore, _loop_1, this_1, _i, strategiesToTry_1, strategy, existingStrategy, error_11;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        logger_js_1.logger.debug("Benchmarking prompting strategies for model ".concat(modelId));
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 8, , 9]);
                        // Check if API key is configured
                        if (!index_js_1.config.openRouterApiKey) {
                            logger_js_1.logger.warn('OpenRouter API key not configured, free models will not be available');
                            return [2 /*return*/, {
                                    bestStrategy: {
                                        modelId: modelId,
                                        systemPrompt: 'You are a helpful assistant.',
                                        useChat: true,
                                        successRate: 0,
                                        qualityScore: 0,
                                        lastUpdated: new Date().toISOString()
                                    },
                                    success: false
                                }];
                        }
                        model = this.modelTracking.models[modelId];
                        if (!model) {
                            logger_js_1.logger.warn("Model ".concat(modelId, " not found in OpenRouter tracking data"));
                            return [2 /*return*/, {
                                    bestStrategy: {
                                        modelId: modelId,
                                        systemPrompt: 'You are a helpful assistant.',
                                        useChat: true,
                                        successRate: 0,
                                        qualityScore: 0,
                                        lastUpdated: new Date().toISOString()
                                    },
                                    success: false
                                }];
                        }
                        strategiesToTry = [
                            // Default strategy
                            {
                                systemPrompt: 'You are a helpful assistant.',
                                useChat: true
                            },
                            // Code-focused strategy
                            {
                                systemPrompt: 'You are a helpful coding assistant. Provide clear, concise code solutions.',
                                useChat: true
                            },
                            // Detailed strategy
                            {
                                systemPrompt: 'You are a helpful assistant. Provide detailed, step-by-step explanations.',
                                useChat: true
                            },
                            // Provider-specific strategy
                            DEFAULT_PROMPTING_STRATEGIES[this.getProviderFromModelId(modelId)] || DEFAULT_PROMPTING_STRATEGIES.default
                        ];
                        bestStrategy = null;
                        bestResponse = null;
                        bestQualityScore = 0;
                        _loop_1 = function (strategy) {
                            var tempStrategy, controller, timeoutId, messages, response, text, qualityScore, error_12;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        tempStrategy = {
                                            modelId: modelId,
                                            systemPrompt: strategy.systemPrompt,
                                            userPrompt: strategy.userPrompt,
                                            assistantPrompt: strategy.assistantPrompt,
                                            useChat: strategy.useChat !== undefined ? strategy.useChat : true,
                                            successRate: 0,
                                            qualityScore: 0,
                                            lastUpdated: new Date().toISOString()
                                        };
                                        controller = new AbortController();
                                        timeoutId = setTimeout(function () { return controller.abort(); }, timeout);
                                        _b.label = 1;
                                    case 1:
                                        _b.trys.push([1, 3, , 4]);
                                        messages = [];
                                        if (tempStrategy.systemPrompt) {
                                            messages.push({ role: 'system', content: tempStrategy.systemPrompt });
                                        }
                                        if (tempStrategy.userPrompt) {
                                            messages.push({ role: 'user', content: tempStrategy.userPrompt.replace('{{task}}', task) });
                                        }
                                        else {
                                            messages.push({ role: 'user', content: task });
                                        }
                                        return [4 /*yield*/, axios_1.default.post('https://openrouter.ai/api/v1/chat/completions', {
                                                model: modelId,
                                                messages: messages,
                                                temperature: 0.7,
                                                max_tokens: 1000,
                                            }, {
                                                signal: controller.signal,
                                                headers: {
                                                    'Content-Type': 'application/json',
                                                    'Authorization': "Bearer ".concat(index_js_1.config.openRouterApiKey),
                                                    'HTTP-Referer': 'https://locallama-mcp.local', // Required by OpenRouter
                                                    'X-Title': 'LocalLama MCP'
                                                },
                                            })];
                                    case 2:
                                        response = _b.sent();
                                        clearTimeout(timeoutId);
                                        // Process the response
                                        if (response.status === 200 && response.data.choices && response.data.choices.length > 0) {
                                            text = response.data.choices[0].message.content;
                                            qualityScore = this_1.evaluateQuality(task, text);
                                            // Update the strategy with the results
                                            tempStrategy.successRate = 1;
                                            tempStrategy.qualityScore = qualityScore;
                                            // Check if this is the best strategy so far
                                            if (qualityScore > bestQualityScore) {
                                                bestStrategy = tempStrategy;
                                                bestResponse = {
                                                    success: true,
                                                    text: text,
                                                    usage: response.data.usage
                                                };
                                                bestQualityScore = qualityScore;
                                            }
                                        }
                                        return [3 /*break*/, 4];
                                    case 3:
                                        error_12 = _b.sent();
                                        clearTimeout(timeoutId);
                                        logger_js_1.logger.debug("Error trying prompting strategy for model ".concat(modelId, ":"), error_12);
                                        return [3 /*break*/, 4];
                                    case 4: return [2 /*return*/];
                                }
                            });
                        };
                        this_1 = this;
                        _i = 0, strategiesToTry_1 = strategiesToTry;
                        _a.label = 2;
                    case 2:
                        if (!(_i < strategiesToTry_1.length)) return [3 /*break*/, 5];
                        strategy = strategiesToTry_1[_i];
                        return [5 /*yield**/, _loop_1(strategy)];
                    case 3:
                        _a.sent();
                        _a.label = 4;
                    case 4:
                        _i++;
                        return [3 /*break*/, 2];
                    case 5:
                        if (!(bestStrategy && bestQualityScore > 0)) return [3 /*break*/, 7];
                        return [4 /*yield*/, this.updatePromptingStrategy(modelId, {
                                systemPrompt: bestStrategy.systemPrompt,
                                userPrompt: bestStrategy.userPrompt,
                                assistantPrompt: bestStrategy.assistantPrompt,
                                useChat: bestStrategy.useChat
                            }, bestStrategy.successRate, bestStrategy.qualityScore)];
                    case 6:
                        _a.sent();
                        return [2 /*return*/, {
                                bestStrategy: bestStrategy,
                                success: true,
                                text: bestResponse === null || bestResponse === void 0 ? void 0 : bestResponse.text,
                                usage: bestResponse === null || bestResponse === void 0 ? void 0 : bestResponse.usage
                            }];
                    case 7:
                        existingStrategy = this.getPromptingStrategy(modelId) || {
                            modelId: modelId,
                            systemPrompt: 'You are a helpful assistant.',
                            useChat: true,
                            successRate: 0,
                            qualityScore: 0,
                            lastUpdated: new Date().toISOString()
                        };
                        return [2 /*return*/, {
                                bestStrategy: existingStrategy,
                                success: false
                            }];
                    case 8:
                        error_11 = _a.sent();
                        logger_js_1.logger.error("Error benchmarking prompting strategies for model ".concat(modelId, ":"), error_11);
                        return [2 /*return*/, {
                                bestStrategy: {
                                    modelId: modelId,
                                    systemPrompt: 'You are a helpful assistant.',
                                    useChat: true,
                                    successRate: 0,
                                    qualityScore: 0,
                                    lastUpdated: new Date().toISOString()
                                },
                                success: false
                            }];
                    case 9: return [2 /*return*/];
                }
            });
        });
    },
    /**
     * Evaluate the quality of a response
     */
    evaluateQuality: function (task, response) {
        // This is a placeholder implementation
        // In a real implementation, this would use a more sophisticated evaluation method
        // Simple heuristics for quality evaluation:
        // 1. Response length relative to task length
        var lengthScore = Math.min(1, response.length / (task.length * 0.8));
        // 2. Response contains code if task asks for code
        var codeScore = task.toLowerCase().includes('code') && response.includes('```') ? 1 : 0.5;
        // 3. Response structure (paragraphs, bullet points, etc.)
        var structureScore = (response.includes('\n\n') ||
            response.includes('- ') ||
            response.includes('1. ')) ? 1 : 0.7;
        // Combine scores with weights
        return (lengthScore * 0.4) + (codeScore * 0.3) + (structureScore * 0.3);
    }
};
