const fs = require('fs');
const pdfParse = require('pdf-parse-fork');
const { RecursiveCharacterTextSplitter } = require('langchain/text_splitter');

class PDFProcessor {
    async extractText(pdfPath) {
        try {
            console.log(`Reading PDF from: ${pdfPath}`);
            const dataBuffer = fs.readFileSync(pdfPath);

            console.log(`PDF size: ${(dataBuffer.length / 1024).toFixed(2)} KB`);

            // Use pdf-parse-fork with options for better compatibility
            const data = await pdfParse(dataBuffer, {
                max: 0, // Parse all pages
                version: 'v1.10.100'
            });

            console.log(`Extracted ${data.numpages} pages`);
            console.log(`Total characters: ${data.text.length}`);

            if (!data.text || data.text.trim().length === 0) {
                throw new Error('PDF appears to be empty or contains only images');
            }

            return data.text;
        } catch (error) {
            console.error('PDF extraction error:', error.message);

            // Provide helpful error messages
            if (error.message.includes('bad XRef') || error.message.includes('Invalid PDF')) {
                throw new Error(
                    'PDF file appears to be corrupted or has an invalid structure. ' +
                    'Please try:\n' +
                    '1. Re-saving the PDF using Adobe Acrobat or another PDF tool\n' +
                    '2. Converting it to PDF from the original document\n' +
                    '3. Using a PDF repair tool'
                );
            }

            throw error;
        }
    }

    async splitIntoChunks(text, chunkSize = 1000, chunkOverlap = 200) {
        // Clean the text first
        const cleanedText = text
            .replace(/\r\n/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .replace(/\s+/g, ' ')
            .trim();

        const textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize,
            chunkOverlap,
            separators: ['\n\n', '\n', '. ', ' ', '']
        });

        const chunks = await textSplitter.splitText(cleanedText);
        return chunks;
    }

    async processPDF(pdfPath) {
        console.log('Extracting text from PDF...');
        const text = await this.extractText(pdfPath);

        console.log('Splitting text into chunks...');
        const chunks = await this.splitIntoChunks(text);

        console.log(`Created ${chunks.length} chunks`);
        return chunks;
    }
}

module.exports = new PDFProcessor();