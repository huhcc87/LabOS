/** What was typed into the literature search: PubMed IDs (numbers), DOIs, or otherwise a topic or a pasted link. */
export function detectSearchKind(text: string): 'topic' | 'pmid' | 'doi' {
  // A label on its own ("PMID: 123") is not an ID, so leave it out before judging the rest.
  const parts = text.trim().split(/[\s,;]+/).filter((p) => p && !/^(pmid|doi):?$/i.test(p));
  if (!parts.length) return 'topic';
  if (parts.every((p) => /^(pmid:?)?\d{5,9}$/i.test(p))) return 'pmid';
  if (parts.every((p) => /^(doi:?)?10\.\d{4,9}\/\S+$/i.test(p))) return 'doi';
  return 'topic';
}
