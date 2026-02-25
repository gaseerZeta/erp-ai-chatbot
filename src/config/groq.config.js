// groq.config.js  ← change export to module.exports
require('dotenv').config();

module.exports = {
    apiKey: process.env.GROQ_API_KEY,   // make sure this is in your .env
    model: process.env.LLM_MODEL || 'llama-3.3-70b-versatile'
};