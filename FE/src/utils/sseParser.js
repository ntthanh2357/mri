/**
 * Tách các frame SSE từ buffer text nhận qua fetch ReadableStream.
 * Trả về danh sách event đã hoàn chỉnh và phần chuỗi dư cho lần đọc tiếp theo.
 */
export const parseSseChunks = (buffer) => {
  const normalized = String(buffer || '').replace(/\r\n/g, '\n');
  const parts = normalized.split('\n\n');
  const rest = parts.pop() ?? '';
  const events = [];

  for (const block of parts) {
    if (!block || block.startsWith(':')) continue;
    let event = 'message';
    const dataLines = [];
    for (const line of block.split('\n')) {
      if (!line || line.startsWith(':')) continue;
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
    }
    const raw = dataLines.join('\n');
    let data = raw;
    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch {
        data = raw;
      }
    }
    events.push({ event, data });
  }

  return { events, rest };
};

