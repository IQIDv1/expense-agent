import { z } from 'zod';

const Extraction = z.object({
  merchant: z.string().nullable(),
  amountTotal: z.number().nullable(),
  amountTax: z.number().nullable().optional(),
  currency: z.string().nullable().optional(),
  items: z
    .array(
      z.object({
        description: z.string(),
        amount: z.number().nonnegative(),
      }),
    )
    .optional(),
  date: z.string().nullable(),
  location: z
    .object({
      city: z.string().optional(),
      state: z.string().optional(),
      country: z.string().optional(),
    })
    .partial()
    .optional(),
  paymentMethod: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  invoiceNumber: z.string().nullable().optional(),
});

export type ExtractionT = z.infer<typeof Extraction>;

export async function runOpenAIVision({
  bytes,
  filename,
  mime,
}: {
  bytes: Buffer;
  filename: string;
  mime?: string;
}): Promise<ExtractionT> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY missing');
  }

  const base64 = bytes.toString('base64');
  const prompt = `Extract fields as JSON with keys: merchant, amountTotal, amountTax, currency, items[{description,amount}], date (ISO if possible), location{city,state,country}, paymentMethod, category, invoiceNumber. Use null if unknown. Return ONLY JSON.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a strict JSON extractor.' },
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mime || 'image/png'};base64,${base64}`,
              },
            },
          ],
        },
      ],
      temperature: 0,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const message = data.choices?.[0]?.message;
  let content: unknown = message?.content ?? '{}';

  if (Array.isArray(content)) {
    content = content
      .map((part: { text?: string }) => part.text ?? '')
      .join('\n');
  }

  const contentString =
    typeof content === 'string' && content.length > 0
      ? content
      : JSON.stringify(content);

  const jsonString =
    contentString.match(/\{[\s\S]*\}/)?.[0]?.trim() ?? contentString;

  let json: unknown;
  try {
    json = JSON.parse(jsonString);
  } catch {
    throw new Error(`Failed to parse OpenAI response for ${filename}`);
  }

  const parsed = Extraction.safeParse(json);
  if (!parsed.success) {
    throw new Error('Bad extraction');
  }
  return parsed.data;
}

