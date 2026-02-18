
const fs = require('fs');
const readline = require('readline');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// Manual .env parsing
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            let value = match[2].trim();
            if (value.startsWith('"') && value.endsWith('"')) {
                value = value.slice(1, -1);
            }
            process.env[key] = value;
        }
    });
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: Missing Supabase URL or Key in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
    },
});

const CSV_FILE = 'decs_hierarquia_vetorizado.csv';
const BATCH_SIZE = 500;

async function processLineByLine() {
    const fileStream = fs.createReadStream(CSV_FILE);

    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let headers = [];
    let batch = [];
    let lineCount = 0;
    let isFirstLine = true;

    for await (const line of rl) {
        if (isFirstLine) {
            // Skip header or parse it if needed. Assuming fixed structure from analysis.
            // ID_DeCS,Termo,Tree_Numbers,Termo_Limpo,Embedding
            isFirstLine = false;
            continue;
        }

        try {
            const record = parseCsvLine(line);
            if (record) {
                batch.push(record);
            }
        } catch (e) {
            console.warn('Failed to parse line:', line.substring(0, 50) + '...', e.message);
        }

        if (batch.length >= BATCH_SIZE) {
            await insertBatch(batch);
            lineCount += batch.length;
            console.log(`Processed ${lineCount} records...`);
            batch = [];
        }
    }

    if (batch.length > 0) {
        await insertBatch(batch);
        lineCount += batch.length;
    }

    console.log(`Finished! Total records imported: ${lineCount}`);
}

// Simple manual CSV parser tailored for this specific file format
// ID_DeCS,Termo,Tree_Numbers,Termo_Limpo,Embedding
function parseCsvLine(line) {
    // Regex to capture the 5 fields. 
    // 1: ID (no quotes)
    // 2: Termo (can be quoted with newlines, but readline feeds line by line. 
    //    Wait, readline splits by \n. If 'Termo' has \n inside quotes, readline will break it.
    //    We need to handle multiline CSV if the file has newlines in fields.
    //    Let's assume the file provided by user is well-formed or simple enough.
    //    Looking at the view_file output:
    //    2: D000001,"
    //    3:     Calcimicina[Calcimycin]
    //    4:    ",D02...
    //    YES, it has multiline fields. Readline line-by-line is NOT sufficient if we just process 'line'.
    //    We need a state machine.
    return null; // Logic moved to main loop to handle multilines
}

async function run() {
    console.log('Starting DeCS import...');

    // We need a more robust approach for multiline CSV
    const fileContent = fs.readFileSync(CSV_FILE, 'utf8');
    // Using a simple split might kill memory (500MB). 
    // Let's stick to regex global match which is efficient in V8?
    // Or just write a simple char-by-char parser.

    // Actually, let's use a char-by-char state machine parser to be memory efficient and correct.
    const fd = fs.openSync(CSV_FILE, 'r');
    const bufferSize = 64 * 1024; // 64kb
    const buffer = Buffer.alloc(bufferSize);
    let bytesRead = 0;
    let filePos = 0;

    let currentField = '';
    let currentRow = [];
    let insideQuotes = false;
    let records = [];
    let processedCount = 0;

    let leftover = '';

    while ((bytesRead = fs.readSync(fd, buffer, 0, bufferSize, filePos)) !== 0) {
        filePos += bytesRead;
        const chunk = leftover + buffer.toString('utf8', 0, bytesRead);
        leftover = '';

        for (let i = 0; i < chunk.length; i++) {
            const char = chunk[i];

            if (char === '"') {
                if (insideQuotes && chunk[i + 1] === '"') {
                    // Escaped quote "" -> "
                    currentField += '"';
                    i++;
                } else {
                    insideQuotes = !insideQuotes;
                }
            } else if (char === ',' && !insideQuotes) {
                currentRow.push(currentField.trim());
                currentField = '';
            } else if ((char === '\n' || char === '\r') && !insideQuotes) {
                if (currentField.length > 0 || currentRow.length > 0) { // End of line
                    currentRow.push(currentField.trim());
                    if (currentRow.length >= 5) { // Check valid row length
                        records.push(mapRowResult(currentRow));
                    }
                    currentRow = [];
                    currentField = '';

                    if (records.length >= BATCH_SIZE) {
                        await insertBatch(records);
                        processedCount += records.length;
                        console.log(`Imported ${processedCount}...`);
                        records = [];
                    }
                }
                // Handle \r\n
                if (char === '\r' && chunk[i + 1] === '\n') {
                    i++;
                }
            } else {
                currentField += char;
            }
        }

        // Keep the unfinished currentField for next chunk? 
        // No, currentField might be huge if we are unlucky? No, fields are small.
        // Actually, if we end in the middle of a field, we need to defer.
        // But processing char by char across buffer boundaries is tricky.
        // Simplified approach: Split by lines, but merge if quotes are unbalanced.
    }
    // Handle last row
    if (records.length > 0) {
        await insertBatch(records);
        processedCount += records.length;
    }
    console.log(`Done. Total ${processedCount}.`);
}

