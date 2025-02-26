// Test script to verify OpenRouter free model functionality
console.log('Testing OpenRouter free model functionality');

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

// Function to test a free model with a simple task
async function testFreeModel(modelId) {
  try {
    console.log(`Testing free model: ${modelId}`);
    
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
      console.log(`✅ Successfully tested free model: ${modelId}`);
      console.log('Response:');
      console.log(response.data.choices[0].message.content);
      console.log('Token usage:');
      console.log(response.data.usage);
      return true;
    } else {
      console.error(`❌ Invalid response from free model: ${modelId}`);
      console.error(response.data);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error testing free model ${modelId}:`, error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
    return false;
  }
}

// Main function to run the test
async function main() {
  console.log('=== OpenRouter Free Model Test ===');
  
  // Get all models from OpenRouter
  const allModels = await getOpenRouterModels();
  if (allModels.length === 0) {
    console.error('❌ No models retrieved from OpenRouter, cannot proceed with test');
    process.exit(1);
  }
  
  // Identify free models
  const freeModels = identifyFreeModels(allModels);
  console.log(`Found ${freeModels.length} free models out of ${allModels.length} total models`);
  
  if (freeModels.length === 0) {
    console.log('⚠️ No free models found in OpenRouter');
    console.log('This could be normal as OpenRouter may not have any free models available at the moment');
    process.exit(0);
  }
  
  // Display free models
  console.log('\nFree models:');
  freeModels.forEach((model, index) => {
    console.log(`${index + 1}. ${model.id} (${model.name || 'Unnamed'})`);
    console.log(`   Context window: ${model.context_length || 'Unknown'}`);
    console.log(`   Features: ${JSON.stringify(model.features || {})}`);
  });
  
  // Test the first free model
  if (freeModels.length > 0) {
    console.log('\n=== Testing a Free Model ===');
    const testModel = freeModels[0];
    console.log(`Selected model for testing: ${testModel.id} (${testModel.name || 'Unnamed'})`);
    
    const success = await testFreeModel(testModel.id);
    
    if (success) {
      console.log('\n✅ Free model test completed successfully');
      
      // Save the free model information to a file
      const freeModelInfo = {
        timestamp: new Date().toISOString(),
        totalModels: allModels.length,
        freeModels: freeModels.map(model => ({
          id: model.id,
          name: model.name || 'Unnamed',
          contextWindow: model.context_length || 'Unknown',
          features: model.features || {}
        })),
        testedModel: testModel.id
      };
      
      await fs.writeFile(
        path.join(process.cwd(), 'openrouter-free-models-test-result.json'),
        JSON.stringify(freeModelInfo, null, 2)
      );
      
      console.log('Free model information saved to openrouter-free-models-test-result.json');
    } else {
      console.error('\n❌ Free model test failed');
    }
  }
}

// Run the test
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});