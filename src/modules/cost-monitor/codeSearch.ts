/**
 * codeSearch.ts
 * Implements code repository indexing and searching using retriv's BM25 algorithm.
 * This module handles scanning the workspace, indexing code files, and providing search functionality.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';
import { logger } from '../../utils/logger';
import { BM25Searcher, SearchResult } from './bm25';

export interface CodeDocument {
  content: string;       // The actual code content
  path: string;          // Path to the file
  language: string;      // Programming language
  startLine?: number;    // Starting line number (for code snippets)
  endLine?: number;      // Ending line number (for code snippets)
}

export interface CodeSearchResult extends SearchResult {
  path: string;           // Path to the file
  language: string;       // Programming language
  startLine?: number;     // Starting line number (for snippets)
  endLine?: number;       // Ending line number (for snippets)
  relativePath?: string;  // Path relative to the workspace root
}

export class CodeSearchEngine {
  private bm25Searcher: BM25Searcher;
  private documents: CodeDocument[] = [];
  private indexedPaths: Set<string> = new Set();
  private workspaceRoot: string;
  private initialized: boolean = false;
  private excludePatterns: string[] = [
    'node_modules/**',
    '.git/**',
    'dist/**',
    'build/**',
    '.venv/**',
    '**/*.min.js',
    '**/*.bundle.js',
    '**/package-lock.json',
    '**/yarn.lock'
  ];

  constructor(workspaceRoot: string, options?: { excludePatterns?: string[] }) {
    this.workspaceRoot = workspaceRoot;
    this.bm25Searcher = new BM25Searcher();
    if (options?.excludePatterns) {
      this.excludePatterns = [...this.excludePatterns, ...options.excludePatterns];
    }
  }

  /**
   * Initialize the code search engine
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Initialize the BM25 searcher
      await this.bm25Searcher.initialize();
      this.initialized = true;
      logger.info('Code search engine initialized');
    } catch (error) {
      logger.error('Failed to initialize code search engine', error);
      throw error;
    }
  }

  /**
   * Index all code files in the workspace
   * @param forceReindex Whether to force reindexing even if files have been indexed before
   */
  public async indexWorkspace(forceReindex: boolean = false): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Find all code files in the workspace
      const codeFiles = await this.findCodeFiles();
      const newOrUpdatedFiles = forceReindex ? codeFiles : this.filterNewOrUpdatedFiles(codeFiles);

      if (newOrUpdatedFiles.length === 0) {
        logger.info('No new or updated files to index');
        return;
      }

      logger.info(`Indexing ${newOrUpdatedFiles.length} code files`);

      // Read and process each code file
      const newDocuments = await this.readCodeFiles(newOrUpdatedFiles);
      this.documents = [...this.documents.filter(doc => 
        !newOrUpdatedFiles.includes(doc.path)), ...newDocuments];

      // Update the indexedPaths set
      newOrUpdatedFiles.forEach(path => this.indexedPaths.add(path));

      // Index the documents with the BM25 searcher
      const documentContents = this.documents.map(doc => doc.content);
      await this.bm25Searcher.indexDocuments(documentContents);

      logger.info(`Indexed ${this.documents.length} code documents successfully`);
    } catch (error) {
      logger.error('Failed to index workspace', error);
      throw error;
    }
  }

  /**
   * Search for code using a query string
   * @param query The search query
   * @param topK Number of top results to return
   * @returns Array of code search results
   */
  public async search(query: string, topK: number = 5): Promise<CodeSearchResult[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (this.documents.length === 0) {
      logger.warn('No documents have been indexed yet');
      return [];
    }

    try {
      // Perform the search using the BM25 searcher
      const results = await this.bm25Searcher.search(query, topK);

      // Map the results to CodeSearchResult objects
      return results.map(result => {
        const document = this.documents[result.index];
        return {
          ...result,
          path: document.path,
          language: document.language,
          startLine: document.startLine,
          endLine: document.endLine,
          relativePath: path.relative(this.workspaceRoot, document.path)
        };
      });
    } catch (error) {
      logger.error('Error searching code', error);
      return [];
    }
  }

  /**
   * Find all code files in the workspace
   * @returns Array of file paths
   */
  private findCodeFiles(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      // Define patterns for code files
      const codeFilePatterns = [
        '**/*.ts', '**/*.js', '**/*.tsx', '**/*.jsx',
        '**/*.py', '**/*.java', '**/*.c', '**/*.cpp', '**/*.h',
        '**/*.cs', '**/*.go', '**/*.rb', '**/*.php', '**/*.swift',
        '**/*.kt', '**/*.rs', '**/*.scala', '**/*.sh', '**/*.html',
        '**/*.css', '**/*.scss', '**/*.less', '**/*.json', '**/*.yml',
        '**/*.yaml', '**/*.md', '**/*.xml'
      ];

      const options: glob.IOptions = {
        cwd: this.workspaceRoot,
        ignore: this.excludePatterns,
        absolute: true,
        nodir: true
      };

      // Use glob to find all files matching the patterns
      glob(`{${codeFilePatterns.join(',')}}`, options, (err, files) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(files);
      });
    });
  }

  /**
   * Filter out files that have already been indexed and haven't changed
   * @param filePaths Array of file paths
   * @returns Array of file paths that need to be indexed
   */
  private filterNewOrUpdatedFiles(filePaths: string[]): string[] {
    return filePaths.filter(filePath => {
      // If the file hasn't been indexed before, include it
      if (!this.indexedPaths.has(filePath)) {
        return true;
      }

      try {
        // Check if the file has been modified since last indexing
        const stats = fs.statSync(filePath);
        const indexedDoc = this.documents.find(doc => doc.path === filePath);
        
        // If we can't find the document or the file has been modified, include it
        return !indexedDoc || stats.mtimeMs > Date.now() - 60000; // Simple check if modified in the last minute
      } catch (error) {
        // If there's an error checking the file, assume it needs to be indexed
        return true;
      }
    });
  }

  /**
   * Read and process code files
   * @param filePaths Array of file paths
   * @returns Array of CodeDocument objects
   */
  private async readCodeFiles(filePaths: string[]): Promise<CodeDocument[]> {
    const documents: CodeDocument[] = [];

    for (const filePath of filePaths) {
      try {
        // Read the file content
        const content = fs.readFileSync(filePath, 'utf-8');

        // Determine the language from the file extension
        const ext = path.extname(filePath).toLowerCase();
        const language = this.getLanguageFromExtension(ext);

        // Create a document for the whole file
        documents.push({
          content,
          path: filePath,
          language
        });

        // TODO: Consider chunking large files into smaller documents
        // or extracting significant code snippets (functions, classes, etc.)
      } catch (error) {
        logger.warn(`Failed to read file ${filePath}`, error);
        // Continue with the next file
      }
    }

    return documents;
  }

  /**
   * Determine the programming language from a file extension
   * @param extension The file extension (including the dot)
   * @returns The programming language name
   */
  private getLanguageFromExtension(extension: string): string {
    const langMap: Record<string, string> = {
      '.ts': 'TypeScript',
      '.js': 'JavaScript',
      '.tsx': 'TypeScript',
      '.jsx': 'JavaScript',
      '.py': 'Python',
      '.java': 'Java',
      '.c': 'C',
      '.cpp': 'C++',
      '.h': 'C/C++',
      '.cs': 'C#',
      '.go': 'Go',
      '.rb': 'Ruby',
      '.php': 'PHP',
      '.swift': 'Swift',
      '.kt': 'Kotlin',
      '.rs': 'Rust',
      '.scala': 'Scala',
      '.sh': 'Shell',
      '.html': 'HTML',
      '.css': 'CSS',
      '.scss': 'SCSS',
      '.less': 'Less',
      '.json': 'JSON',
      '.yml': 'YAML',
      '.yaml': 'YAML',
      '.md': 'Markdown',
      '.xml': 'XML'
    };

    return langMap[extension] || 'Unknown';
  }

  /**
   * Get the total number of indexed documents
   * @returns The number of indexed documents
   */
  public getDocumentCount(): number {
    return this.documents.length;
  }

  /**
   * Clean up resources when done
   */
  public dispose(): void {
    this.bm25Searcher.dispose();
    this.documents = [];
    this.indexedPaths.clear();
    this.initialized = false;
  }
}