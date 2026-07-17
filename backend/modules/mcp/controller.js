'use strict';

const { handleMcpHttpRequest } = require('./httpTransport');
const { listToolsByCategory } = require('./toolRegistry');

/**
 * Get MCP configuration for Claude Desktop
 * Returns JSON that user can paste into Claude Desktop config
 */
async function getMcpConfig(req, res) {
    try {
        // Get base URL from request
        const protocol = req.protocol;
        const host = req.get('host');
        const baseUrl = `${protocol}://${host}`;

        // Generate HTTP-based config for remote access
        const claudeConfig = {
            mcpServers: {
                tududi: {
                    command: 'npx',
                    args: [
                        '-y',
                        'mcp-remote',
                        `${baseUrl}/api/mcp`,
                        '--header',
                        'Authorization:Bearer ${TUDUDI_API_TOKEN}',
                    ],
                    env: {
                        TUDUDI_API_TOKEN: 'YOUR_API_TOKEN_HERE',
                    },
                },
            },
        };

        res.json(claudeConfig);
    } catch (error) {
        console.error('Error generating MCP config:', error);
        res.status(500).json({
            error: 'Failed to generate MCP configuration',
            message: error.message,
        });
    }
}

/**
 * Handle MCP protocol message
 * This is called by the POST /api/mcp endpoint
 */
async function handleMcpMessage(req, res) {
    try {
        const user = req.mcpUser;

        // Delegate to HTTP transport handler
        await handleMcpHttpRequest(req, res, user);
    } catch (error) {
        console.error('Error handling MCP message:', error);

        // Only send response if headers haven't been sent
        if (!res.headersSent) {
            res.status(500).json({
                error: 'Failed to process MCP message',
                message: error.message,
            });
        }
    }
}

/**
 * Get MCP feature flag status
 */
async function getMcpStatus(req, res) {
    const mcpEnabled = process.env.FF_ENABLE_MCP === 'true';
    res.json({ enabled: mcpEnabled });
}

/**
 * List available MCP tools
 */
async function listMcpTools(req, res) {
    const tools = listToolsByCategory();
    res.json({ tools });
}

module.exports = {
    getMcpConfig,
    getMcpStatus,
    listMcpTools,
    handleMcpMessage,
};
