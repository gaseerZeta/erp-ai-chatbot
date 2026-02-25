 

require('dotenv').config();

module.exports = {
    embedding: {
        model: 'sentence-transformers/all-MiniLM-L6-v2',
    },
    llm: {
        model: 'meta-llama/Llama-3.1-8B-Instruct:novita',
        baseURL: 'https://router.huggingface.co/v1'
    },
    apiKey: process.env.HF_TOKEN,
    timeout: 30000,
    maxRetries: 3
};