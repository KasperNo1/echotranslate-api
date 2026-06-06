export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { materials, subject, courseCode, password } = req.body || {};
  const valid = (process.env.ACCESS_PASSWORDS || '').split(',').map(p => p.trim());
  if (!valid.includes(password)) return res.status(401).json({ error: '密码错误' });
  if (!materials || Object.keys(materials).length === 0) return res.status(400).json({ error: '请提供至少一项材料' });

  const smap = {
    econ: '经济学/商科/公司治理',
    law: '法律',
    cs: '计算机/工程',
    bio: '生物/医学',
    math: '数学/统计',
    general: '通用学术'
  };

  const parts = [];
  if (materials.lec) parts.push('【Lecture字幕/录音】\n' + materials.lec.slice(0, 4000));
  if (materials.tut) parts.push('【Tutorial笔记】\n' + materials.tut.slice(0, 2500));
  if (materials.ppt) parts.push('【课件/PPT内容】\n' + materials.ppt.slice(0, 2500));
  if (materials.hw)  parts.push('【作业/练习题】\n' + materials.hw.slice(0, 1500));

  const systemPrompt = `你是专业的澳洲大学留学生课堂笔记整理助手。根据提供的材料整理出结构化中文学习笔记。
材料处理规则：
- Lec字幕：提取核心知识点、教授重点强调的内容
- Tut笔记：补充讨论要点和案例分析
- PPT/课件：提取章节结构、关键概念和定义
- 作业/题目：预测考试重点，分析题型
- 材料少时专注现有内容，不编造

必须严格按以下JSON格式输出，只输出JSON，不要任何其他文字：
{"overview":"本节课概述2-3句","concepts":[{"term":"英文术语","zh":"中文解释","note":"补充说明"}],"structure":"课程逻辑结构（分点，每点换行）","keypoints":["重点1","重点2","重点3"],"details":["详细知识点1","详细知识点2"],"tut_points":["Tut讨论要点1"],"exam":["考点预测1","考点预测2"],"exam_tips":"考试建议","unclear":["需要进一步理解的点1"]}`;

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
        model: 'gpt-4o-mini',
        max_tokens: 2000,
        temperature: 0.3,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      })
    });
    const data = await r.json();
    if (!r.ok) return res.status(500).json({ error: data.error?.message || 'OpenAI error' });
    const raw = data.choices[0].message.content.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
    const notes = JSON.parse(raw);
    res.json({ ok: true, notes, matCount: parts.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
