"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.LogLevel = void 0;
var index_js_1 = require("../config/index.js");
/**
 * Log levels
 */
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["ERROR"] = 0] = "ERROR";
    LogLevel[LogLevel["WARN"] = 1] = "WARN";
    LogLevel[LogLevel["INFO"] = 2] = "INFO";
    LogLevel[LogLevel["DEBUG"] = 3] = "DEBUG";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
/**
 * Convert string log level to enum
 */
function getLogLevelFromString(level) {
    switch (level.toLowerCase()) {
        case 'error':
            return LogLevel.ERROR;
        case 'warn':
            return LogLevel.WARN;
        case 'info':
            return LogLevel.INFO;
        case 'debug':
            return LogLevel.DEBUG;
        default:
            return LogLevel.INFO;
    }
}
/**
 * Current log level from configuration
 */
var currentLogLevel = getLogLevelFromString(index_js_1.config.logLevel);
/**
 * Simple logger utility
 */
exports.logger = {
    error: function (message) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        if (currentLogLevel >= LogLevel.ERROR) {
            console.error.apply(console, __spreadArray(["[ERROR] ".concat(message)], args, false));
        }
    },
    warn: function (message) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        if (currentLogLevel >= LogLevel.WARN) {
            console.warn.apply(console, __spreadArray(["[WARN] ".concat(message)], args, false));
        }
    },
    info: function (message) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        if (currentLogLevel >= LogLevel.INFO) {
            console.info.apply(console, __spreadArray(["[INFO] ".concat(message)], args, false));
        }
    },
    debug: function (message) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        if (currentLogLevel >= LogLevel.DEBUG) {
            console.debug.apply(console, __spreadArray(["[DEBUG] ".concat(message)], args, false));
        }
    },
    /**
     * Log a message with a specific log level
     */
    log: function (level, message) {
        var args = [];
        for (var _i = 2; _i < arguments.length; _i++) {
            args[_i - 2] = arguments[_i];
        }
        switch (level) {
            case LogLevel.ERROR:
                exports.logger.error.apply(exports.logger, __spreadArray([message], args, false));
                break;
            case LogLevel.WARN:
                exports.logger.warn.apply(exports.logger, __spreadArray([message], args, false));
                break;
            case LogLevel.INFO:
                exports.logger.info.apply(exports.logger, __spreadArray([message], args, false));
                break;
            case LogLevel.DEBUG:
                exports.logger.debug.apply(exports.logger, __spreadArray([message], args, false));
                break;
        }
    },
};
