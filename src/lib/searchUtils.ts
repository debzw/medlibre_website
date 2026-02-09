/**
 * Normalizes text by removing accents and converting to lowercase.
 * Example: "Cirúrgica" → "cirurgica"
 */
export function normalize(text: string | null | undefined): string {
    if (!text) return '';
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Extracts common medical acronyms from text.
 * Example: "Ginecologia e Obstetrícia" → ["GO"]
 */
export function extractAcronyms(text: string): string[] {
    const words = text.split(/[\s-]+/).filter(w => w.length > 0);

    // Single acronym from initials
    if (words.length >= 2) {
        const acronym = words.map(w => w[0]).join('').toUpperCase();
        return [acronym];
    }

    return [];
}

/**
 * Known medical acronyms mapping
 */
export const KNOWN_ACRONYMS: Record<string, string[]> = {
    'PA': ['Pediatria', 'Pneumologia'],
    'GO': ['Ginecologia', 'Obstetrícia'],
    'UTI': ['Unidade de Terapia Intensiva'],
    'AVC': ['Acidente Vascular Cerebral'],
    'IAM': ['Infarto Agudo do Miocárdio'],
    'DM': ['Diabetes Mellitus'],
    'HAS': ['Hipertensão Arterial Sistêmica'],
    'TEP': ['Tromboembolismo Pulmonar'],
    'ICC': ['Insuficiência Cardíaca Congestiva'],
};

/**
 * Calculates the Levenshtein distance between two strings.
 * Used for fuzzy matching to handle typos.
 */
export function levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    matrix[i][j - 1] + 1,     // insertion
                    matrix[i - 1][j] + 1      // deletion
                );
            }
        }
    }

    return matrix[b.length][a.length];
}

/**
 * Checks if a query fuzzy matches a target text.
 * A match is found if the query is a substring OR if the edit distance is small enough.
 */
export function fuzzyMatch(text: string, query: string): boolean {
    text = normalize(text);
    query = normalize(query.trim());

    if (!query) return true;
    if (text.includes(query)) return true;

    const targetWords = text.split(/\s+/);
    const queryWords = query.split(/\s+/);

    // For each query word, check if it matches any target word with fuzzy logic
    return queryWords.every(qWord => {
        // Proportional threshold: allow 20% errors (stricter than 25% to avoid false positives like cirurgia->preventiva)
        const threshold = Math.max(1, Math.floor(qWord.length * 0.20));

        return targetWords.some(tWord => {
            // Exact match or substring
            if (tWord === qWord || tWord.includes(qWord)) return true;

            // Prefix match (e.g., "cardio" matches "cardiologia")
            if (tWord.startsWith(qWord) && qWord.length >= 3) return true;

            // Fuzzy match with proportional threshold
            const distance = levenshteinDistance(tWord, qWord);
            return distance <= threshold;
        });
    });
}

/**
 * Returns an array of parts with highlight flag for rendering.
 */
export function getHighlightedParts(text: string, query: string): { text: string; highlight: boolean }[] {
    if (!query) return [{ text, highlight: false }];

    const lowerText = normalize(text);
    const queryWords = normalize(query.trim()).split(/\s+/).filter(w => w.length > 0);

    if (queryWords.length === 0) return [{ text, highlight: false }];

    // Find all matches (exact for now, fuzzy highlighting is tricky)
    const matches: { start: number; end: number }[] = [];

    queryWords.forEach(word => {
        let pos = lowerText.indexOf(word);
        while (pos !== -1) {
            matches.push({ start: pos, end: pos + word.length });
            pos = lowerText.indexOf(word, pos + 1);
        }
    });

    if (matches.length === 0) return [{ text, highlight: false }];

    // Sort and merge overlapping matches
    matches.sort((a, b) => a.start - b.start);
    const mergedMatches: typeof matches = [];
    if (matches.length > 0) {
        let current = matches[0];
        for (let i = 1; i < matches.length; i++) {
            if (matches[i].start <= current.end) {
                current.end = Math.max(current.end, matches[i].end);
            } else {
                mergedMatches.push(current);
                current = matches[i];
            }
        }
        mergedMatches.push(current);
    }

    // Split text into highlighted and non-highlighted parts
    const parts: { text: string; highlight: boolean }[] = [];
    let lastPos = 0;

    mergedMatches.forEach(match => {
        if (match.start > lastPos) {
            parts.push({ text: text.substring(lastPos, match.start), highlight: false });
        }
        parts.push({ text: text.substring(match.start, match.end), highlight: true });
        lastPos = match.end;
    });

    if (lastPos < text.length) {
        parts.push({ text: text.substring(lastPos), highlight: false });
    }

    return parts;
}
