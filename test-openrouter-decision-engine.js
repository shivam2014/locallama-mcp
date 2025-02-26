// Test script to verify OpenRouter integration with the decision engine
console.log('Testing OpenRouter integration with the decision engine');

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

// Function to call the route_task tool
async function routeTask(task, contextLength, expectedOutputLength, complexity, priority = 'cost') {
  try {
    console.log(`Routing task with priority: ${priority}`);
    console.log(`Task: ${task}`);
    console.log(`Context length: ${contextLength}`);
    console.log(`Expected output length: ${expectedOutputLength}`);
    console.log(`Complexity: ${complexity}`);
    
    // Call the route_task endpoint
    const response = await axios.post('http://localhost:3000/mcp/tools/route_task', {
      task,
      context_length: contextLength,
      expected_output_length: expectedOutputLength,
      complexity,
      priority
    });
    
    if (response.status === 200) {
      console.log('✅ Successfully routed task');
      return response.data;
    } else {
      console.error(`❌ Error routing task: ${response.status}`);
      console.error(response.data);
      return null;
    }
  } catch (error) {
    console.error('❌ Error calling route_task tool:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
    return null;
  }
}

// Function to call the preemptive_route_task tool
async function preemptiveRouteTask(task, contextLength, expectedOutputLength, complexity, priority = 'cost') {
  try {
    console.log(`Preemptively routing task with priority: ${priority}`);
    console.log(`Task: ${task}`);
    console.log(`Context length: ${contextLength}`);
    console.log(`Expected output length: ${expectedOutputLength}`);
    console.log(`Complexity: ${complexity}`);
    
    // Call the preemptive_route_task endpoint
    const response = await axios.post('http://localhost:3000/mcp/tools/preemptive_route_task', {
      task,
      context_length: contextLength,
      expected_output_length: expectedOutputLength,
      complexity,
      priority
    });
    
    if (response.status === 200) {
      console.log('✅ Successfully preemptively routed task');
      return response.data;
    } else {
      console.error(`❌ Error preemptively routing task: ${response.status}`);
      console.error(response.data);
      return null;
    }
  } catch (error) {
    console.error('❌ Error calling preemptive_route_task tool:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
    return null;
  }
}

// Function to test the decision engine with different scenarios
async function testDecisionEngine() {
  // Define test scenarios
  const testScenarios = [
    {
      name: 'Simple task with cost priority',
      task: 'Write a function to calculate the factorial of a number',
      contextLength: 500,
      expectedOutputLength: 200,
      complexity: 0.2,
      priority: 'cost'
    },
    {
      name: 'Medium task with cost priority',
      task: 'Implement a binary search tree with insert, delete, and search operations',
      contextLength: 2000,
      expectedOutputLength: 800,
      complexity: 0.5,
      priority: 'cost'
    },
    {
      name: 'Complex task with cost priority',
      task: 'Design a distributed system for handling high-throughput data processing with fault tolerance',
      contextLength: 5000,
      expectedOutputLength: 2000,
      complexity: 0.8,
      priority: 'cost'
    },
    {
      name: 'Simple task with quality priority',
      task: 'Write a function to calculate the factorial of a number',
      contextLength: 500,
      expectedOutputLength: 200,
      complexity: 0.2,
      priority: 'quality'
    },
    {
      name: 'Medium task with quality priority',
      task: 'Implement a binary search tree with insert, delete, and search operations',
      contextLength: 2000,
      expectedOutputLength: 800,
      complexity: 0.5,
      priority: 'quality'
    },
    {
      name: 'Complex task with quality priority',
      task: 'Design a distributed system for handling high-throughput data processing with fault tolerance',
      contextLength: 5000,
      expectedOutputLength: 2000,
      complexity: 0.8,
      priority: 'quality'
    },
    {
      name: 'Simple task with speed priority',
      task: 'Write a function to calculate the factorial of a number',
      contextLength: 500,
      expectedOutputLength: 200,
      complexity: 0.2,
      priority: 'speed'
    },
    {
      name: 'Medium task with speed priority',
      task: 'Implement a binary search tree with insert, delete, and search operations',
      contextLength: 2000,
      expectedOutputLength: 800,
      complexity: 0.5,
      priority: 'speed'
    },
    {
      name: 'Complex task with speed priority',
      task: 'Design a distributed system for handling high-throughput data processing with fault tolerance',
      contextLength: 5000,
      expectedOutputLength: 2000,
      complexity: 0.8,
      priority: 'speed'
    }
  ];
  
  // Test results
  const results = [];
  
  // Test each scenario
  for (const scenario of testScenarios) {
    console.log(`\n=== Testing Scenario: ${scenario.name} ===`);
    
    // Test with regular routing
    console.log('\n--- Regular Routing ---');
    const regularResult = await routeTask(
      scenario.task,
      scenario.contextLength,
      scenario.expectedOutputLength,
      scenario.complexity,
      scenario.priority
    );
    
    // Test with preemptive routing
    console.log('\n--- Preemptive Routing ---');
    const preemptiveResult = await preemptiveRouteTask(
      scenario.task,
      scenario.contextLength,
      scenario.expectedOutputLength,
      scenario.complexity,
      scenario.priority
    );
    
    // Store results
    results.push({
      scenario: scenario.name,
      regularRouting: regularResult,
      preemptiveRouting: preemptiveResult
    });
  }
  
  // Save results to file
  await fs.writeFile(
    path.join(process.cwd(), 'openrouter-decision-engine-test-result.json'),
    JSON.stringify(results, null, 2)
  );
  
  console.log('\n✅ Test completed');
  console.log('Test results saved to openrouter-decision-engine-test-result.json');
  
  // Analyze results
  console.log('\n=== Test Summary ===');
  
  // Count how many times OpenRouter models were selected
  let openRouterSelectedCount = 0;
  let totalTests = 0;
  
  for (const result of results) {
    totalTests += 2; // Regular and preemptive routing
    
    if (result.regularRouting && result.regularRouting.model && result.regularRouting.model.provider === 'openrouter') {
      openRouterSelectedCount++;
    }
    
    if (result.preemptiveRouting && result.preemptiveRouting.model && result.preemptiveRouting.model.provider === 'openrouter') {
      openRouterSelectedCount++;
    }
  }
  
  console.log(`Total tests: ${totalTests}`);
  console.log(`OpenRouter models selected: ${openRouterSelectedCount} (${(openRouterSelectedCount / totalTests * 100).toFixed(2)}%)`);
  
  // Print detailed results
  console.log('\n=== Detailed Results ===');
  
  for (const result of results) {
    console.log(`\nScenario: ${result.scenario}`);
    
    if (result.regularRouting) {
      console.log('Regular Routing:');
      console.log(`  Model: ${result.regularRouting.model?.id || 'N/A'} (${result.regularRouting.model?.provider || 'N/A'})`);
      console.log(`  Reason: ${result.regularRouting.reason || 'N/A'}`);
    } else {
      console.log('Regular Routing: Failed');
    }
    
    if (result.preemptiveRouting) {
      console.log('Preemptive Routing:');
      console.log(`  Model: ${result.preemptiveRouting.model?.id || 'N/A'} (${result.preemptiveRouting.model?.provider || 'N/A'})`);
      console.log(`  Reason: ${result.preemptiveRouting.reason || 'N/A'}`);
    } else {
      console.log('Preemptive Routing: Failed');
    }
  }
}

// Main function
async function main() {
  console.log('=== OpenRouter Decision Engine Integration Test ===');
  
  try {
    // Test the decision engine
    await testDecisionEngine();
  } catch (error) {
    console.error('Unhandled error:', error);
  }
}

// Run the test
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});