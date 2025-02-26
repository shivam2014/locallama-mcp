// Test script to verify OpenRouter low-cost model functionality
console.log('Testing OpenRouter low-cost model functionality');

// Import required modules
import axios from 'axios';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Check if OpenRouter API key is configured
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
if (!OPENROUTER_API_KEY) {
  console.error('❌ OpenRouter API key not configured in .env file');
  process.exit(1);
}

// Function to query OpenRouter for available models
async function getOpenRouterModels() {
  try {
    console.log('Querying OpenRouter for available models...');
    
    const response = await axios.get('https://openrouter.ai/api/v1/models', {
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://locallama-mcp.local',
        'X-Title': 'LocalLama MCP Test'
      }
    });
    
    if (response.data && Array.isArray(response.data.data)) {
      console.log(`✅ Successfully retrieved ${response.data.data.length} models from OpenRouter`);
      return response.data.data;
    } else {
      console.error('❌ Invalid response format from OpenRouter API');
      console.error(response.data);
      return [];
    }
  } catch (error) {
    console.error('❌ Error querying OpenRouter API:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
    return [];
  }
}

// Function to identify free models
function identifyFreeModels(models) {
  const freeModels = models.filter(model => {
    const isFree = model.pricing?.prompt === 0 && model.pricing?.completion === 0;
    return isFree;
  });
  
  return freeModels;
}

// Function to identify low-cost models
function identifyLowCostModels(models, threshold = 0.000005) {
  const lowCostModels = models.filter(model => {
    const promptCost = model.pricing?.prompt || 0;
    const completionCost = model.pricing?.completion || 0;
    
    // Check if either prompt or completion cost is below threshold
    return (promptCost > 0 && promptCost <= threshold) || 
           (completionCost > 0 && completionCost <= threshold);
  });
  
  // Sort by cost (lowest first)
  lowCostModels.sort((a, b) => {
    const aCost = (a.pricing?.prompt || 0) + (a.pricing?.completion || 0);
    const bCost = (b.pricing?.prompt || 0) + (b.pricing?.completion || 0);
    return aCost - bCost;
  });
  
  return lowCostModels;
}

// Function to test a model with a simple task
async function testModel(modelId) {
  try {
    console.log(`Testing model: ${modelId}`);
    
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: modelId,
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Write a short poem about coding.' }
        ],
        temperature: 0.7,
        max_tokens: 150,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://locallama-mcp.local',
          'X-Title': 'LocalLama MCP Test'
        },
      }
    );
    
    if (response.status === 200 && response.data.choices && response.data.choices.length > 0) {
      console.log(`✅ Successfully tested model: ${modelId}`);
      console.log('Response:');
      console.log(response.data.choices[0].message.content);
      console.log('Token usage:');
      console.log(response.data.usage);
      
      // Calculate cost
      const promptTokens = response.data.usage.prompt_tokens;
      const completionTokens = response.data.usage.completion_tokens;
      const model = await getModelDetails(modelId);
      const promptCost = (model?.pricing?.prompt || 0) * promptTokens;
      const completionCost = (model?.pricing?.completion || 0) * completionTokens;
      const totalCost = promptCost + completionCost;
      
      console.log(`Estimated cost: $${totalCost.toFixed(6)} (Prompt: $${promptCost.toFixed(6)}, Completion: $${completionCost.toFixed(6)})`);
      
      return {
        success: true,
        response: response.data.choices[0].message.content,
        usage: response.data.usage,
        cost: {
          prompt: promptCost,
          completion: completionCost,
          total: totalCost
        }
      };
    } else {
      console.error(`❌ Invalid response from model: ${modelId}`);
      console.error(response.data);
      return { success: false };
    }
  } catch (error) {
    console.error(`❌ Error testing model ${modelId}:`, error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
    return { success: false, error: error.message };
  }
}

// Function to get model details
async function getModelDetails(modelId) {
  try {
    const allModels = await getOpenRouterModels();
    return allModels.find(model => model.id === modelId);
  } catch (error) {
    console.error(`Error getting model details for ${modelId}:`, error.message);
    return null;
  }
}

