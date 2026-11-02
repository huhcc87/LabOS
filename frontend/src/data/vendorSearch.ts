/**
 * Vendors whose own site search can be opened with a product name or CAS number.
 * These are plain links to the vendor's public search page: nothing is fetched, so there are no live
 * prices or stock here. Vendors change their URLs now and then; fix a template here if one stops working.
 */
export interface VendorSearch {
  name: string;
  kind: 'Chemicals' | 'Reagents & kits' | 'Antibodies' | 'Consumables' | 'General' | 'Reference';
  /** `{q}` is replaced with the URL-encoded search term. */
  url: string;
}

export const VENDOR_SEARCHES: VendorSearch[] = [
  { name: 'Sigma-Aldrich (Merck)', kind: 'Chemicals', url: 'https://www.sigmaaldrich.com/US/en/search/{q}?focus=products&page=1&perpage=30&sort=relevance&term={q}&type=product' },
  { name: 'Thermo Fisher Scientific', kind: 'Reagents & kits', url: 'https://www.thermofisher.com/search/results?query={q}' },
  { name: 'Fisher Scientific', kind: 'Chemicals', url: 'https://www.fishersci.com/us/en/catalog/search/products?keyword={q}' },
  { name: 'VWR (Avantor)', kind: 'Chemicals', url: 'https://www.avantorsciences.com/us/en/search/{q}' },
  { name: 'TCI Chemicals', kind: 'Chemicals', url: 'https://www.tcichemicals.com/US/en/search/?text={q}' },
  { name: 'Cayman Chemical', kind: 'Chemicals', url: 'https://www.caymanchem.com/search?q={q}' },
  { name: 'MedChemExpress', kind: 'Chemicals', url: 'https://www.medchemexpress.com/search.html?q={q}' },
  { name: 'Selleck Chemicals', kind: 'Chemicals', url: 'https://www.selleckchem.com/search.html?searchDTO.searchParam={q}' },
  { name: 'Bio-Rad', kind: 'Reagents & kits', url: 'https://www.bio-rad.com/en-us/search?text={q}' },
  { name: 'Abcam', kind: 'Antibodies', url: 'https://www.abcam.com/en-us/search?keywords={q}' },
  { name: 'Santa Cruz Biotechnology', kind: 'Antibodies', url: 'https://www.scbt.com/search?query={q}' },
  { name: 'Amazon', kind: 'General', url: 'https://www.amazon.com/s?k={q}' },
  { name: 'PubChem (properties, safety)', kind: 'Reference', url: 'https://pubchem.ncbi.nlm.nih.gov/#query={q}' },
];

export const vendorSearchUrl = (v: VendorSearch, term: string): string => v.url.replace(/\{q\}/g, encodeURIComponent(term.trim()));

/**
 * A CAS Registry Number is 2-7 digits, 2 digits, then a check digit. The check digit is the sum of
 * the other digits, each times its position counted from the right, modulo 10.
 */
export function isCasNumber(s: string): boolean {
  const m = /^(\d{2,7})-(\d{2})-(\d)$/.exec(s.trim());
  if (!m) return false;
  const digits = (m[1] + m[2]).split('').reverse();
  const sum = digits.reduce((t, d, i) => t + Number(d) * (i + 1), 0);
  return sum % 10 === Number(m[3]);
}
