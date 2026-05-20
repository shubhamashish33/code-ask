const maxChunkLines = 80;
const maxChunkChars = 8_000;

export type CodeChunk = {
  id: string;
  file: string;
  startLine: number;
  endLine: number;
  text: string;
};

export function chunkFile(file: string, contents: string): CodeChunk[] {
  const normalized = contents.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const chunks: CodeChunk[] = [];
  let start = 0;

  while (start < lines.length) {
    let end = Math.min(start + maxChunkLines, lines.length);
    let text = lines.slice(start, end).join("\n").trim();

    while (text.length > maxChunkChars && end > start + 10) {
      end = start + Math.max(10, Math.floor((end - start) / 2));
      text = lines.slice(start, end).join("\n").trim();
    }

    if (text.length > 0) {
      chunks.push({
        id: `${file}:${start + 1}-${end}`,
        file,
        startLine: start + 1,
        endLine: end,
        text
      });
    }

    start = end;
  }

  return chunks;
}
