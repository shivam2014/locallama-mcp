#!/usr/bin/env node

/**
 * Model Selector Script
 * 
 * This script helps users select which models they want to benchmark
 * based on their available API providers and local LLM installations.
 */

import { costMonitor } from './dist/modules/cost-monitor/index.js';
import { logger } from './dist/utils/logger.js';
import fs from 'fs/promises';
import readline from 'readline';

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Define common models by provider
const modelsByProvider = {
  // OpenAI models
  openai: [
    'gpt-3.5-turbo',
    'gpt-3.5-turbo-instruct',
    'gpt-4-turbo',
    'gpt-4o',
  ],
  
  // Anthropic models
  anthropic: [
    'claude-3-opus-20240229',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307',
    'claude-instant-1.2',
  ],
  
  // Google models
  google: [
    'gemini-1.5-pro',
    'gemini-1.5-flash',
    'gemini-1.0-pro',
  ],
  
  // Mistral models
  mistral: [
    'mistral-large-latest',
    'mistral-medium-latest',
    'mistral-small-latest',
    'mistral-7b-instruct',
  ],
  
  // Meta models
  meta: [
    'llama-2-70b-chat',
    'llama-2-13b-chat',
    'llama-3-70b-instruct',
    'llama-3-8b-instruct',
  ],
  
  // Cohere models
  cohere: [
    'command-r',
    'command-r-plus',
  ],
  
  // Other models
  other: [
    'codestral-r1',
    'deepseek-coder',
  ]
};

// Define common local LLM models
const localModels = [
  'qwen2.5-coder-3b-instruct',
  'llama3',
  'codellama:7b-instruct',
  'mistral:7b-instruct-v0.2',
  'phi3:mini',
  'deepseek-coder:6.7b-instruct',
  'neural-chat:7b',
  'wizardcoder:7b-python',
  'stable-code:3b',
  'openchat:7b',
];

/**
 * Ask the user which API providers they have access to
 */
async function askForProviders() {
  return new Promise((resolve) => {
    console.log('\nWhich API providers do you have access to? (Enter numbers separated by spaces)');
    
    const providers = Object.keys(modelsByProvider);
    providers.forEach((provider, index) => {
      console.log(`${index + 1}. ${provider.charAt(0).toUpperCase() + provider.slice(1)}`);
    });
    
    rl.question('> ', (answer) => {
      const selectedIndices = answer.split(' ').map(num => parseInt(num.trim(), 10) - 1);
      const selectedProviders = selectedIndices
        .filter(index => index >= 0 && index < providers.length)
        .map(index => providers[index]);
      
      resolve(selectedProviders);
    });
  });
}

/**
 * Ask the user which models they want to benchmark for each provider
 */
async function askForModels(providers) {
  const selectedModels = [];
  
  for (const provider of providers) {
    const models = modelsByProvider[provider];
    
    console.log(`\nWhich ${provider} models do you want to benchmark? (Enter numbers separated by spaces, or 'all')`);
    models.forEach((model, index) => {
      console.log(`${index + 1}. ${model}`);
    });
    
    const answer = await new Promise((resolve) => {
      rl.question('> ', (answer) => resolve(answer.trim()));
    });
    
    if (answer.toLowerCase() === 'all') {
      selectedModels.push(...models);
    } else {
      const selectedIndices = answer.split(' ').map(num => parseInt(num.trim(), 10) - 1);
      const providerModels = selectedIndices
        .filter(index => index >= 0 && index < models.length)
        .map(index => models[index]);
      
      selectedModels.push(...providerModels);
    }
  }
  
  return selectedModels;
}

/**
 * Ask the user which local LLM models they have installed
 */
async function askForLocalModels() {
  console.log('\nWhich local LLM models do you have installed? (Enter numbers separated by spaces, or \'all\')');
  
  localModels.forEach((model, index) => {
    console.log(`${index + 1}. ${model}`);
  });
  
  return new Promise((resolve) => {
    rl.question('> ', (answer) => {
      if (answer.toLowerCase() === 'all') {
        resolve(localModels);
      } else {
        const selectedIndices = answer.split(' ').map(num => parseInt(num.trim(), 10) - 1);
        const selectedModels = selectedIndices
          .filter(index => index >= 0 && index < localModels.length)
          .map(index => localModels[index]);
        
        resolve(selectedModels);
      }
    });
  });
}

/**
 * Ask if the user wants to add custom models
 */
async function askForCustomModels() {
  console.log('\nDo you want to add any custom models? (y/n)');
  
  const answer = await new Promise((resolve) => {
    rl.question('> ', (answer) => resolve(answer.trim().toLowerCase()));
  });
  
  if (answer === 'y' || answer === 'yes') {
    console.log('\nEnter custom models (comma-separated):');
    
    return new Promise((resolve) => {
      rl.question('> ', (answer) => {
        const customModels = answer.split(',').map(model => model.trim()).filter(model => model.length > 0);
        resolve(customModels);
      });
    });
  }
  
  return [];
}

/**
 * Save the selected models to a configuration file
 */
async function saveModelConfig(paidModels, localModels) {
  const config = {
    paidModels,
    localModels,
    timestamp: new Date().toISOString()
  };
  
  try {
    await fs.writeFile('./benchmark-models.json', JSON.stringify(config, null, 2));
    console.log('\nModel configuration saved to benchmark-models.json');
  } catch (error) {
    console.error('Error saving model configuration:', error);
  }
}

/**
 * Main function
 */
async function main() {
  console.log('Welcome to the Model Selector for LocalLama MCP Benchmarking');
  console.log('This tool will help you select which models to benchmark.');
  
  // Check for available local models
  console.log('\nChecking for available local models...');
  try {
    const availableModels = await costMonitor.getAvailableModels();
    const availableLocalModels = availableModels.filter(model => 
      model.provider === 'local' || 
      model.provider === 'lm-studio' || 
      model.provider === 'ollama'
    );
    
    if (availableLocalModels.length > 0) {
      console.log('\nDetected local models:');
      availableLocalModels.forEach(model => {
        console.log(`- ${model.id} (${model.provider})`);
      });
    } else {
      console.log('\nNo local models detected automatically.');
    }
  } catch (error) {
    console.log('\nCould not automatically detect local models.');
  }
  
  // Ask for API providers
  const selectedProviders = await askForProviders();
  
  // Ask for models for each provider
  const selectedPaidModels = await askForModels(selectedProviders);
  
  // Ask for local models
  const selectedLocalModels = await askForLocalModels();
  
  // Ask for custom models
  const customPaidModels = await askForCustomModels();
  const allPaidModels = [...selectedPaidModels, ...customPaidModels];
  
  // Save configuration
  await saveModelConfig(allPaidModels, selectedLocalModels);
  
  console.log('\nModel selection complete!');
  console.log(`Selected ${allPaidModels.length} paid API models and ${selectedLocalModels.length} local LLM models.`);
  console.log('\nYou can now run the benchmark with:');
  console.log('node run-benchmarks.js comprehensive');
  
  rl.close();
}

// Run the main function
main().catch(console.error);