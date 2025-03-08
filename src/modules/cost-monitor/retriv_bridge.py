#!/usr/bin/env python3
"""
retriv_bridge.py

This script serves as a bridge between the TypeScript/Node.js application and the retriv Python library.
It reads JSON commands from stdin and writes JSON results to stdout.
"""

import json
import sys
from retriv import BM25

# Global variables
bm25_instance = None
indexed = False

def process_index_command(command_data):
    """
    Index documents using retriv BM25
    """
    global bm25_instance, indexed
    
    documents = command_data.get("documents", [])
    options = command_data.get("options", {})
    
    # Extract BM25 parameters
    k1 = options.get("k1", 1.5)
    b = options.get("b", 0.75)
    epsilon = options.get("epsilon", 0.25)
    
    # Create and configure the BM25 instance
    bm25_instance = BM25(
        k1=k1,
        b=b,
        epsilon=epsilon
    )
    
    # Index the documents
    if documents:
        bm25_instance.index(documents)
        indexed = True
        print("INDEX_COMPLETE")
    else:
        print(json.dumps({"error": "No documents provided for indexing"}))

def process_search_command(command_data):
    """
    Search indexed documents using the query
    """
    global bm25_instance, indexed
    
    if not indexed or bm25_instance is None:
        print(json.dumps({
            "action": "search_results",
            "results": [],
            "error": "No documents have been indexed yet"
        }))
        return
    
    query = command_data.get("query", "")
    top_k = command_data.get("topK", 5)
    
    if not query:
        print(json.dumps({
            "action": "search_results",
            "results": [],
            "error": "Empty query provided"
        }))
        return
    
    # Perform the search
    try:
        results = bm25_instance.search(query)
        
        # Format results for TypeScript
        formatted_results = []
        for i, score in enumerate(results[:top_k]):
            formatted_results.append({
                "index": int(i),  # The index in the original document list
                "score": float(score)  # The similarity score
            })
        
        print(json.dumps({
            "action": "search_results",
            "results": formatted_results
        }))
    except Exception as e:
        print(json.dumps({
            "action": "search_results",
            "results": [],
            "error": str(e)
        }))

def main():
    """
    Main function to process commands
    """
    # Signal that the bridge is ready
    print("RETRIV_READY")
    sys.stdout.flush()
    
    # Process commands
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        
        try:
            command = json.loads(line)
            action = command.get("action", "")
            
            if action == "index":
                process_index_command(command)
            elif action == "search":
                process_search_command(command)
            else:
                print(json.dumps({"error": f"Unknown action: {action}"}))
            
            sys.stdout.flush()
        except json.JSONDecodeError:
            print(json.dumps({"error": "Invalid JSON command"}))
            sys.stdout.flush()
        except Exception as e:
            print(json.dumps({"error": str(e)}))
            sys.stdout.flush()

if __name__ == "__main__":
    main()