function mapRowResult(row) {
    // ID_DeCS,Termo,Tree_Numbers,Termo_Limpo,Embedding
    // Row might have index 0..4
    // Filter out header
    if (row[0] === 'ID_DeCS') return null;

    // Parse embedding
    let embeddingVal = null;
    try {
        const vecStr = row[4];
        if (vecStr && vecStr.startsWith('[') && vecStr.endsWith(']')) {
            embeddingVal = vecStr; // Supabase accepts string format "[1,2,3]" for vector
        }
    } catch {
        console.warn('Bad vector:', row[0]);
    }

    return {
        decs_code: row[0],
        term: row[1],
        tree_numbers: row[2] ? row[2].split('|').map(s => s.trim()) : [],
        clean_term: row[3],
        embedding: embeddingVal
    };
}

async function insertBatch(batch) {
    const validBatch = batch.filter(x => x && x.decs_code && x.embedding);
    if (validBatch.length === 0) return;

    const { error } = await supabase
        .from('decs_terms')
        .upsert(validBatch, { onConflict: 'decs_code' });

    if (error) {
        console.error('Batch Insert Error:', error.message);
    }
}

// Redoing the approach: simple line reader with state
// Since the file is 500MB, we can't load it all.
// But we know newlines inside fields are only in "Termo" field (index 1).
async function robustImport() {
    const fileStream = fs.createReadStream(CSV_FILE, { encoding: 'utf8' });
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    let pendingRow = '';
    let batch = [];
    let count = 0;

    for await (let line of rl) {
        // If we have a pending broken row, append this line
        let currentLine = pendingRow ? pendingRow + '\n' + line : line;

        // Count quotes to check balance
        const quoteCount = (currentLine.match(/"/g) || []).length;

        if (quoteCount % 2 !== 0) {
            // Unbalanced quotes, multiline field continues...
            pendingRow = currentLine;
            continue;
        } else {
            pendingRow = ''; // Row complete
        }

        const cols = parseCSVRecord(currentLine);
        if (!cols || cols[0] === 'ID_DeCS') continue;

        const record = mapRowResult(cols);
        if (record) batch.push(record);

        if (batch.length >= 200) {
            await insertBatch(batch);
            count += batch.length;
            console.log(`Imported ${count}`);
            batch = [];
        }
    }

    if (batch.length > 0) {
        await insertBatch(batch);
        count += batch.length;
    }
    console.log(`Finished. Total: ${count}`);
}

function parseCSVRecord(str) {
    // Basic CSV regex parser that handles quotes
    const pattern = /(".*?"|[^",\s]+)(?=\s*,|\s*$)/g;
    // Actually, simple split is hard. Let's use a dedicated simplistic parser
    const result = [];
    let startValueIndex = 0;
    let insideQuote = false;

    for (let i = 0; i < str.length; i++) {
        if (str[i] === '"') {
            insideQuote = !insideQuote;
        } else if (str[i] === ',' && !insideQuote) {
            let val = str.substring(startValueIndex, i);
            val = val.trim().replace(/^"|"$/g, '').replace(/""/g, '"');
            result.push(val);
            startValueIndex = i + 1;
        }
    }
    // Last field
    let val = str.substring(startValueIndex);
    val = val.trim().replace(/^"|"$/g, '').replace(/""/g, '"');
    result.push(val);

    return result;
}

robustImport().catch(console.error);
