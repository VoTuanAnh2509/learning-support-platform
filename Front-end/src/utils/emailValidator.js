const COMMON_DOMAIN_TYPOS = {
  'gmal.com': 'gmail.com',
  'gmial.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gnail.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gmaiil.com': 'gmail.com',
  'gmali.com': 'gmail.com',
  'gmaul.com': 'gmail.com',
  'gmaol.com': 'gmail.com',
  'gmaik.com': 'gmail.com',
  'hmail.com': 'gmail.com',
  'ymail.con': 'ymail.com',
  'gmail.con': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.cm': 'gmail.com',
  'gmail.cmo': 'gmail.com',
  'gmail.ocm': 'gmail.com',
  'gmail.comm': 'gmail.com',
  'gmail.vom': 'gmail.com',
  'gmail.xom': 'gmail.com',
  'gmail.cim': 'gmail.com',
  'gmail.vn': 'gmail.com',
  'gmal.vn': 'gmail.com',
  'yaho.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'yahoo.con': 'yahoo.com',
  'outlok.com': 'outlook.com',
  'outlook.con': 'outlook.com',
  'hotmal.com': 'hotmail.com',
  'hotmail.con': 'hotmail.com',
  'iclod.com': 'icloud.com',
  'icloud.con': 'icloud.com',
  'fpt.edu.v': 'fpt.edu.vn',
  'fpt.edu.vm': 'fpt.edu.vn',
}

const TARGET_DOMAINS = [
  'gmail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'icloud.com',
  'fpt.edu.vn',
]

const levenshteinDistance = (a, b) => {
  const m = a.length
  const n = b.length
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))

  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      )
    }
  }
  return dp[m][n]
}

export function validateEmailSpelling(rawEmail) {
  const trimmed = String(rawEmail || '').trim().toLowerCase()
  if (!trimmed) {
    return { valid: false, error: 'Email address is required.', suggestedEmail: '' }
  }

  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
  if (!emailRegex.test(trimmed)) {
    return {
      valid: false,
      error: 'Please enter a valid email address (e.g. yourname@gmail.com).',
      suggestedEmail: '',
    }
  }

  const [localPart, domain] = trimmed.split('@')
  if (!localPart || !domain) {
    return {
      valid: false,
      error: 'Please enter a valid email address.',
      suggestedEmail: '',
    }
  }

  // 1. Direct dictionary match for common typos (e.g. gmal.com -> gmail.com)
  if (COMMON_DOMAIN_TYPOS[domain]) {
    const correctedDomain = COMMON_DOMAIN_TYPOS[domain]
    const suggestedEmail = `${localPart}@${correctedDomain}`
    return {
      valid: false,
      suggestedEmail,
      error: `Invalid email domain "@${domain}". Did you mean "${suggestedEmail}"?`,
    }
  }

  // 2. Fuzzy Levenshtein check against gmail.com and major providers
  if (!TARGET_DOMAINS.includes(domain)) {
    // Any domain starting with gm/gn or close to gmail.com (distance <= 2)
    const gmailDist = levenshteinDistance(domain, 'gmail.com')
    if (
      gmailDist > 0 &&
      (gmailDist <= 2 ||
        (domain.startsWith('gm') && domain !== 'gmx.com' && domain !== 'gmx.net'))
    ) {
      const suggestedEmail = `${localPart}@gmail.com`
      return {
        valid: false,
        suggestedEmail,
        error: `Misspelled Gmail domain "@${domain}". Did you mean "${suggestedEmail}"?`,
      }
    }

    for (const target of TARGET_DOMAINS) {
      if (target === 'gmail.com') continue
      const dist = levenshteinDistance(domain, target)
      if (dist === 1) {
        const suggestedEmail = `${localPart}@${target}`
        return {
          valid: false,
          suggestedEmail,
          error: `Misspelled email domain "@${domain}". Did you mean "${suggestedEmail}"?`,
        }
      }
    }
  }

  return { valid: true, error: '', suggestedEmail: '' }
}
