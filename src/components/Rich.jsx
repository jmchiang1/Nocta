/* Nocta — tiny inline markdown renderer.
 * Supports **bold** -> <strong> and *italic* -> <em>. Used for AI insight copy. */

const TOKEN = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;

export function Rich({ text }) {
  if (!text) return null;
  const parts = String(text).split(TOKEN);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('*') && part.endsWith('*')) {
          return <em key={i}>{part.slice(1, -1)}</em>;
        }
        return part;
      })}
    </>
  );
}
