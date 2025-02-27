#!/usr/bin/env node
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get the OpenRouter API key from environment variables or config file
async function getOpenRouterApiKey() {
  // Try to get from environment variable first
  let apiKey = process.env.OPENROUTER_API_KEY;
  
  if (!apiKey) {
    try {
      // Try to read from MCP settings
      const homeDir = process.env.HOME || process.env.USERPROFILE;
      const mcpSettingsPath = path.join(homeDir, 'Library', 'Application Support', 'Code', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline', 'settings', 'cline_mcp_settings.json');
      
      const mcpSettingsData = await fs.readFile(mcpSettingsPath, 'utf8');
      const mcpSettings = JSON.parse(mcpSettingsData);
      
      if (mcpSettings.mcpServers && mcpSettings.mcpServers['locallama-mcp'] && mcpSettings.mcpServers['locallama-mcp'].env) {
        apiKey = mcpSettings.mcpServers['locallama-mcp'].env.OPENROUTER_API_KEY;
      }
    } catch (error) {
      console.error('Error reading MCP settings:', error);
    }
  }
  
  return apiKey;
}

// Fetch models from OpenRouter API
async function fetchOpenRouterModels(apiKey) {
  console.log('Fetching models from OpenRouter API...');
  
  try {
    const response = await axios.get('https://openrouter.ai/api/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://locallama-mcp.local',
        'X-Title': 'LocalLama MCP Diagnostic'
      }
    });
    
    console.log(`API Response Status: ${response.status}`);
    
    if (response.data && Array.isArray(response.data.data)) {
      const models = response.data.data;
      console.log(`Found ${models.length} models from OpenRouter`);
      
      // Identify free models
      const freeModels = [];
      
      for (const model of models) {
        console.log(`\nModel: ${model.id}`);
        console.log(`Pricing: ${JSON.stringify(model.pricing, null, 2)}`);
        
        // Check if the model is free - using a more robust approach
        const promptPrice = parseFloat(model.pricing?.prompt || "0");
        const completionPrice = parseFloat(model.pricing?.completion || "0");
        
        // Adding epsilon comparison for floating point precision
        const EPSILON = 0.00000000001; // Small threshold to handle floating-point precision
        const isFree = promptPrice < EPSILON && completionPrice < EPSILON;
        
        console.log(`Prompt cost: ${promptPrice}, Completion cost: ${completionPrice}`);
        console.log(`Is Free: ${isFree}`);
        
        if (isFree) {
          freeModels.push(model);
        }
      }
      
      console.log(`\nFound ${freeModels.length} free models:`);
      for (const model of freeModels) {
        console.log(`- ${model.id} (${model.name || 'Unnamed'})`);
      }
      
      // Save the results to a file for reference
      await fs.writeFile('openrouter-models-test-result.json', JSON.stringify({
        timestamp: new Date().toISOString(),
        totalModels: models.length,
        freeModels: freeModels.map(m => ({
          id: m.id,
          name: m.name,
          pricing: m.pricing
        }))
      }, null, 2));
      
      console.log('\nResults saved to openrouter-models-test-result.json');
      
      return { models, freeModels };
    } else {
      console.error('Invalid response format from OpenRouter API');
      console.log('Response data:', JSON.stringify(response.data, null, 2));
      return { models: [], freeModels: [] };
    }
  } catch (error) {
    console.error('Error fetching models from OpenRouter API:');
    
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error(`Status: ${error.response.status}`);
      console.error(`Headers: ${JSON.stringify(error.response.headers, null, 2)}`);
      console.error(`Data: ${JSON.stringify(error.response.data, null, 2)}`);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received from server');
      console.error(error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Error setting up request:', error.message);
    }
    
    return { models: [], freeModels: [] };
  }
}

// Test a free model with a simple task
async function testFreeModel(apiKey, modelId) {
  console.log(`\nTesting model: ${modelId}`);
  
  // Test with different complexity tasks
  const tasks = [
    {
      name: "Simple function",
      prompt: "Write a function to calculate the factorial of a number.",
      complexity: 0.2
    },
    {
      name: "Medium algorithm",
      prompt: "Implement a binary search algorithm and explain its time complexity.",
      complexity: 0.5
    }
  ];
  
  const results = [];
  
  for (const task of tasks) {
    console.log(`\nTask: ${task.name} (complexity: ${task.complexity})`);
    console.log(`Prompt: ${task.prompt}`);
    
    try {
      const startTime = Date.now();
      
      const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
        model: modelId,
        messages: [
          { role: "system", content: "You are a helpful coding assistant." },
          { role: "user", content: task.prompt }
        ],
        max_tokens: 500
      }, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://locallama-mcp.local',
          'X-Title': 'LocalLama MCP Diagnostic'
        }
      });
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      console.log(`Response time: ${responseTime}ms`);
      console.log(`Response status: ${response.status}`);
      
      if (response.data && response.data.choices && response.data.choices.length > 0) {
        const content = response.data.choices[0].message.content;
        console.log(`Response content (first 100 chars): ${content.substring(0, 100)}...`);
        
        // Simple quality check - does it contain code?
        const hasCode = content.includes('function') ||
                        content.includes('def ') ||
                        content.includes('class ');
        
        console.log(`Contains code: ${hasCode}`);
        
        results.push({
          task: task.name,
          complexity: task.complexity,
          success: true,
          responseTime,
          hasCode,
          contentPreview: content.substring(0, 100)
        });
      } else {
        console.error('Invalid response format');
        results.push({
          task: task.name,
          complexity: task.complexity,
          success: false,
          error: 'Invalid response format'
        });
      }
    } catch (error) {
      console.error('Error testing model:');
      
      if (error.response) {
        console.error(`Status: ${error.response.status}`);
        console.error(`Data: ${JSON.stringify(error.response.data, null, 2)}`);
      } else if (error.request) {
        console.error('No response received from server');
      } else {
        console.error('Error setting up request:', error.message);
      }
      
      results.push({
        task: task.name,
        complexity: task.complexity,
        success: false,
        error: error.message
      });
    }
  }
  
  return results;
}