// Main function to run the test
async function main() {
  console.log('=== OpenRouter Low-Cost Model Test ===');
  
  // Get all models from OpenRouter
  const allModels = await getOpenRouterModels();
  if (allModels.length === 0) {
    console.error('❌ No models retrieved from OpenRouter, cannot proceed with test');
    process.exit(1);
  }
  
  // Identify free models
  const freeModels = identifyFreeModels(allModels);
  console.log(`Found ${freeModels.length} free models out of ${allModels.length} total models`);
  
  // Identify low-cost models
  const lowCostModels = identifyLowCostModels(allModels);
  console.log(`Found ${lowCostModels.length} low-cost models out of ${allModels.length} total models`);
  
  // Display free models if any
  if (freeModels.length > 0) {
    console.log('\nFree models:');
    freeModels.forEach((model, index) => {
      console.log(`${index + 1}. ${model.id} (${model.name || 'Unnamed'})`);
      console.log(`   Context window: ${model.context_length || 'Unknown'}`);
      console.log(`   Features: ${JSON.stringify(model.features || {})}`);
    });
  } else {
    console.log('⚠️ No free models found in OpenRouter');
    console.log('This could be normal as OpenRouter may not have any free models available at the moment');
  }
  
  // Display low-cost models
  if (lowCostModels.length > 0) {
    console.log('\nLow-cost models (sorted by cost):');
    lowCostModels.forEach((model, index) => {
      console.log(`${index + 1}. ${model.id} (${model.name || 'Unnamed'})`);
      console.log(`   Pricing: prompt=$${model.pricing?.prompt}, completion=$${model.pricing?.completion}`);
      console.log(`   Context window: ${model.context_length || 'Unknown'}`);
      console.log(`   Features: ${JSON.stringify(model.features || {})}`);
    });
  } else {
    console.log('⚠️ No low-cost models found in OpenRouter');
  }
  
  // Test models
  const modelsToTest = [];
  
  // Add a free model if available
  if (freeModels.length > 0) {
    modelsToTest.push(freeModels[0]);
  }
  
  // Add a low-cost model if available
  if (lowCostModels.length > 0) {
    // Only add if it's not already in the list
    if (modelsToTest.length === 0 || modelsToTest[0].id !== lowCostModels[0].id) {
      modelsToTest.push(lowCostModels[0]);
    }
  }
  
  // Test the models
  const testResults = [];
  
  for (const model of modelsToTest) {
    console.log(`\n=== Testing Model: ${model.id} ===`);
    console.log(`Model: ${model.id} (${model.name || 'Unnamed'})`);
    console.log(`Pricing: prompt=$${model.pricing?.prompt}, completion=$${model.pricing?.completion}`);
    
    const result = await testModel(model.id);
    testResults.push({
      modelId: model.id,
      modelName: model.name || 'Unnamed',
      pricing: model.pricing,
      result
    });
  }
  
  // Save the test results to a file
  const testResultsData = {
    timestamp: new Date().toISOString(),
    totalModels: allModels.length,
    freeModelsCount: freeModels.length,
    lowCostModelsCount: lowCostModels.length,
    freeModels: freeModels.map(model => ({
      id: model.id,
      name: model.name || 'Unnamed',
      contextWindow: model.context_length || 'Unknown',
      features: model.features || {}
    })),
    lowCostModels: lowCostModels.slice(0, 5).map(model => ({
      id: model.id,
      name: model.name || 'Unnamed',
      pricing: model.pricing,
      contextWindow: model.context_length || 'Unknown',
      features: model.features || {}
    })),
    testResults
  };
  
  await fs.writeFile(
    path.join(process.cwd(), 'openrouter-models-test-result.json'),
    JSON.stringify(testResultsData, null, 2)
  );
  
  console.log('\n✅ Test completed');
  console.log('Test results saved to openrouter-models-test-result.json');
  
  // Summary
  console.log('\n=== Test Summary ===');
  console.log(`Total models: ${allModels.length}`);
  console.log(`Free models: ${freeModels.length}`);
  console.log(`Low-cost models: ${lowCostModels.length}`);
  console.log(`Models tested: ${testResults.length}`);
  
  testResults.forEach(result => {
    console.log(`\n${result.modelId} (${result.modelName}):`);
    console.log(`Success: ${result.result.success}`);
    if (result.result.cost) {
      console.log(`Cost: $${result.result.cost.total.toFixed(6)}`);
    }
  });
}

// Run the test
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});