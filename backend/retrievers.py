# Create both retrievers
vector_retriever = lab.vector_index.as_retriever(similarity_top_k=10)
try:
    bm25_retriever = BM25Retriever.from_defaults(
        nodes=lab.nodes, similarity_top_k=10
    )
except:
    # Fallback if BM25 is not available
    bm25_retriever = vector_retriever

def hybrid_retrieve(query, top_k=5):
    # Get results from both retrievers
    vector_results = vector_retriever.retrieve(query)
    bm25_results = bm25_retriever.retrieve(query)
    
    # Create dictionaries using text content as keys (since node IDs differ)
    vector_scores = {}
    bm25_scores = {}
    all_nodes = {}
    
    # Normalize vector scores
    max_vector_score = max([r.score for r in vector_results]) if vector_results else 1
    for result in vector_results:
        text_key = result.text.strip()  # Use text content as key
        normalized_score = result.score / max_vector_score
        vector_scores[text_key] = normalized_score
        all_nodes[text_key] = result
    
    # Normalize BM25 scores
    max_bm25_score = max([r.score for r in bm25_results]) if bm25_results else 1
    for result in bm25_results:
        text_key = result.text.strip()  # Use text content as key
        normalized_score = result.score / max_bm25_score
        bm25_scores[text_key] = normalized_score
        all_nodes[text_key] = result
    
    # Calculate hybrid scores
    hybrid_results = []
    for text_key in all_nodes:
        vector_score = vector_scores.get(text_key, 0)
        bm25_score = bm25_scores.get(text_key, 0)
        hybrid_score = 0.7 * vector_score + 0.3 * bm25_score
        
        hybrid_results.append({
            'node': all_nodes[text_key],
            'vector_score': vector_score,
            'bm25_score': bm25_score,
            'hybrid_score': hybrid_score
        })
    
    # Sort by hybrid score and return top k
    hybrid_results.sort(key=lambda x: x['hybrid_score'], reverse=True)
    return hybrid_results[:top_k]

# Test with different queries
test_queries = [
    "What is machine learning?",
    "neural networks deep learning", 
    "supervised learning techniques"
]

for query in test_queries:
    print(f"Query: {query}")
    results = hybrid_retrieve(query, top_k=3)
    for i, result in enumerate(results, 1):
        print(f"{i}. Hybrid Score: {result['hybrid_score']:.3f}")
        print(f"   Vector: {result['vector_score']:.3f}, BM25: {result['bm25_score']:.3f}")
        print(f"   Text: {result['node'].text[:80]}...")
    print()