// Main function
async function main() {
  console.log('OpenRouter Free Models Diagnostic Tool');
  console.log('=====================================\n');
  
  // Get API key
  const apiKey = await getOpenRouterApiKey();
  
  if (!apiKey) {
    console.error('Error: OpenRouter API key not found. Please set the OPENROUTER_API_KEY environment variable or configure it in the MCP settings.');
    process.exit(1);
  }
  
  console.log(`Using API key: ${apiKey.substring(0, 10)}...`);
  
  // Fetch models
  const { freeModels } = await fetchOpenRouterModels(apiKey);
  
  if (freeModels.length === 0) {
    console.log('No free models found to test.');
    return;
  }
  
  // Ask user if they want to test the free models
  console.log('\nWould you like to test the free models? This will make API calls to OpenRouter. (y/n)');
  
  // Since we can't get user input in this script directly, we'll default to yes
  // In a real scenario, you'd use readline or process.argv to get user input
  const testModels = true;
  
  if (testModels) {
    // Test a subset of free models (to avoid excessive API calls)
    console.log('\nTesting free models with simple and medium complexity tasks...');
    
    // Prioritize models from well-known providers
    const preferredProviders = ['google', 'meta-llama', 'mistralai', 'deepseek', 'microsoft'];
    const preferredModels = freeModels.filter(model =>
      preferredProviders.some(provider => model.id.toLowerCase().includes(provider))
    );
    
    // Select up to 3 preferred models
    const modelsToTest = preferredModels.slice(0, 3);
    
    // If we have fewer than 3 preferred models, add some others
    if (modelsToTest.length < 3) {
      const otherModels = freeModels.filter(model =>
        !preferredProviders.some(provider => model.id.toLowerCase().includes(provider))
      );
      
      modelsToTest.push(...otherModels.slice(0, 3 - modelsToTest.length));
    }
    
    console.log(`Selected ${modelsToTest.length} models for testing:`);
    modelsToTest.forEach(model => console.log(`- ${model.id} (${model.name || 'Unnamed'})`));
    
    // Test each model
    const testResults = [];
    for (const model of modelsToTest) {
      const results = await testFreeModel(apiKey, model.id);
      testResults.push({
        modelId: model.id,
        modelName: model.name || 'Unnamed',
        results
      });
    }
    
    // Calculate performance metrics
    const performanceData = testResults.map(result => {
      const modelResults = result.results;
      
      // Calculate average response time for successful tasks
      const successfulTasks = modelResults.filter(r => r.success);
      const avgResponseTime = successfulTasks.length > 0
        ? successfulTasks.reduce((sum, r) => sum + r.responseTime, 0) / successfulTasks.length
        : 0;
      
      // Calculate success rate
      const successRate = modelResults.length > 0
        ? successfulTasks.length / modelResults.length
        : 0;
      
      // Calculate code quality (percentage of responses that contain code)
      const codeQuality = successfulTasks.length > 0
        ? successfulTasks.filter(r => r.hasCode).length / successfulTasks.length
        : 0;
      
      return {
        modelId: result.modelId,
        modelName: result.modelName,
        avgResponseTime,
        successRate,
        codeQuality,
        taskResults: modelResults
      };
    });
    
    // Save test results
    await fs.writeFile('openrouter-free-models-test-results.json', JSON.stringify({
      timestamp: new Date().toISOString(),
      performanceData,
      detailedResults: testResults
    }, null, 2));
    
    console.log('\nTest results saved to openrouter-free-models-test-results.json');
    
    // Print performance summary
    console.log('\nPerformance Summary:');
    console.log('-------------------');
    
    for (const data of performanceData) {
      console.log(`\nModel: ${data.modelName} (${data.modelId})`);
      console.log(`Average Response Time: ${data.avgResponseTime.toFixed(0)}ms`);
      console.log(`Success Rate: ${(data.successRate * 100).toFixed(0)}%`);
      console.log(`Code Quality: ${(data.codeQuality * 100).toFixed(0)}%`);
    }
  } else {
    console.log('Skipping model testing.');
  }
}

// Run the main function
main().catch(console.error);