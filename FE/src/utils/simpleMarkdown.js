// Phân tích markdown tối giản trong câu trả lời AI (Gemini): **đậm**, gạch đầu dòng, đánh số, dòng tiêu đề.
// Không phải trình phân tích markdown đầy đủ — đủ cho văn bản giải thích kết quả.

const parseInline = (text) => {
  const segments = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) segments.push({ text: text.slice(last, m.index), bold: false });
    segments.push({ text: m[1], bold: true });
    last = re.lastIndex;
  }
  if (last < text.length) segments.push({ text: text.slice(last), bold: false });
  return segments;
};

export const parseSimpleMarkdown = (text) => {
  if (!text) return [];
  const blocks = [];
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    const bullet = line.match(/^[*\-•]\s+(.*)$/);
    if (bullet) {
      blocks.push({ type: 'bullet', segments: parseInline(bullet[1]) });
      continue;
    }
    const numbered = line.match(/^(\d+[.)])\s+(.*)$/);
    if (numbered) {
      blocks.push({ type: 'numbered', marker: numbered[1], segments: parseInline(numbered[2]) });
      continue;
    }
    const heading = line.match(/^#{1,6}\s+(.*)$/) || line.match(/^\*\*([^*]+)\*\*:?$/);
    if (heading) {
      blocks.push({ type: 'heading', segments: [{ text: heading[1].replace(/\*\*/g, ''), bold: true }] });
      continue;
    }
    blocks.push({ type: 'paragraph', segments: parseInline(line) });
  }
  return blocks;
};
