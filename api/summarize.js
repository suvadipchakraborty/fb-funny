// Vercel serverless function. Keeps your Gemini key off the phone.
const TONES = {
  funny: "hilarious and lighthearted",
  news: "hilarious, like a dramatic breaking-news anchor",
  sports: "hilarious, like an overexcited sports commentator",
  nature: "hilarious, like a deadpan nature-documentary narrator",
};

const SYSTEM = (tone) => `You write funny summaries of Facebook comment sections.
Input: screenshots (consecutive slices of one long scrolling capture, so a comment may be cut between slices; do not double count) and/or pasted text. The original post is usually NOT visible, so infer what it is about from the comments and never invent details of the post.
Task: write a 4-5 sentence summary in a ${tone} style. Capture the main opinions, how the crowd is split, and the funniest moments.
Rules:
- Write in the language that the majority of the comments are written in, matching their script and style (e.g. Hinglish in Latin letters stays in Latin letters). If comments are mixed, pick the most common one. Do not translate to English unless most comments are English.
- Do not name or quote individuals. Never insult people or mock protected groups, victims or tragedies. Poke fun at the situation and the chaos, not at people.
- If the post is about something sad or serious, stay warm and gentle with only mild humour.
- At most 2 emoji.
- Output ONLY the summary text. No title, no preamble, no markdown, no quotation marks.`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const pw = process.env.APP_PASSWORD;
  if (pw && req.headers["x-app-password"] !== pw)
    return res.status(401).json({ error: "Wrong or missing app password (tap ⚙ to set it)." });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: "GEMINI_API_KEY is not set on the server." });

  const { images = [], text = "", tone = "funny" } = req.body || {};
  if (!images.length && !text.trim())
    return res.status(400).json({ error: "Add some screenshots or text first." });

  const parts = [{ text: "Here are the comments from the Facebook post." }];
  if (text.trim()) parts.push({ text: "Pasted text:\n" + text.slice(0, 20000) });
  images.slice(0, 16).forEach((b64) =>
    parts.push({ inline_data: { mime_type: "image/jpeg", data: b64 } })
  );

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM(TONES[tone] || TONES.funny) }] },
          contents: [{ role: "user", parts }],
          generationConfig: {
            temperature: 1.0,
            maxOutputTokens: 700,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      }
    );
    const data = await r.json();
    if (!r.ok)
      return res.status(502).json({ error: data?.error?.message || "Gemini error " + r.status });
    const out = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("").trim();
    if (!out) return res.status(502).json({ error: "Gemini returned nothing (maybe blocked). Try again." });
    res.status(200).json({ summary: out });
  } catch (e) {
    res.status(500).json({ error: "Server error: " + e.message });
  }
}
