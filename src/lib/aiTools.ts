// EvometaClaw: local document intelligence. No network, no keys — everything
// runs on extracted text, so results are instant and private.

const STOPWORDS = new Set(
  ('a,an,the,and,or,but,if,then,else,when,at,by,for,with,about,against,between,into,through,' +
    'during,before,after,above,below,to,from,up,down,in,out,on,off,over,under,again,further,' +
    'once,here,there,all,any,both,each,few,more,most,other,some,such,no,nor,not,only,own,same,' +
    'so,than,too,very,can,will,just,should,now,is,are,was,were,be,been,being,have,has,had,' +
    'having,do,does,did,doing,would,could,shall,may,might,must,of,it,its,this,that,these,those,' +
    'i,you,he,she,we,they,them,his,her,their,our,your,my,as,us'
  ).split(','),
)

function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-Z0-9“"'])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 30 && s.length < 500)
}

function termFreq(text: string): Map<string, number> {
  const freq = new Map<string, number>()
  for (const raw of text.toLowerCase().match(/[a-z][a-z'-]{2,}/g) ?? []) {
    if (STOPWORDS.has(raw)) continue
    freq.set(raw, (freq.get(raw) ?? 0) + 1)
  }
  return freq
}

// Frequency-scored extractive summary: pick highest-value sentences in order.
export function summarize(text: string, maxSentences = 6): string[] {
  const sents = sentences(text)
  if (sents.length <= maxSentences) return sents
  const freq = termFreq(text)
  const maxFreq = Math.max(...freq.values(), 1)
  const scored = sents.map((s, i) => {
    let score = 0
    for (const w of s.toLowerCase().match(/[a-z][a-z'-]{2,}/g) ?? []) {
      score += (freq.get(w) ?? 0) / maxFreq
    }
    const words = s.split(' ').length
    score = score / Math.sqrt(words) // normalize: long sentences win otherwise
    score *= 1 + 0.15 * Math.exp(-i / 10) // lead bias: early sentences carry topic
    return { s, i, score }
  })
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSentences)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.s)
}

export function keywords(text: string, count = 12): string[] {
  return [...termFreq(text).entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([w]) => w)
}

// Credit card: require a known brand prefix (Visa / MC / Discover / Amex) with
// canonical grouping so 16-digit invoice numbers and ISBNs don't false-positive.
// IP: validate each octet 0-255 so version strings like "5.6.205" don't match.
export const PII_PATTERNS: { kind: string; pattern: RegExp }[] = [
  { kind: 'Email', pattern: /[\w.+-]+@[\w-]+\.[\w.]+/g },
  { kind: 'Phone', pattern: /(?:\+1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/g },
  { kind: 'SSN', pattern: /\b\d{3}-\d{2}-\d{4}\b/g },
  {
    kind: 'Credit card',
    pattern:
      /\b(?:4\d{3}|5[1-5]\d{2}|6011|65\d{2})[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b|\b3[47]\d{2}[\s-]?\d{6}[\s-]?\d{5}\b/g,
  },
  { kind: 'IBAN', pattern: /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g },
  {
    kind: 'IP address',
    pattern:
      /\b(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}\b/g,
  },
]

export function countWords(text: string): number {
  return (text.match(/\S+/g) ?? []).length
}
