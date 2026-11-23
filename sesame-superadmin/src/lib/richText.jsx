/**
 * Minimal, safe formatting for news text (same rules as the student app):
 *   **gras**, *italique*, lignes « - » = liste à puces, ligne vide = paragraphe,
 *   URLs cliquables. Rendered as React elements — never as raw HTML.
 */
const INLINE = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|https?:\/\/[^\s<>"]+[^\s<>".,;:!?)\]])/g;

function inline(text, keyPrefix) {
  return text.split(INLINE).filter(Boolean).map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return <strong key={key}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) return <em key={key}>{part.slice(1, -1)}</em>;
    if (/^https?:\/\//.test(part)) return <a key={key} href={part} target="_blank" rel="noreferrer noopener">{part}</a>;
    return part;
  });
}

export function RichText({ text }) {
  const blocks = String(text || '').replace(/\r\n/g, '\n').split(/\n{2,}/);
  return (
    <div className="rich-text">
      {blocks.map((block, blockIndex) => {
        const lines = block.split('\n');
        if (lines.every((line) => /^\s*[-•]\s+/.test(line))) {
          return <ul key={blockIndex}>{lines.map((line, i) => <li key={i}>{inline(line.replace(/^\s*[-•]\s+/, ''), `${blockIndex}-${i}`)}</li>)}</ul>;
        }
        return (
          <p key={blockIndex}>
            {lines.map((line, i) => (
              <span key={i}>{i > 0 ? <br /> : null}{inline(line, `${blockIndex}-${i}`)}</span>
            ))}
          </p>
        );
      })}
    </div>
  );
}
