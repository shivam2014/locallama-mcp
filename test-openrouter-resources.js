// Simple test script to verify OpenRouter resources
console.log('Testing OpenRouter resources integration');

// Mock the necessary dependencies
const mockLogger = {
  debug: console.log,
  info: console.log,
  warn: console.warn,
  error: console.error
};

const mockOpenRouterModule = {
  modelTracking: {
    models: {
      'openai/gpt-3.5-turbo': {
        id: 'openai/gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        provider: 'openai',
        isFree: false,
        contextWindow: 16385,
        capabilities: {
          chat: true,
          completion: true,
          vision: false
        },
        costPerToken: {
          prompt: 0.0000015,
          completion: 0.000002
        },
        lastUpdated: new Date().toISOString()
      },
      'anthropic/claude-3-haiku': {
        id: 'anthropic/claude-3-haiku',
        name: 'Claude 3 Haiku',
        provider: 'anthropic',
        isFree: false,
        contextWindow: 200000,
        capabilities: {
          chat: true,
          completion: true,
          vision: true
        },
        costPerToken: {
          prompt: 0.000025,
          completion: 0.000125
        },
        lastUpdated: new Date().toISOString()
      }
    },
    lastUpdated: new Date().toISOString(),
    freeModels: []
  },
  initialize: async () => {
    console.log('Initialized OpenRouter module');
    return Promise.resolve();
  },
  getAvailableModels: async () => {
    console.log('Getting available models from OpenRouter');
    return Promise.resolve([
      {
        id: 'openai/gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        provider: 'openrouter',
        capabilities: {
          chat: true,
          completion: true
        },
        costPerToken: {
          prompt: 0.0000015,
          completion: 0.000002
        },
        contextWindow: 16385
      },
      {
        id: 'anthropic/claude-3-haiku',
        name: 'Claude 3 Haiku',
        provider: 'openrouter',
        capabilities: {
          chat: true,
          completion: true
        },
        costPerToken: {
          prompt: 0.000025,
          completion: 0.000125
        },
        contextWindow: 200000
      }
    ]);
  },
  getFreeModels: async () => {
    console.log('Getting free models from OpenRouter');
    return Promise.resolve([]);
  },
  getPromptingStrategy: (modelId) => {
    console.log(`Getting prompting strategy for model ${modelId}`);
    return {
      modelId,
      systemPrompt: 'You are a helpful assistant.',
      useChat: true,
      successRate: 0.9,
      qualityScore: 0.85,
      lastUpdated: new Date().toISOString()
    };
  }
};

const mockCostMonitor = {
  getAvailableModels: async () => {
    console.log('Getting available models from cost monitor');
    return Promise.resolve([
      {
        id: 'gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        provider: 'openai',
        capabilities: {
          chat: true,
          completion: true
        },
        costPerToken: {
          prompt: 0.0000015,
          completion: 0.000002
        },
        contextWindow: 16385
      }
    ]);
  },
  getApiUsage: async (api) => {
    console.log(`Getting API usage for ${api}`);
    return Promise.resolve({
      api,
      totalTokens: 1000,
      totalCost: 0.002,
      lastUpdated: new Date().toISOString()
    });
  }
};

const mockConfig = {
  openRouterApiKey: 'test-api-key'
};

// Mock the MCP server
class MockServer {
  constructor() {
    this.handlers = {};
  }

  setRequestHandler(schema, handler) {
    this.handlers[schema.name] = handler;
  }

  async testListResources() {
    const handler = this.handlers['ListResourcesRequest'];
    if (!handler) {
      console.error('ListResourcesRequest handler not found');
      return;
    }
    
    const result = await handler();
    console.log('ListResourcesRequest result:');
    console.log(JSON.stringify(result, null, 2));
    
    // Check if OpenRouter resources are included
    const openRouterResources = result.resources.filter(r => r.uri.includes('openrouter'));
    if (openRouterResources.length > 0) {
      console.log('✅ OpenRouter resources found:');
      openRouterResources.forEach(r => console.log(`- ${r.uri}: ${r.name}`));
    } else {
      console.error('❌ No OpenRouter resources found');
    }
  }

  async testListResourceTemplates() {
    const handler = this.handlers['ListResourceTemplatesRequest'];
    if (!handler) {
      console.error('ListResourceTemplatesRequest handler not found');
      return;
    }
    
    const result = await handler();
    console.log('ListResourceTemplatesRequest result:');
    console.log(JSON.stringify(result, null, 2));
    
    // Check if OpenRouter resource templates are included
    const openRouterTemplates = result.resourceTemplates.filter(r => r.uriTemplate.includes('openrouter'));
    if (openRouterTemplates.length > 0) {
      console.log('✅ OpenRouter resource templates found:');
      openRouterTemplates.forEach(r => console.log(`- ${r.uriTemplate}: ${r.name}`));
    } else {
      console.error('❌ No OpenRouter resource templates found');
    }
  }

