const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const config = require('../config/huggingface.config');
  const { InferenceClient } = require('@huggingface/inference');

 const hfClient = new InferenceClient(config.apiKey);

class VectorStore {
    constructor() {
        this.storeBasePath = path.join(__dirname, '../../data');
        this.stores = {
            erp: { documents: [], path: path.join(this.storeBasePath, 'vector_store_erp.json') },
            hrms: { documents: [], path: path.join(this.storeBasePath, 'vector_store_hrms.json') }
        };
    }

    async initialize() {
        if (!fs.existsSync(this.storeBasePath)) {
            fs.mkdirSync(this.storeBasePath, { recursive: true });
        }
        console.log('Vector store initialized');
    }

async generateEmbedding(text) {
    try {
        const output = await hfClient.featureExtraction({
            model: 'sentence-transformers/all-MiniLM-L6-v2',
            inputs: text,
            // NO provider field - uses HF's own free inference
        });

        const embedding = Array.isArray(output[0]) ? output[0] : Array.from(output);
        return embedding;

    } catch (error) {
        console.error('Embedding error:', error.message);
        throw error;
    }
}


    cosineSimilarity(vecA, vecB) {
        const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
        const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
        const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
        return dotProduct / (magnitudeA * magnitudeB);
    }

    async addDocuments(chunks, documentType) {
        if (!this.stores[documentType]) {
            throw new Error(`Invalid document type: ${documentType}`);
        }

        console.log(`Generating embeddings for ${documentType.toUpperCase()}...`);
        this.stores[documentType].documents = [];

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            console.log(`Processing chunk ${i + 1}/${chunks.length}...`);

            const embedding = await this.generateEmbedding(chunk);

            this.stores[documentType].documents.push({
                id: `${documentType}_doc_${i}`,
                text: chunk,
                embedding,
                metadata: {
                    chunk_id: i,
                    source: `${documentType}_guide.pdf`,
                    documentType
                }
            });

            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        fs.writeFileSync(
            this.stores[documentType].path,
            JSON.stringify(this.stores[documentType].documents, null, 2)
        );

        console.log(`${chunks.length} ${documentType.toUpperCase()} documents stored`);
    }

    async search(query, documentType, nResults = 3) {
        if (!this.stores[documentType]) {
            throw new Error(`Invalid document type: ${documentType}`);
        }

        // Load from file if not in memory
        if (this.stores[documentType].documents.length === 0 &&
            fs.existsSync(this.stores[documentType].path)) {
            const data = fs.readFileSync(this.stores[documentType].path, 'utf-8');
            this.stores[documentType].documents = JSON.parse(data);
        }

        if (this.stores[documentType].documents.length === 0) {
            throw new Error(`No documents in ${documentType.toUpperCase()} vector store. Please train first.`);
        }

        const queryEmbedding = await this.generateEmbedding(query);

        const similarities = this.stores[documentType].documents.map(doc => ({
            text: doc.text,
            similarity: this.cosineSimilarity(queryEmbedding, doc.embedding)
        }));

        similarities.sort((a, b) => b.similarity - a.similarity);
        const top = similarities.slice(0, nResults);

        console.log(`Top similarity: ${top[0]?.similarity.toFixed(3)}`);
        return top.map(r => r.text);
    }

    isTrained(documentType) {
        return fs.existsSync(this.stores[documentType]?.path || '');
    }

    async load(documentType) {
        if (fs.existsSync(this.stores[documentType].path)) {
            const data = fs.readFileSync(this.stores[documentType].path, 'utf-8');
            this.stores[documentType].documents = JSON.parse(data);
            console.log(`Loaded ${this.stores[documentType].documents.length} ${documentType.toUpperCase()} docs`);
            return true;
        }
        return false;
    }

    getAvailableDocuments() {
        return Object.keys(this.stores).filter(type => this.isTrained(type));
    }
}

module.exports = new VectorStore();// const fs = require('fs');
// const path = require('path');
// const axios = require('axios');
// const config = require('../config/ollama.config');

// class VectorStore {
//     constructor() {
//         this.storeBasePath = path.join(__dirname, '../../data');
//         this.stores = {
//             erp: { documents: [], path: path.join(this.storeBasePath, 'vector_store_erp.json') },
//             hrms: { documents: [], path: path.join(this.storeBasePath, 'vector_store_hrms.json') }
//         };
//     }

