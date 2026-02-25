const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
console.log("ENV KEY:", process.env.OPENAI_API_KEY ? "FOUND" : "MISSING"); 
require('dotenv').config();

const pdfProcessor = require('./services/pdfProcessor');
const vectorStore = require('./services/vectorStore');
const chatRoutes = require('./routes/chat.routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/chat', chatRoutes);

// Initialize and train the models
async function initializeRAG() {
    try {
        console.log('=== Initializing RAG System ===');

        await vectorStore.initialize();

        // Define documents to process
        const documents = [
            { type: 'erp', filename: 'erp_guide.pdf' },
            { type: 'hrms', filename: 'hrms_guide.pdf' }
        ];

        for (const doc of documents) {
            console.log(`\n--- Processing ${doc.type.toUpperCase()} Guide ---`);

            const alreadyTrained = await vectorStore.load(doc.type);

            if (alreadyTrained) {
                console.log(`${doc.type.toUpperCase()} already trained, skipping...`);
                continue;
            }

            console.log(`Training ${doc.type.toUpperCase()} model...`);

            const pdfPath = path.join(__dirname, '../data', doc.filename);

            if (!fs.existsSync(pdfPath)) {
                console.warn(`${doc.filename} not found, skipping...`);
                continue;
            }

            const chunks = await pdfProcessor.processPDF(pdfPath);
            await vectorStore.addDocuments(chunks, doc.type);

            console.log(`${doc.type.toUpperCase()} model trained successfully`);
        }

        console.log('\n=== RAG System Ready ===');
        console.log('Available documents:', vectorStore.getAvailableDocuments().join(', '));
    } catch (error) {
        console.error('\nFailed to initialize RAG system:');
        console.error(error.message);
        process.exit(1);
    }
}

// Start server
async function start() {
    await initializeRAG();

    app.listen(PORT, () => {
        console.log('\n=================================');
        console.log(`Server running on http://localhost:${PORT}`);
        console.log(`Health check: http://localhost:${PORT}/api/chat/health`);
        console.log(`Available docs: http://localhost:${PORT}/api/chat/documents`);
        console.log('=================================\n');
    });
}

start();
