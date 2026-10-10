export function downloadTextFile(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const protocolFilename = (title: string): string =>
  `${title.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'protocol'}.md`;
