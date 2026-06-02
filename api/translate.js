export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();
  const { text, subject, password } = req.body || {};
  const valid = (process.env.ACCESS_PASSWORDS || '').split(',').map(p => p.trim()).filter(Boolean);
  if (!valid.includes(password)) return res.status(401).json({ error: '密码错误' });
  if (!text || text.length > 500) return res.status(400).json({ error: 'invalid' });
  const S = {econ:'经济学与商科课程，保留专业术语',law:'法律课程',cs:'计算机科学课程，技术术语保留英文',bio:'生物医学课程',math:'数学统计课程',general:'学术课程'};
  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY },
      body: JSON.stringify({ model: 'gpt-4o-mini', max_tokens: 100, temperature: 0,
        messages: [{ role: 'system', content: '你是UNSW' + (S[subject]||S.general) + '翻译助手。英文字幕译成简洁中文，只输出翻译，不超过30字。' }, { role: 'user', content: text }] })
    });
    const data = await r.json();
    if (!r.ok) return res.status(500).json({ error: data.error?.message || 'error' });
    res.json({ zh: data.choices[0].message.content.trim() });
  } catch(e) { res.status(500).json({ error: e.message }); }
}
