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
exports.setupResourceHandlers = setupResourceHandlers;
var types_js_1 = require("@modelcontextprotocol/sdk/types.js");
var index_js_1 = require("../cost-monitor/index.js");
var index_js_2 = require("../openrouter/index.js");
var index_js_3 = require("../../config/index.js");
var logger_js_1 = require("../../utils/logger.js");
/**
 * Check if OpenRouter API key is configured
 */
function isOpenRouterConfigured() {
    return !!index_js_3.config.openRouterApiKey;
}
/**
 * Set up resource handlers for the MCP Server
 *
 * Resources provide data about the current state of the system,
 * such as token usage, costs, and available models.
 */
function setupResourceHandlers(server) {
    var _this = this;
    // List available static resources
    server.setRequestHandler(types_js_1.ListResourcesRequestSchema, function () { return __awaiter(_this, void 0, void 0, function () {
        var resources;
        return __generator(this, function (_a) {
            logger_js_1.logger.debug('Listing available resources');
            resources = [
                {
                    uri: 'locallama://status',
                    name: 'LocalLama MCP Server Status',
                    mimeType: 'application/json',
                    description: 'Current status of the LocalLama MCP Server',
                },
                {
                    uri: 'locallama://models',
                    name: 'Available Models',
                    mimeType: 'application/json',
                    description: 'List of available local LLM models',
                },
            ];
            // Add OpenRouter resources if API key is configured
            if (isOpenRouterConfigured()) {
                resources.push({
                    uri: 'locallama://openrouter/models',
                    name: 'OpenRouter Models',
                    mimeType: 'application/json',
                    description: 'List of available models from OpenRouter',
                }, {
                    uri: 'locallama://openrouter/free-models',
                    name: 'OpenRouter Free Models',
                    mimeType: 'application/json',
                    description: 'List of free models available from OpenRouter',
                }, {
                    uri: 'locallama://openrouter/status',
                    name: 'OpenRouter Integration Status',
                    mimeType: 'application/json',
                    description: 'Status of the OpenRouter integration',
                });
            }
            return [2 /*return*/, { resources: resources }];
        });
    }); });
    // List available resource templates
    server.setRequestHandler(types_js_1.ListResourceTemplatesRequestSchema, function () { return __awaiter(_this, void 0, void 0, function () {
        var resourceTemplates;
        return __generator(this, function (_a) {
            logger_js_1.logger.debug('Listing available resource templates');
            resourceTemplates = [
                {
                    uriTemplate: 'locallama://usage/{api}',
                    name: 'API Usage Statistics',
                    mimeType: 'application/json',
                    description: 'Token usage and cost statistics for a specific API',
                },
            ];
            // Add OpenRouter resource templates if API key is configured
            if (isOpenRouterConfigured()) {
                resourceTemplates.push({
                    uriTemplate: 'locallama://openrouter/model/{modelId}',
                    name: 'OpenRouter Model Details',
                    mimeType: 'application/json',
                    description: 'Details about a specific OpenRouter model',
                }, {
                    uriTemplate: 'locallama://openrouter/prompting-strategy/{modelId}',
                    name: 'OpenRouter Prompting Strategy',
                    mimeType: 'application/json',
                    description: 'Prompting strategy for a specific OpenRouter model',
                });
            }
            return [2 /*return*/, { resourceTemplates: resourceTemplates }];
        });
    }); });
    // Handle resource requests
    server.setRequestHandler(types_js_1.ReadResourceRequestSchema, function (request) { return __awaiter(_this, void 0, void 0, function () {
        var uri, models, error_1, models, error_2, freeModels, error_3, error_4, usageMatch, api, usage, error_5, modelMatch, modelId, model, error_6, strategyMatch, modelId, strategy, error_7;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    uri = request.params.uri;
                    logger_js_1.logger.debug("Reading resource: ".concat(uri));
                    // Handle static resources
                    if (uri === 'locallama://status') {
                        return [2 /*return*/, {
                                contents: [
                                    {
                                        uri: uri,
                                        mimeType: 'application/json',
                                        text: JSON.stringify({
                                            status: 'running',
                                            version: '1.2.5',
                                            uptime: process.uptime(),
                                            timestamp: new Date().toISOString(),
                                        }, null, 2),
                                    },
                                ],
                            }];
                    }
                    if (!(uri === 'locallama://models')) return [3 /*break*/, 4];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, index_js_1.costMonitor.getAvailableModels()];
                case 2:
                    models = _a.sent();
                    return [2 /*return*/, {
                            contents: [
                                {
                                    uri: uri,
                                    mimeType: 'application/json',
                                    text: JSON.stringify(models, null, 2),
                                },
                            ],
                        }];
                case 3:
                    error_1 = _a.sent();
                    logger_js_1.logger.error('Failed to get available models:', error_1);
                    throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, "Failed to get available models: ".concat(error_1 instanceof Error ? error_1.message : String(error_1)));
                case 4:
                    if (!(uri === 'locallama://openrouter/models')) return [3 /*break*/, 10];
                    _a.label = 5;
                case 5:
                    _a.trys.push([5, 9, , 10]);
                    // Check if OpenRouter API key is configured
                    if (!isOpenRouterConfigured()) {
                        throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidRequest, 'OpenRouter API key not configured');
                    }
                    if (!(Object.keys(index_js_2.openRouterModule.modelTracking.models).length === 0)) return [3 /*break*/, 7];
                    return [4 /*yield*/, index_js_2.openRouterModule.initialize()];
                case 6:
                    _a.sent();
                    _a.label = 7;
                case 7: return [4 /*yield*/, index_js_2.openRouterModule.getAvailableModels()];
                case 8:
                    models = _a.sent();
                    return [2 /*return*/, {
                            contents: [
                                {
                                    uri: uri,
                                    mimeType: 'application/json',
                                    text: JSON.stringify(models, null, 2),
                                },
                            ],
                        }];
                case 9:
                    error_2 = _a.sent();
                    logger_js_1.logger.error('Failed to get OpenRouter models:', error_2);
                    throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, "Failed to get OpenRouter models: ".concat(error_2 instanceof Error ? error_2.message : String(error_2)));
                case 10:
                    if (!(uri === 'locallama://openrouter/free-models')) return [3 /*break*/, 16];
                    _a.label = 11;
                case 11:
                    _a.trys.push([11, 15, , 16]);
                    // Check if OpenRouter API key is configured
                    if (!isOpenRouterConfigured()) {
                        throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidRequest, 'OpenRouter API key not configured');
                    }
                    if (!(Object.keys(index_js_2.openRouterModule.modelTracking.models).length === 0)) return [3 /*break*/, 13];
                    return [4 /*yield*/, index_js_2.openRouterModule.initialize()];
                case 12:
                    _a.sent();
                    _a.label = 13;
                case 13: return [4 /*yield*/, index_js_2.openRouterModule.getFreeModels()];
                case 14:
                    freeModels = _a.sent();
                    return [2 /*return*/, {
                            contents: [
                                {
                                    uri: uri,
                                    mimeType: 'application/json',
                                    text: JSON.stringify(freeModels, null, 2),
                                },
                            ],
                        }];
                case 15:
                    error_3 = _a.sent();
                    logger_js_1.logger.error('Failed to get OpenRouter free models:', error_3);
                    throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, "Failed to get OpenRouter free models: ".concat(error_3 instanceof Error ? error_3.message : String(error_3)));
                case 16:
                    if (!(uri === 'locallama://openrouter/status')) return [3 /*break*/, 21];
                    _a.label = 17;
                case 17:
                    _a.trys.push([17, 20, , 21]);
                    // Check if OpenRouter API key is configured
                    if (!isOpenRouterConfigured()) {
                        return [2 /*return*/, {
                                contents: [
                                    {
                                        uri: uri,
                                        mimeType: 'application/json',
                                        text: JSON.stringify({
                                            status: 'not_configured',
                                            message: 'OpenRouter API key not configured',
                                            timestamp: new Date().toISOString(),
                                        }, null, 2),
                                    },
                                ],
                            }];
                    }
                    if (!(Object.keys(index_js_2.openRouterModule.modelTracking.models).length === 0)) return [3 /*break*/, 19];
                    return [4 /*yield*/, index_js_2.openRouterModule.initialize()];
                case 18:
                    _a.sent();
                    _a.label = 19;
                case 19: return [2 /*return*/, {
                        contents: [
                            {
                                uri: uri,
                                mimeType: 'application/json',
                                text: JSON.stringify({
                                    status: 'running',
                                    modelsCount: Object.keys(index_js_2.openRouterModule.modelTracking.models).length,
                                    freeModelsCount: index_js_2.openRouterModule.modelTracking.freeModels.length,
                                    lastUpdated: index_js_2.openRouterModule.modelTracking.lastUpdated,
                                    timestamp: new Date().toISOString(),
                                }, null, 2),
                            },
                        ],
                    }];
                case 20:
                    error_4 = _a.sent();
                    logger_js_1.logger.error('Failed to get OpenRouter status:', error_4);
                    throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, "Failed to get OpenRouter status: ".concat(error_4 instanceof Error ? error_4.message : String(error_4)));
                case 21:
                    usageMatch = uri.match(/^locallama:\/\/usage\/(.+)$/);
                    if (!usageMatch) return [3 /*break*/, 25];
                    api = usageMatch[1];
                    _a.label = 22;
                case 22:
                    _a.trys.push([22, 24, , 25]);
                    return [4 /*yield*/, index_js_1.costMonitor.getApiUsage(api)];
                case 23:
                    usage = _a.sent();
                    return [2 /*return*/, {
                            contents: [
                                {
                                    uri: uri,
                                    mimeType: 'application/json',
                                    text: JSON.stringify(usage, null, 2),
                                },
                            ],
                        }];
                case 24:
                    error_5 = _a.sent();
                    logger_js_1.logger.error("Failed to get usage for API ".concat(api, ":"), error_5);
                    throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, "Failed to get usage for API ".concat(api, ": ").concat(error_5 instanceof Error ? error_5.message : String(error_5)));
                case 25:
                    modelMatch = uri.match(/^locallama:\/\/openrouter\/model\/(.+)$/);
                    if (!modelMatch) return [3 /*break*/, 30];
                    _a.label = 26;
                case 26:
                    _a.trys.push([26, 29, , 30]);
                    // Check if OpenRouter API key is configured
                    if (!isOpenRouterConfigured()) {
                        throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidRequest, 'OpenRouter API key not configured');
                    }
                    modelId = decodeURIComponent(modelMatch[1]);
                    if (!(Object.keys(index_js_2.openRouterModule.modelTracking.models).length === 0)) return [3 /*break*/, 28];
                    return [4 /*yield*/, index_js_2.openRouterModule.initialize()];
                case 27:
                    _a.sent();
                    _a.label = 28;
                case 28:
                    model = index_js_2.openRouterModule.modelTracking.models[modelId];
                    if (!model) {
                        throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidRequest, "Model not found: ".concat(modelId));
                    }
                    return [2 /*return*/, {
                            contents: [
                                {
                                    uri: uri,
                                    mimeType: 'application/json',
                                    text: JSON.stringify(model, null, 2),
                                },
                            ],
                        }];
                case 29:
                    error_6 = _a.sent();
                    logger_js_1.logger.error('Failed to get OpenRouter model details:', error_6);
                    throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, "Failed to get OpenRouter model details: ".concat(error_6 instanceof Error ? error_6.message : String(error_6)));
                case 30:
                    strategyMatch = uri.match(/^locallama:\/\/openrouter\/prompting-strategy\/(.+)$/);
                    if (!strategyMatch) return [3 /*break*/, 35];
                    _a.label = 31;
                case 31:
                    _a.trys.push([31, 34, , 35]);
                    // Check if OpenRouter API key is configured
                    if (!isOpenRouterConfigured()) {
                        throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidRequest, 'OpenRouter API key not configured');
                    }
                    modelId = decodeURIComponent(strategyMatch[1]);
                    if (!(Object.keys(index_js_2.openRouterModule.modelTracking.models).length === 0)) return [3 /*break*/, 33];
                    return [4 /*yield*/, index_js_2.openRouterModule.initialize()];
                case 32:
                    _a.sent();
                    _a.label = 33;
                case 33:
                    strategy = index_js_2.openRouterModule.getPromptingStrategy(modelId);
                    if (!strategy) {
                        // Return default strategy if no specific strategy is found
                        return [2 /*return*/, {
                                contents: [
                                    {
                                        uri: uri,
                                        mimeType: 'application/json',
                                        text: JSON.stringify({
                                            modelId: modelId,
                                            systemPrompt: 'You are a helpful assistant.',
                                            useChat: true,
                                            successRate: 0,
                                            qualityScore: 0,
                                            lastUpdated: new Date().toISOString(),
                                            note: 'Default strategy (no specific strategy found for this model)'
                                        }, null, 2),
                                    },
                                ],
                            }];
                    }
                    return [2 /*return*/, {
                            contents: [
                                {
                                    uri: uri,
                                    mimeType: 'application/json',
                                    text: JSON.stringify(strategy, null, 2),
                                },
                            ],
                        }];
                case 34:
                    error_7 = _a.sent();
                    logger_js_1.logger.error('Failed to get OpenRouter prompting strategy:', error_7);
                    throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, "Failed to get OpenRouter prompting strategy: ".concat(error_7 instanceof Error ? error_7.message : String(error_7)));
                case 35: 
                // Resource not found
                throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidRequest, "Resource not found: ".concat(uri));
            }
        });
    }); });
}
