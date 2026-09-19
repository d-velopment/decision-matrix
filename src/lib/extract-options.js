// A conservative offline helper for explicitly written alternatives, not a semantic model.
// The OpenAI provider can identify more natural phrasing with verbatim supporting evidence.
const clean = value => value.trim().replace(/^[\s:;\-–—•\d.)]+|[\s.!?;]+$/g, '').replace(/^["“«']|["”»']$/g, '').trim();
const optionKey = value => value.toLocaleLowerCase().replace(/\s+/g, ' ').trim();
export function extractOptions(description) {
  const text = description.trim();
  const found = [];
  const push = candidates => {
    const labels = candidates.map(clean).filter(Boolean);
    if (labels.length < 2 || labels.length > 6 || labels.some(label => label.length > 100 || label.split(/\s+/).length > 12)) return;
    for (const label of labels) if (!found.some(item => optionKey(item) === optionKey(label))) found.push(label);
  };
  // A bullet list or an explicitly introduced list.
  const bullets = text.split(/\n/).filter(line => /^\s*(?:[-*•]|\d+[.)])\s+/.test(line));
  if (bullets.length >= 2) push(bullets.map(line => line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '')));
  if (found.length) return found;
  const introduced = text.match(/(?:options?|alternatives?|варианты|вариантами|альтернативы)\s*:\s*([^.!?]+)/iu);
  if (introduced) push(introduced[1].split(/[,;\n]|\s+(?:or|and|или|либо|и)\s+/iu));
  if (found.length) return found;
  // Explicit choices in quotation marks.
  const quoted = [...text.matchAll(/["“«]([^"”»\n]{1,100})["”»]/gu)].map(match => match[1]);
  if (/(?:choose|choosing|decid|between|options?|выб|реш|между|вариант)/iu.test(text)) push(quoted);
  if (found.length) return found;
  // Keep each alternative's own words, remove only the introductory choice phrase.
  const choice = text.match(/(?:\bbetween\s+|между\s+)([^.!?\n]+)/iu);
  if (choice) push(choice[1].split(/[,;]|\s+(?:or|and|или|либо|и)\s+/iu));
  if (found.length) return found;
  const either = text.match(/(?:\bwhether\s+to\s+|\b(?:choose|choosing|considering)\s+|(?:выбираю|выбрать|рассматриваю|думаю\s+о)\s+)([^.!?\n]+)/iu);
  if (either && /[,;]|\s(?:or|или|либо)\s/iu.test(either[1])) push(either[1].split(/[,;]|\s+(?:or|или|либо)\s+/iu));
  if (found.length) return found;
  const destinations = text.match(/(?:\b(?:move|relocate)(?:\s+to)?\s+|переехать\s+в\s+|переезд\s+в\s+)([^.!?\n]+)/iu);
  if (destinations && /\s(?:or|или|либо)\s/iu.test(destinations[1])) {
    const labels = destinations[1].split(/[,;]|\s+(?:or|или|либо)\s+/iu);
    // Only recognize a short list of destinations here, not reasons or a whole sentence.
    if (labels.every(label => label.trim().split(/\s+/).length <= 3)) push(labels);
  }
  return found.slice(0, 6);
}
