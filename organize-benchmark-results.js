#!/usr/bin/env node

/**
 * This script organizes benchmark results into subdirectories based on their type.
 * It helps keep the benchmark-results directory clean and organized.
 * 
 * Usage:
 *   node organize-benchmark-results.js
 */

const fs = require('fs');
const path = require('path');

// Configuration
const BENCHMARK_DIR = './benchmark-results';
const CATEGORIES = {
  'simple-function': 'simple-tasks',
  'simple-validation': 'simple-tasks',
  'medium-algorithm': 'medium-tasks',
  'medium-api': 'medium-tasks',
  'complex-async': 'complex-tasks',
  'complex-design-pattern': 'complex-tasks',
  'summary': 'summaries',
  'comprehensive': 'summaries',
  'benchmark-report': 'reports'
};

// Create directories if they don't exist
function createDirectories() {
  const uniqueDirs = [...new Set(Object.values(CATEGORIES))];
  
  uniqueDirs.forEach(dir => {
    const dirPath = path.join(BENCHMARK_DIR, dir);
    if (!fs.existsSync(dirPath)) {
      console.log(`Creating directory: ${dirPath}`);
      fs.mkdirSync(dirPath, { recursive: true });
    }
  });
}

// Organize files into appropriate directories
function organizeFiles() {
  // Get all files in the benchmark directory
  const files = fs.readdirSync(BENCHMARK_DIR);
  
  let movedCount = 0;
  let skippedCount = 0;
  
  files.forEach(file => {
    // Skip directories
    const filePath = path.join(BENCHMARK_DIR, file);
    if (fs.statSync(filePath).isDirectory()) {
      return;
    }
    
    // Determine the category based on filename
    let targetDir = null;
    for (const [pattern, dir] of Object.entries(CATEGORIES)) {
      if (file.includes(pattern)) {
        targetDir = dir;
        break;
      }
    }
    
    // If no category found, skip the file
    if (!targetDir) {
      console.log(`Skipping file (no matching category): ${file}`);
      skippedCount++;
      return;
    }
    
    // Move the file to the appropriate directory
    const targetPath = path.join(BENCHMARK_DIR, targetDir, file);
    
    try {
      fs.renameSync(filePath, targetPath);
      console.log(`Moved: ${file} -> ${targetDir}/`);
      movedCount++;
    } catch (err) {
      console.error(`Error moving ${file}: ${err.message}`);
      skippedCount++;
    }
  });
  
  console.log(`\nOrganization complete!`);
  console.log(`Files moved: ${movedCount}`);
  console.log(`Files skipped: ${skippedCount}`);
}

// Main function
function main() {
  console.log('Starting benchmark results organization...');
  
  // Check if benchmark directory exists
  if (!fs.existsSync(BENCHMARK_DIR)) {
    console.error(`Error: Benchmark directory '${BENCHMARK_DIR}' not found.`);
    process.exit(1);
  }
  
  // Create category directories
  createDirectories();
  
  // Organize files
  organizeFiles();
}

// Run the script
main();