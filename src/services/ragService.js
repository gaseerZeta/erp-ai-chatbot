
// const axios = require('axios');
// const config = require('../config/ollama.config');
// const vectorStore = require('./vectorStore');

// class RAGService {
//     async generateResponse(query, context, documentType) {
//         const systemName = documentType === 'erp' ? 'ERP' : 'HRMS';

//         const prompt = `You are an ${systemName} system assistant. Answer the user's question based on the following context from the ${systemName} guide.

// Context:
// ${context}

// User Question: ${query}

// Instructions:
// - Answer based ONLY on the provided context
// - If the context doesn't contain enough information, say "I don't have enough information in the ${systemName} guide to answer that question."
// - Be concise and helpful
// - Use bullet points for step-by-step instructions when appropriate

// Answer:`;

//         try {
//             const response = await axios.post(
//                 `${config.baseURL}/api/generate`,
//                 {
//                     model: config.llmModel,
//                     prompt: prompt,
//                     stream: false,
//                     options: {
//                         temperature: 0.3,
//                         top_p: 0.9,
//                         top_k: 40,
//                         num_predict: 300
//                     }
//                 }
//             );

//             return response.data.response;
//         } catch (error) {
//             console.error('Error generating response:', error.message);
//             throw error;
//         }
//     }

//     async generateResponseStream(query, context, documentType, onChunk) {
//         const systemName = documentType === 'erp' ? 'ERP' : 'HRMS';

//         const prompt = `You are an ${systemName} system assistant. Answer the user's question based on the following context from the ${systemName} guide.

// Context:
// ${context}

// User Question: ${query}

// Instructions:
// - Answer based ONLY on the provided context
// - If the context doesn't contain enough information, say "I don't have enough information in the ${systemName} guide to answer that question."
// - Be concise and helpful

// Answer:`;

//         try {
//             const response = await axios.post(
//                 `${config.baseURL}/api/generate`,
//                 {
//                     model: config.llmModel,
//                     prompt: prompt,
//                     stream: true,
//                     options: {
//                         temperature: 0.3,
//                         top_p: 0.9,
//                         top_k: 40,
//                         num_predict: 300
//                     }
//                 },
//                 {
//                     responseType: 'stream'
//                 }
//             );

//             let fullResponse = '';

//             return new Promise((resolve, reject) => {
//                 response.data.on('data', (chunk) => {
//                     const lines = chunk.toString().split('\n').filter(line => line.trim());

//                     for (const line of lines) {
//                         try {
//                             const json = JSON.parse(line);
//                             if (json.response) {
//                                 fullResponse += json.response;
//                                 onChunk(json.response);
//                             }
//                             if (json.done) {
//                                 resolve(fullResponse);
//                             }
//                         } catch (e) {
//                             // Ignore parsing errors
//                         }
//                     }
//                 });

//                 response.data.on('error', (error) => {
//                     reject(error);
//                 });
//             });
//         } catch (error) {
//             console.error('Error generating response:', error.message);
//             throw error;
//         }
//     }

//     async query(userQuery, documentType = 'erp') {
//         console.log(`Searching for relevant context in ${documentType.toUpperCase()}...`);
//         const relevantDocs = await vectorStore.search(userQuery, documentType, 3);

//         if (relevantDocs.length === 0) {
//             return `I couldn't find relevant information in the ${documentType.toUpperCase()} guide.`;
//         }

//         const context = relevantDocs.join('\n\n---\n\n');

//         console.log('Generating response...');
//         const response = await this.generateResponse(userQuery, context, documentType);

//         return response;
//     }

//     async queryStream(userQuery, documentType = 'erp', onChunk) {
//         console.log(`Searching for relevant context in ${documentType.toUpperCase()}...`);
//         const relevantDocs = await vectorStore.search(userQuery, documentType, 3);

//         if (relevantDocs.length === 0) {
//             const msg = `I couldn't find relevant information in the ${documentType.toUpperCase()} guide.`;
//             onChunk(msg);
//             return msg;
//         }

//         const context = relevantDocs.join('\n\n---\n\n');

//         console.log('Generating response with streaming...');
//         const response = await this.generateResponseStream(userQuery, context, documentType, onChunk);

//         return response;
//     }
// }

// module.exports = new RAGService();
const OpenAI = require("openai");
const config = require("../config/groq.config");
const vectorStore = require("./vectorStore");

const client = new OpenAI({
  apiKey: config.apiKey,
  baseURL: "https://api.groq.com/openai/v1"
});

class RAGService {

  async generateResponse(query, context, documentType) {

    const systemName = documentType === "erp" ? "ERP" : "HRMS";

    const prompt = `
You are an ${systemName} system assistant. Answer the user's question based on the context.

Context:
${context}

User Question: ${query}

Instructions:
- Answer ONLY from context
- If missing info say you don't know
- Be concise
`;

    try {

      const completion = await client.chat.completions.create({
        model: config.model,
        messages: [
          { role: "system", content: `You are a helpful ${systemName} assistant.` },
          { role: "user", content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 500
      });

      return completion.choices[0].message.content;

    } catch (error) {
      console.error("Groq Error:", error.message);
      throw error;
    }
  }


  async generateResponseStream(query, context, documentType, onChunk) {

    const systemName = documentType === "erp" ? "ERP" : "HRMS";

    const prompt = `
You are an ${systemName} assistant.

Context:
${context}

Question: ${query}
`;

    try {

      const stream = await client.chat.completions.create({
        model: config.model,
        messages: [
          { role: "system", content: `You are a helpful ${systemName} assistant.` },
          { role: "user", content: prompt }
        ],
        stream: true,
        temperature: 0.3
      });

      let fullResponse = "";

      for await (const chunk of stream) {

        const content = chunk.choices?.[0]?.delta?.content;

        if (content) {
          fullResponse += content;
          onChunk(content);
        }
      }

      return fullResponse;

    } catch (error) {
      console.error("Groq Stream Error:", error.message);
      throw error;
    }
  }


  async query(userQuery, documentType = "erp") {

    const relevantDocs = await vectorStore.search(userQuery, documentType, 3);

    if (relevantDocs.length === 0) {
      return `I couldn't find relevant information in the ${documentType.toUpperCase()} guide.`;
    }

    const context = relevantDocs.join("\n\n---\n\n");

    return this.generateResponse(userQuery, context, documentType);
  }


  async queryStream(userQuery, documentType = "erp", onChunk) {

    const relevantDocs = await vectorStore.search(userQuery, documentType, 3);

    if (relevantDocs.length === 0) {
      const msg = `I couldn't find relevant information in the ${documentType.toUpperCase()} guide.`;
      onChunk(msg);
      return msg;
    }

    const context = relevantDocs.join("\n\n---\n\n");

    return this.generateResponseStream(userQuery, context, documentType, onChunk);
  }
}

module.exports = new RAGService();