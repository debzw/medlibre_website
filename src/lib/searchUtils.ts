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
    text = text.toLowerCase();
    query = query.toLowerCase().trim();

    if (!query) return true;
    if (text.includes(query)) return true;

    const targetWords = text.split(/\s+/);
    const queryWords = query.split(/\s+/);

    // Acronym check: check if initials of target words form the query
    if (queryWords.length === 1 && query.length >= 2 && query.length <= 4) {
        const initials = targetWords.map(w => w[0]).join('');
        if (initials.includes(query)) return true;
    }

    return queryWords.every(qWord => {
        // Exact substring match check for each word
        if (text.includes(qWord)) return true;

        // Stricter dynamic threshold
        let threshold = 0;
        if (qWord.length >= 4 && qWord.length <= 6) threshold = 1;
        if (qWord.length > 6) threshold = 2;

        if (threshold === 0) return false;

        // Fuzzy word matching
        return targetWords.some(tWord => {
            if (tWord.length < qWord.length - 1) return false;

            // Only fuzzy match if the first letter is the same (standard UX optimization)
            if (tWord[0] !== qWord[0]) return false;

            const dist = levenshteinDistance(tWord.substring(0, qWord.length + 1), qWord);
            return dist <= threshold;
        });
    });
}

/**
 * Returns an array of parts with highlight flag for rendering.
 */
export function getHighlightedParts(text: string, query: string): { text: string; highlight: boolean }[] {
    if (!query) return [{ text, highlight: false }];

    const lowerText = text.toLowerCase();
    const queryWords = query.toLowerCase().trim().split(/\s+/).filter(w => w.length > 0);

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
