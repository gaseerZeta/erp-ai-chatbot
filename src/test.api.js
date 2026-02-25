const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

// Colors for terminal output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testHealthCheck() {
    log('\n🏥 Testing Health Check...', 'cyan');
    try {
        const response = await axios.get(`${BASE_URL}/api/chat/health`);
        log('✓ Health check passed', 'green');
        log(JSON.stringify(response.data, null, 2), 'reset');
        return true;
    } catch (error) {
        log('✗ Health check failed: ' + error.message, 'red');
        return false;
    }
}

async function testModelInfo() {
    log('\n📊 Testing Model Info...', 'cyan');
    try {
        const response = await axios.get(`${BASE_URL}/api/chat/info`);
        log('✓ Model info retrieved', 'green');
        log(JSON.stringify(response.data, null, 2), 'reset');
        return true;
    } catch (error) {
        log('✗ Model info failed: ' + error.message, 'red');
        return false;
    }
}

async function testDocuments() {
    log('\n📚 Testing Available Documents...', 'cyan');
    try {
        const response = await axios.get(`${BASE_URL}/api/chat/documents`);
        log('✓ Documents retrieved', 'green');
        log(JSON.stringify(response.data, null, 2), 'reset');
        return response.data.available.length > 0;
    } catch (error) {
        log('✗ Documents check failed: ' + error.message, 'red');
        return false;
    }
}

async function testQuery(question, documentType = 'erp') {
    log(`\n💬 Testing Query: "${question}"`, 'cyan');
    log(`   Document Type: ${documentType}`, 'yellow');

    try {
        const startTime = Date.now();
        const response = await axios.post(`${BASE_URL}/api/chat/query`, {
            question,
            documentType
        });
        const endTime = Date.now();

        log(`✓ Query successful (${endTime - startTime}ms)`, 'green');
        log('\nQuestion:', 'blue');
        log(response.data.question, 'reset');
        log('\nAnswer:', 'blue');
        log(response.data.answer, 'reset');
        return true;
    } catch (error) {
        log('✗ Query failed: ' + error.message, 'red');
        if (error.response) {
            log('Response data:', 'yellow');
            log(JSON.stringify(error.response.data, null, 2), 'reset');
        }
        return false;
    }
}

async function testStreamingQuery(question, documentType = 'erp') {
    log(`\n🌊 Testing Streaming Query: "${question}"`, 'cyan');
    log(`   Document Type: ${documentType}`, 'yellow');

    try {
        const response = await axios.post(
            `${BASE_URL}/api/chat/query-stream`,
            { question, documentType },
            { responseType: 'stream' }
        );

        return new Promise((resolve) => {
            let fullResponse = '';

            response.data.on('data', (chunk) => {
                const lines = chunk.toString().split('\n').filter(line => line.trim());

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const jsonStr = line.substring(6);
                        try {
                            const data = JSON.parse(jsonStr);

                            if (data.type === 'start') {
                                log('✓ Stream started', 'green');
                            } else if (data.type === 'chunk') {
                                process.stdout.write(data.content);
                                fullResponse += data.content;
                            } else if (data.type === 'done') {
                                log('\n✓ Stream completed', 'green');
                                resolve(true);
                            } else if (data.type === 'error') {
                                log('\n✗ Stream error: ' + data.error, 'red');
                                resolve(false);
                            }
                        } catch (e) {
                            // Ignore parse errors
                        }
                    }
                }
            });

            response.data.on('error', (error) => {
                log('\n✗ Stream failed: ' + error.message, 'red');
                resolve(false);
            });
        });
    } catch (error) {
        log('✗ Streaming query failed: ' + error.message, 'red');
        return false;
    }
}

async function runAllTests() {
    log('╔════════════════════════════════════════╗', 'cyan');
    log('║      RAG Chatbot API Test Suite      ║', 'cyan');
    log('╚════════════════════════════════════════╝', 'cyan');

    const results = {
        passed: 0,
        failed: 0
    };

    // Test 1: Health Check
    if (await testHealthCheck()) {
        results.passed++;
    } else {
        results.failed++;
        log('\n⚠ Server may not be running. Start it with: npm start', 'yellow');
        return;
    }

    // Test 2: Model Info
    if (await testModelInfo()) {
        results.passed++;
    } else {
        results.failed++;
    }

    // Test 3: Documents
    const hasDocuments = await testDocuments();
    if (hasDocuments) {
        results.passed++;
    } else {
        results.failed++;
        log('\n⚠ No documents found. Make sure PDFs are in the data folder.', 'yellow');
    }

    // Test 4-7: Queries (only if documents are available)
    if (hasDocuments) {
        const queries = [
            { question: 'How do I create a new user?', type: 'erp' },
            { question: 'What is the process for inventory management?', type: 'erp' },
            { question: 'How do I submit a leave request?', type: 'hrms' },
            { question: 'What are the attendance policies?', type: 'hrms' }
        ];

        for (const query of queries) {
            if (await testQuery(query.question, query.type)) {
                results.passed++;
            } else {
                results.failed++;
            }

            // Wait between queries to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Test 8: Streaming
        if (await testStreamingQuery('Explain the dashboard features', 'erp')) {
            results.passed++;
        } else {
            results.failed++;
        }
    }

    // Summary
    log('\n╔════════════════════════════════════════╗', 'cyan');
    log('║           Test Summary                ║', 'cyan');
    log('╚════════════════════════════════════════╝', 'cyan');
    log(`\nTests Passed: ${results.passed}`, 'green');
    log(`Tests Failed: ${results.failed}`, results.failed > 0 ? 'red' : 'green');

    if (results.failed === 0) {
        log('\n🎉 All tests passed successfully!', 'green');
    } else {
        log('\n⚠ Some tests failed. Check the output above for details.', 'yellow');
    }
}

// Run tests
runAllTests().catch(error => {
    log('\n✗ Test suite failed: ' + error.message, 'red');
    process.exit(1);
});