//     async initialize() {
//         try {
//             // Create data directory if it doesn't exist
//             if (!fs.existsSync(this.storeBasePath)) {
//                 fs.mkdirSync(this.storeBasePath, { recursive: true });
//             }

//             console.log('Vector store initialized for multiple documents');
//         } catch (error) {
//             console.error('Error initializing vector store:', error);
//             throw error;
//         }
//     }

//     async generateEmbedding(text) {
//         try {
//             const response = await axios.post(
//                 `${config.baseURL}/api/embeddings`,
//                 {
//                     model: config.embeddingModel,
//                     prompt: text
//                 }
//             );
//             return response.data.embedding;
//         } catch (error) {
//             console.error('Error generating embedding:', error.message);
//             throw error;
//         }
//     }


//     cosineSimilarity(vecA, vecB) {
//         const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
//         const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
//         const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
//         return dotProduct / (magnitudeA * magnitudeB);
//     }

//     async addDocuments(chunks, documentType) {
//         if (!this.stores[documentType]) {
//             throw new Error(`Invalid document type: ${documentType}. Use 'erp' or 'hrms'`);
//         }

//         console.log(`Generating embeddings for ${documentType.toUpperCase()} guide...`);

//         this.stores[documentType].documents = [];

//         for (let i = 0; i < chunks.length; i++) {
//             const chunk = chunks[i];
//             console.log(`Processing ${documentType.toUpperCase()} chunk ${i + 1}/${chunks.length}...`);

//             const embedding = await this.generateEmbedding(chunk);

//             this.stores[documentType].documents.push({
//                 id: `${documentType}_doc_${i}`,
//                 text: chunk,
//                 embedding: embedding,
//                 metadata: {
//                     chunk_id: i,
//                     source: `${documentType}_guide.pdf`,
//                     documentType: documentType
//                 }
//             });

//             if (i < chunks.length - 1) {
//                 await new Promise(resolve => setTimeout(resolve, 100));
//             }
//         }

//         // Save to specific file
//         fs.writeFileSync(
//             this.stores[documentType].path,
//             JSON.stringify(this.stores[documentType].documents, null, 2)
//         );

//         console.log(`${chunks.length} ${documentType.toUpperCase()} documents stored`);
//         console.log(`Saved to: ${this.stores[documentType].path}`);
//     }

//     async search(query, documentType, nResults = 3) {
//         if (!this.stores[documentType]) {
//             throw new Error(`Invalid document type: ${documentType}. Use 'erp' or 'hrms'`);
//         }

//         // Load documents if not in memory
//         if (this.stores[documentType].documents.length === 0 &&
//             fs.existsSync(this.stores[documentType].path)) {
//             console.log(`Loading ${documentType.toUpperCase()} vector store...`);
//             const data = fs.readFileSync(this.stores[documentType].path, 'utf-8');
//             this.stores[documentType].documents = JSON.parse(data);
//         }

//         if (this.stores[documentType].documents.length === 0) {
//             throw new Error(`No documents in ${documentType.toUpperCase()} vector store. Please train the model first.`);
//         }

//         // Generate embedding for query
//         const queryEmbedding = await this.generateEmbedding(query);

//         // Calculate similarities
//         const similarities = this.stores[documentType].documents.map(doc => ({
//             text: doc.text,
//             similarity: this.cosineSimilarity(queryEmbedding, doc.embedding),
//             metadata: doc.metadata
//         }));

//         // Sort by similarity and return top N
//         similarities.sort((a, b) => b.similarity - a.similarity);

//         const topResults = similarities.slice(0, nResults);
//         console.log(`Found ${topResults.length} relevant ${documentType.toUpperCase()} chunks (similarity: ${topResults[0]?.similarity.toFixed(3)})`);

//         return topResults.map(r => r.text);
//     }

//     isTrained(documentType) {
//         return fs.existsSync(this.stores[documentType].path);
//     }

//     async load(documentType) {
//         if (fs.existsSync(this.stores[documentType].path)) {
//             console.log(`Loading existing ${documentType.toUpperCase()} vector store...`);
//             const data = fs.readFileSync(this.stores[documentType].path, 'utf-8');
//             this.stores[documentType].documents = JSON.parse(data);
//             console.log(`Loaded ${this.stores[documentType].documents.length} ${documentType.toUpperCase()} documents`);
//             return true;
//         }
//         return false;
//     }

//     getAvailableDocuments() {
//         return Object.keys(this.stores).filter(type => this.isTrained(type));
//     }
// }

// module.exports = new VectorStore();
