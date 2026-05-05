import OpenAI from 'openai';

const openai = new OpenAI();

/** Languages we translate product titles/descriptions into */
const TARGET_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'id', name: 'Bahasa Indonesia' },
  { code: 'th', name: 'Thai' },
  { code: 'vi', name: 'Vietnamese' },
] as const;

export interface TranslationResult {
  languageCode: string;
  name: string;
  description?: string;
}

/**
 * Translate a Chinese product title & description into all target languages.
 * Uses a single OpenAI call with structured output for efficiency.
 */
export async function translateProduct(
  titleZh: string,
  descriptionZh?: string | null
): Promise<TranslationResult[]> {
  const prompt = buildTranslationPrompt(titleZh, descriptionZh);

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('Empty translation response from OpenAI');

  const parsed = JSON.parse(content);

  return TARGET_LANGUAGES.map(lang => ({
    languageCode: lang.code,
    name: parsed[lang.code]?.name ?? titleZh,
    description: parsed[lang.code]?.description ?? descriptionZh ?? undefined,
  }));
}

function buildTranslationPrompt(titleZh: string, descriptionZh?: string | null): string {
  const descPart = descriptionZh
    ? `Description (Chinese): ${descriptionZh.slice(0, 2000)}`
    : '';

  return `Translate this 1688 product listing into 4 languages.
Return a JSON object with keys "en", "id", "th", "vi".
Each value should be an object with "name" (max 200 chars) and "description" (max 2000 chars).

Title (Chinese): ${titleZh}
${descPart}

Rules:
- Translate product name naturally for each market (not literal translation)
- Keep brand names and model numbers unchanged
- Description should be marketing-friendly, not just a direct translation
- Return only valid JSON, no markdown fences`;
}

/**
 * Batch translate multiple products. Processes in parallel with concurrency limit.
 */
export async function batchTranslate(
  items: Array<{ titleZh: string; descriptionZh?: string | null }>,
  concurrency = 3
): Promise<TranslationResult[][]> {
  const results: TranslationResult[][] = [];
  const queue = [...items];

  async function worker() {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;
      try {
        const translations = await translateProduct(item.titleZh, item.descriptionZh);
        results.push(translations);
      } catch (err) {
        console.error(`Translation failed for "${item.titleZh.slice(0, 30)}...":`, err);
        // Fallback: use Chinese original for all languages
        results.push(
          TARGET_LANGUAGES.map(lang => ({
            languageCode: lang.code,
            name: item.titleZh,
            description: item.descriptionZh ?? undefined,
          }))
        );
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}
