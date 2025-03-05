import path from 'path';
import fs from 'fs/promises';
import { mkdir } from 'fs/promises';
import { config } from '../../../config/index.js';
import { logger } from '../../../utils/logger.js';
import { ModelsDatabase } from '../types/index.js';

// File path for storing model performance data
const MODELS_DB_PATH = path.join(config.rootDir, 'models-performance.json');

/**
 * Models Database Service
 * Handles loading, saving, and updating the model performance database
 */
export const modelsDbService = {
  // In-memory cache of model performance data
  modelsDb: {
    models: {},
    lastUpdated: ''
  } as ModelsDatabase,

  /**
   * Initialize the models database
   * Loads tracking data from disk if available
   */
  async initialize(): Promise<void> {
    logger.debug('Initializing models database');
    
    try {
      // Ensure the directory exists for tracking files
      try {
        await mkdir(path.dirname(MODELS_DB_PATH), { recursive: true });
        logger.debug(`Ensured directory exists: ${path.dirname(MODELS_DB_PATH)}`);
      } catch (error: any) {
        // Ignore if directory already exists
        logger.debug(`Directory check: ${error.message}`);
      }
      
      // Load tracking data from disk if available
      try {
        const data = await fs.readFile(MODELS_DB_PATH, 'utf8');
        this.modelsDb = JSON.parse(data) as ModelsDatabase;
        logger.debug(`Loaded models database with ${Object.keys(this.modelsDb.models).length} models`);
      } catch (error) {
        logger.debug('No existing models database found, will create new database');
        this.modelsDb = {
          models: {},
          lastUpdated: new Date().toISOString()
        };
      }
    } catch (error) {
      logger.error('Error initializing models database:', error);
    }
  },

  /**
   * Save the models database to disk
   */
  async save(): Promise<void> {
    try {
      logger.debug(`Saving models database to: ${MODELS_DB_PATH}`);
      logger.debug(`Database contains ${Object.keys(this.modelsDb.models).length} models`);
      
      // Ensure the directory exists
      try {
        await mkdir(path.dirname(MODELS_DB_PATH), { recursive: true });
      } catch (error: any) {
        // Ignore if directory already exists
        logger.debug(`Directory check during save: ${error.message}`);
      }
      
      await fs.writeFile(MODELS_DB_PATH, JSON.stringify(this.modelsDb, null, 2));
      logger.debug('Successfully saved models database to disk');
    } catch (error: any) {
      logger.error(`Error saving models database to ${MODELS_DB_PATH}:`, error);
      logger.error(`Error details: ${error.message}`);
    }
  },

  /**
   * Get the database
   */
  getDatabase(): ModelsDatabase {
    return this.modelsDb;
  },

  /**
   * Update the database
   */
  updateDatabase(newDb: ModelsDatabase): void {
    this.modelsDb = newDb;
  }
};