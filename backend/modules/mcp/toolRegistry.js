'use strict';

const { registerTaskTools } = require('./tools/taskTools');
const { registerProjectTools } = require('./tools/projectTools');
const { registerInboxTools } = require('./tools/inboxTools');
const { registerMiscTools } = require('./tools/miscTools');
const { registerHabitTools } = require('./tools/habitTools');
const { registerAreaTools } = require('./tools/areaTools');
const { registerTagTools } = require('./tools/tagTools');
const { registerNoteTools } = require('./tools/noteTools');

const CATEGORIES_MAP = {
    Tasks: registerTaskTools,
    Projects: registerProjectTools,
    Areas: registerAreaTools,
    Habits: registerHabitTools,
    Inbox: registerInboxTools,
    Notes: registerNoteTools,
    Tags: registerTagTools,
    Misc: registerMiscTools,
};

/**
 * Register all MCP tools with the server
 * @param {Object} server - MCP server instance
 * @param {Object} context - User context {userId, user, apiToken}
 * @param {Array} tools - Tools registry array
 */
function registerAllTools(server, context, tools) {
    for (const registerFn of Object.values(CATEGORIES_MAP)) {
        registerFn(server, context, tools);
    }
}

/**
 * List all tool names and descriptions from the registry
 * @returns {Array<{name: string, description: string}>}
 */
function listToolNames() {
    const tools = [];
    registerAllTools(null, { userId: null, user: null }, tools);
    return tools.map((t) => ({
        name: t.name,
        description: t.description,
    }));
}

/**
 * List tools categorized by domain, matching the frontend requirement
 * @returns {Array<{category: string, count: number, tools: string[]}>}
 */
function listToolsByCategory() {
    const dummyServer = {};
    const dummyContext = { userId: null, user: null };
    const result = [];

    for (const [category, registerFn] of Object.entries(CATEGORIES_MAP)) {
        const categoryTools = [];
        registerFn(dummyServer, dummyContext, categoryTools);
        result.push({
            category,
            count: categoryTools.length,
            tools: categoryTools.map((t) => t.name),
        });
    }

    return result;
}

module.exports = {
    registerAllTools,
    listToolNames,
    listToolsByCategory,
};
