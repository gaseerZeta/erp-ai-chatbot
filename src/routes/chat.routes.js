const express = require('express');
const router = express.Router();
const ragService = require('../services/ragService');
const vectorStore = require('../services/vectorStore');

// Non-streaming endpoint with document type
router.post('/query', async (req, res) => {
    try {
        const { question, documentType = 'erp' } = req.body;

        if (!question) {
            return res.status(400).json({ error: 'Question is required' });
        }

        if (!['erp', 'hrms'].includes(documentType)) {
            return res.status(400).json({ error: 'documentType must be "erp" or "hrms"' });
        }

        const answer = await ragService.query(question, documentType);

        res.json({
            question,
            answer,
            documentType,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error processing query:', error);
        res.status(500).json({
            error: 'Failed to process query',
            details: error.message
        });
    }
});

// Streaming endpoint with document type
router.post('/query-stream', async (req, res) => {
    try {
        const { question, documentType = 'erp' } = req.body;

        if (!question) {
            return res.status(400).json({ error: 'Question is required' });
        }

        if (!['erp', 'hrms'].includes(documentType)) {
            return res.status(400).json({ error: 'documentType must be "erp" or "hrms"' });
        }

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        res.write(`data: ${JSON.stringify({ type: 'start', question, documentType })}\n\n`);

        await ragService.queryStream(question, documentType, (chunk) => {
            res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
        });

        res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
        res.end();

    } catch (error) {
        console.error('Error processing streaming query:', error);
        res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
        res.end();
    }
});

// Get available documents
router.get('/documents', (req, res) => {
    const available = vectorStore.getAvailableDocuments();
    res.json({
        available,
        erp: vectorStore.isTrained('erp'),
        hrms: vectorStore.isTrained('hrms')
    });
});

router.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'ERP Chatbot API is running' });
});

module.exports = router;