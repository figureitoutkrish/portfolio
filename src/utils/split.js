// Wraps each word of an element in a span.word so words can animate one by one.
// Child elements (e.g. the underlined "alter egos") are kept whole and count as one word.
export function splitWords(el) {
  const words = [];
  [...el.childNodes].forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      node.classList.add('word');
      words.push(node);
      return;
    }
    const frag = document.createDocumentFragment();
    node.textContent.split(/(\s+)/).forEach((token) => {
      if (!token) return;
      if (/^\s+$/.test(token)) {
        frag.append(token);
        return;
      }
      const span = document.createElement('span');
      span.className = 'word';
      span.textContent = token;
      frag.append(span);
      words.push(span);
    });
    node.replaceWith(frag);
  });
  return words;
}
