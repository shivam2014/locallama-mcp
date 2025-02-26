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
  await fetchOpenRouterModels(apiKey);
}

// Run the main function
main().catch(console.error);