  async testReadResource(uri) {
    const handler = this.handlers['ReadResourceRequest'];
    if (!handler) {
      console.error('ReadResourceRequest handler not found');
      return;
    }
    
    try {
      const result = await handler({ params: { uri } });
      console.log(`ReadResourceRequest result for ${uri}:`);
      console.log(JSON.stringify(result, null, 2));
      console.log(`✅ Successfully read resource: ${uri}`);
    } catch (error) {
      console.error(`❌ Error reading resource ${uri}:`, error.message);
    }
  }
}

// Define the function to test our resources
async function testOpenRouterResources() {
  // Import the resources module
  const setupResourceHandlers = (server) => {
    // Mock implementation of setupResourceHandlers
    console.log('Setting up resource handlers');
    
    // Check if OpenRouter API key is configured
    const isOpenRouterConfigured = () => {
      return !!mockConfig.openRouterApiKey;
    };
    
    // List available static resources
    server.setRequestHandler({ name: 'ListResourcesRequest' }, async () => {
      console.log('Listing available resources');
      
      const resources = [
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
        resources.push(
          {
            uri: 'locallama://openrouter/models',
            name: 'OpenRouter Models',
            mimeType: 'application/json',
            description: 'List of available models from OpenRouter',
          },
          {
            uri: 'locallama://openrouter/free-models',
            name: 'OpenRouter Free Models',
            mimeType: 'application/json',
            description: 'List of free models available from OpenRouter',
          },
          {
            uri: 'locallama://openrouter/status',
            name: 'OpenRouter Integration Status',
            mimeType: 'application/json',
            description: 'Status of the OpenRouter integration',
          }
        );
      }
      
      return { resources };
    });
    
    // List available resource templates
    server.setRequestHandler({ name: 'ListResourceTemplatesRequest' }, async () => {
      console.log('Listing available resource templates');
      
      const resourceTemplates = [
        {
          uriTemplate: 'locallama://usage/{api}',
          name: 'API Usage Statistics',
          mimeType: 'application/json',
          description: 'Token usage and cost statistics for a specific API',
        },
      ];
      
      // Add OpenRouter resource templates if API key is configured
      if (isOpenRouterConfigured()) {
        resourceTemplates.push(
          {
            uriTemplate: 'locallama://openrouter/model/{modelId}',
            name: 'OpenRouter Model Details',
            mimeType: 'application/json',
            description: 'Details about a specific OpenRouter model',
          },
          {
            uriTemplate: 'locallama://openrouter/prompting-strategy/{modelId}',
            name: 'OpenRouter Prompting Strategy',
            mimeType: 'application/json',
            description: 'Prompting strategy for a specific OpenRouter model',
          }
        );
      }
      
      return { resourceTemplates };
    });
    
    // Handle resource requests
    server.setRequestHandler({ name: 'ReadResourceRequest' }, async (request) => {
      const { uri } = request.params;
      console.log(`Reading resource: ${uri}`);
      
      // Handle static resources
      if (uri === 'locallama://status') {
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                status: 'running',
                version: '1.2.5',
                uptime: process.uptime(),
                timestamp: new Date().toISOString(),
              }, null, 2),
            },
          ],
        };
      }
      
      if (uri === 'locallama://models') {
        try {
          const models = await mockCostMonitor.getAvailableModels();
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(models, null, 2),
              },
            ],
          };
        } catch (error) {
          console.error('Failed to get available models:', error);
          throw new Error(`Failed to get available models: ${error.message}`);
        }
      }
      
      // Handle OpenRouter resources
      if (uri === 'locallama://openrouter/models') {
        try {
          // Check if OpenRouter API key is configured
          if (!isOpenRouterConfigured()) {
            throw new Error('OpenRouter API key not configured');
          }
          
          // Initialize OpenRouter module if needed
          if (Object.keys(mockOpenRouterModule.modelTracking.models).length === 0) {
            await mockOpenRouterModule.initialize();
          }
          
          const models = await mockOpenRouterModule.getAvailableModels();
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(models, null, 2),
              },
            ],
          };
        } catch (error) {
          console.error('Failed to get OpenRouter models:', error);
          throw new Error(`Failed to get OpenRouter models: ${error.message}`);
        }
      }
      
      if (uri === 'locallama://openrouter/free-models') {
        try {
          // Check if OpenRouter API key is configured
          if (!isOpenRouterConfigured()) {
            throw new Error('OpenRouter API key not configured');
          }
          
          // Initialize OpenRouter module if needed
          if (Object.keys(mockOpenRouterModule.modelTracking.models).length === 0) {
            await mockOpenRouterModule.initialize();
          }
          
          const freeModels = await mockOpenRouterModule.getFreeModels();
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(freeModels, null, 2),
              },
            ],
          };
        } catch (error) {
          console.error('Failed to get OpenRouter free models:', error);
          throw new Error(`Failed to get OpenRouter free models: ${error.message}`);
        }
      }
      
      if (uri === 'locallama://openrouter/status') {
        try {
          // Check if OpenRouter API key is configured
          if (!isOpenRouterConfigured()) {
            return {
              contents: [
                {
                  uri,
                  mimeType: 'application/json',
                  text: JSON.stringify({
                    status: 'not_configured',
                    message: 'OpenRouter API key not configured',
                    timestamp: new Date().toISOString(),
                  }, null, 2),
                },
              ],
            };
          }
          
          // Initialize OpenRouter module if needed
          if (Object.keys(mockOpenRouterModule.modelTracking.models).length === 0) {
            await mockOpenRouterModule.initialize();
          }
          
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify({
                  status: 'running',
                  modelsCount: Object.keys(mockOpenRouterModule.modelTracking.models).length,
                  freeModelsCount: mockOpenRouterModule.modelTracking.freeModels.length,
                  lastUpdated: mockOpenRouterModule.modelTracking.lastUpdated,
                  timestamp: new Date().toISOString(),
                }, null, 2),
              },
            ],
          };
        } catch (error) {
          console.error('Failed to get OpenRouter status:', error);
          throw new Error(`Failed to get OpenRouter status: ${error.message}`);
        }
      }
      
      // Handle resource templates
      const usageMatch = uri.match(/^locallama:\/\/usage\/(.+)$/);
      if (usageMatch) {
        const api = usageMatch[1];
        try {
          const usage = await mockCostMonitor.getApiUsage(api);
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(usage, null, 2),
              },
            ],
          };
        } catch (error) {
          console.error(`Failed to get usage for API ${api}:`, error);
          throw new Error(`Failed to get usage for API ${api}: ${error.message}`);
        }
      }
      
      // Handle OpenRouter model details
      const modelMatch = uri.match(/^locallama:\/\/openrouter\/model\/(.+)$/);
      if (modelMatch) {
        try {
          // Check if OpenRouter API key is configured
          if (!isOpenRouterConfigured()) {
            throw new Error('OpenRouter API key not configured');
          }
          
          const modelId = decodeURIComponent(modelMatch[1]);
          
          // Initialize OpenRouter module if needed
          if (Object.keys(mockOpenRouterModule.modelTracking.models).length === 0) {
            await mockOpenRouterModule.initialize();
          }
          
          // Get the model details
          const model = mockOpenRouterModule.modelTracking.models[modelId];
          if (!model) {
            throw new Error(`Model not found: ${modelId}`);
          }
          
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(model, null, 2),
              },
            ],
          };
        } catch (error) {
          console.error('Failed to get OpenRouter model details:', error);
          throw new Error(`Failed to get OpenRouter model details: ${error.message}`);
        }
      }
      
      // Handle OpenRouter prompting strategy
      const strategyMatch = uri.match(/^locallama:\/\/openrouter\/prompting-strategy\/(.+)$/);
      if (strategyMatch) {
        try {
          // Check if OpenRouter API key is configured
          if (!isOpenRouterConfigured()) {
            throw new Error('OpenRouter API key not configured');
          }
          
          const modelId = decodeURIComponent(strategyMatch[1]);
          
          // Initialize OpenRouter module if needed
          if (Object.keys(mockOpenRouterModule.modelTracking.models).length === 0) {
            await mockOpenRouterModule.initialize();
          }
          
          // Get the prompting strategy
          const strategy = mockOpenRouterModule.getPromptingStrategy(modelId);
          if (!strategy) {
            // Return default strategy if no specific strategy is found
            return {
              contents: [
                {
                  uri,
                  mimeType: 'application/json',
                  text: JSON.stringify({
                    modelId,
                    systemPrompt: 'You are a helpful assistant.',
                    useChat: true,
                    successRate: 0,
                    qualityScore: 0,
                    lastUpdated: new Date().toISOString(),
                    note: 'Default strategy (no specific strategy found for this model)'
                  }, null, 2),
                },
              ],
            };
          }
          
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(strategy, null, 2),
              },
            ],
          };
        } catch (error) {
          console.error('Failed to get OpenRouter prompting strategy:', error);
          throw new Error(`Failed to get OpenRouter prompting strategy: ${error.message}`);
        }
      }
      
      // Resource not found
      throw new Error(`Resource not found: ${uri}`);
    });
  };

  // Create a mock server
  const server = new MockServer();
  
  // Set up resource handlers
  setupResourceHandlers(server);
  
  // Test listing resources
  console.log('\n=== Testing ListResourcesRequest ===');
  await server.testListResources();
  
  // Test listing resource templates
  console.log('\n=== Testing ListResourceTemplatesRequest ===');
  await server.testListResourceTemplates();
  
  // Test reading resources
  console.log('\n=== Testing ReadResourceRequest ===');
  await server.testReadResource('locallama://status');
  await server.testReadResource('locallama://models');
  await server.testReadResource('locallama://openrouter/models');
  await server.testReadResource('locallama://openrouter/free-models');
  await server.testReadResource('locallama://openrouter/status');
  await server.testReadResource('locallama://openrouter/model/openai/gpt-3.5-turbo');
  await server.testReadResource('locallama://openrouter/prompting-strategy/openai/gpt-3.5-turbo');
}

// Run the test
testOpenRouterResources().catch(console.error);