/**
 * Content safety checker for Google Merchant Center / Google Search.
 *
 * Google flags products that contain certain words in names/descriptions as
 * "Restricted adult content", which prevents them from appearing in Shopping
 * results and Search rich results.
 *
 * Use this in the admin product form to warn before saving — it does NOT block
 * the save, just surfaces a warning so the admin can edit the wording.
 */

const FLAGGED_WORDS = [
    'sensual',
    'seductive',
    'sexy',
    'arousing',
    'erotic',
    'intimate arousal',
    'explicit',
    'adult only',
    'for adults',
]

/**
 * Returns an array of flagged words found in the given text.
 * Empty array means the text is clean.
 */
export function checkForFlaggedContent(text: string): string[] {
    const lower = text.toLowerCase()
    return FLAGGED_WORDS.filter((word) => lower.includes(word))
}

/**
 * Safe replacement suggestions for flagged words.
 * Use these when rewriting product descriptions.
 */
export const FLAGGED_WORD_REPLACEMENTS: Record<string, string> = {
    sensual: '"warm" or "captivating"',
    seductive: '"alluring" or "enchanting"',
    sexy: '"bold" or "confident"',
    arousing: '"invigorating"',
    erotic: '(remove entirely)',
    'intimate arousal': '(remove entirely)',
    explicit: '(remove entirely)',
    'adult only': '(remove entirely)',
    'for adults': '(remove entirely)',
}
