export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { materials, subject, courseCode, password } = req.body || {};
  if (password !== '12345') return res.status(401).json({ error: '密码错误' });
  if (!materials || Object.keys(materials).filter(k => materials[k] && materials[k].length > 10).length === 0)
    return res.status(400).json({ error: '请提供至少一项材料' });

  const smap = {
    econ: '经济学/商科/公司治理', law: '法律', cs: '计算机/工程',
    bio: '生物/医学', math: '数学/统计', general: '通用学术'
  };

  const parts = [];
  if (materials.lec && materials.lec.length > 10) parts.push('【Lecture字幕/录音】\n' + materials.lec.slice(0, 6000));
  if (materials.tut && materials.tut.length > 10) parts.push('【Tutorial笔记】\n' + materials.tut.slice(0, 4000));
  if (materials.ppt && materials.ppt.length > 10) parts.push('【课件/PPT内容】\n' + materials.ppt.slice(0, 4000));
  if (materials.hw  && materials.hw.length  > 10) parts.push('【作业/练习题】\n' + materials.hw.slice(0, 2000));

  const systemPrompt = `你是专业的澳洲大学留学生课堂笔记整理专家，擅长将复杂课堂材料提炼成高质量备考笔记。

请根据提供的材料（可能包含Lec字幕、Tut笔记、PPT课件、作业题目），输出一份详尽、结构化的中文学习笔记。

要求：
- 内容要详细充实，不要泛泛而谈，每个知识点都要有实质内容
- 核心概念必须包含定义、含义、为什么重要
- 重点和考点要结合材料中教授/导师强调的内容
- 如果有作业题目，深度分析题型规律，预测高概率考点
- 专业术语保留英文，解释用中文
- 语言简洁专业，适合备考复习

必须严格按以下JSON格式输出，只输出JSON不要其他文字：
{
  "overview": "本节课3-5句详细概述，说明涵盖的主要主题和学习目标",
  "concepts": [
    {"term": "英文术语", "zh": "中文名称", "definition": "完整定义", "importance": "为什么重要/考试意义", "example": "具体例子（如有）"}
  ],
  "structure": "课程完整逻辑结构，分点详述每个部分的内容和联系",
  "keypoints": [
    {"point": "重点标题", "detail": "详细说明，至少2-3句话解释这个重点"}
  ],
  "details": [
    {"topic": "知识点名称", "content": "详细内容，包括原理、机制、应用等"}
  ],
  "tut_points": ["Tutorial讨论要点，包含讨论结论和实际应用"],
  "formulas": ["重要公式或框架（如有），格式：名称: 内容"],
  "exam": [
    {"question_type": "题型（如选择/论述/计算）", "topic": "考点", "tip": "答题要点和注意事项"}
  ],
  "exam_tips": "整体备考建议，重点复习方向",
  "connections": "本节内容与其他章节/课程的联系（如能判断）",
  "unclear": ["需要进一步理解或向老师确认的点"]
}`;

  const userPrompt = `课程：${smap[subject] || smap.general}${courseCode ? '（' + courseCode + '）' : ''}
已上传材料：${parts.length} 项

${parts.join('\n\n---\n\n')}`;

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 4000,
        temperature: 0.2,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      })
    });
    const data = await r.json();
    if (!r.ok) return res.status(500).json({ error: data.error?.message || 'OpenAI error' });
    const raw = data.choices[0].message.content.trim()
      .replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
    const notes = JSON.parse(raw);
    res.json({ ok: true, notes, matCount: parts.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
