export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { text, mode, password } = req.body || {};
  if (password !== '12345') return res.status(401).json({ error: '密码错误' });
  if (!text || text.length < 10) return res.status(400).json({ error: '请输入文章内容' });
  if (text.length > 8000) return res.status(400).json({ error: '文章太长，请控制在8000字以内' });

  const openai = async (messages, max_tokens = 2000) => {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY },
      body: JSON.stringify({ model: 'gpt-4o', max_tokens, temperature: 0.3, messages })
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error?.message || 'OpenAI error');
    return d.choices[0].message.content.trim();
  };

  try {
    if (mode === 'humanize') {
      // Triple translation: EN -> ZH -> JA -> EN
      const zh = await openai([
        { role: 'system', content: '你是专业翻译。将以下英文准确翻译成中文，保留所有原意和细节，只输出译文。' },
        { role: 'user', content: text }
      ]);

      const ja = await openai([
        { role: 'system', content: 'あなたはプロの翻訳者です。以下の中国語を日本語に正確に翻訳してください。訳文のみ出力してください。' },
        { role: 'user', content: zh }
      ]);

      const en = await openai([
        { role: 'system', content: 'You are a professional translator. Translate the following Japanese text into natural, fluent academic English. Output only the translation.' },
        { role: 'user', content: ja }
      ]);

      return res.json({ ok: true, result: en, steps: { zh, ja, en }, mode: 'humanize' });
    }

    if (mode === 'polish') {
      const result = await openai([
        { role: 'system', content: `You are an expert academic writing editor for university students. Polish the essay to improve clarity, coherence, and academic tone. 
Rules:
- Preserve all original arguments and ideas
- Vary sentence length and structure naturally  
- Use precise vocabulary but avoid overly complex words
- Remove redundancy and improve flow
- Output ONLY the polished essay, no explanations` },
        { role: 'user', content: text }
      ], 3000);

      return res.json({ ok: true, result, mode: 'polish' });
    }

    if (mode === 'both') {
      // Polish first, then triple translate
      const polished = await openai([
        { role: 'system', content: `You are an expert academic writing editor. Polish this essay for clarity and coherence. Vary sentence structures naturally. Output ONLY the polished essay.` },
        { role: 'user', content: text }
      ], 3000);

      const zh = await openai([
        { role: 'system', content: '你是专业翻译。将以下英文准确翻译成中文，只输出译文。' },
        { role: 'user', content: polished }
      ]);

      const ja = await openai([
        { role: 'system', content: 'プロの翻訳者として、以下の中国語を日本語に翻訳してください。訳文のみ出力。' },
        { role: 'user', content: zh }
      ]);

      const en = await openai([
        { role: 'system', content: 'Translate the following Japanese into natural, fluent academic English. Output only the translation.' },
        { role: 'user', content: ja }
      ]);

      return res.json({ ok: true, result: en, polished, steps: { zh, ja, en }, mode: 'both' });
    }

    return res.status(400).json({ error: '无效的模式' });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
