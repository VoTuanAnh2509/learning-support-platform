const normalizeText = value => String(value || '').trim().toLowerCase();

const buildSlug = value =>
    String(value || '')
        .trim()
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

const isBcryptHash = value => typeof value === 'string' && /^\$2[aby]\$/.test(value);

const formatProviderLabel = provider => {
    const key = String(provider || 'local').toLowerCase();
    return (
        {
            local: 'Email',
            google: 'Google',
            facebook: 'Facebook',
            github: 'GitHub',
        }[key] || 'Email'
    );
};

const COMMON_EMAIL_DOMAIN_TYPOS = {
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
};

const levenshteinDistance = (a, b) => {
    const m = a.length;
    const n = b.length;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + cost
            );
        }
    }
    return dp[m][n];
};

const validateEmailSpelling = rawEmail => {
    const trimmed = normalizeText(rawEmail);
    if (!trimmed) {
        return { valid: false, error: 'Email address is required.' };
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(trimmed)) {
        return {
            valid: false,
            error: 'Please enter a valid email address (e.g. yourname@gmail.com).',
        };
    }

    const [localPart, domain] = trimmed.split('@');
    if (COMMON_EMAIL_DOMAIN_TYPOS[domain]) {
        const suggested = `${localPart}@${COMMON_EMAIL_DOMAIN_TYPOS[domain]}`;
        return {
            valid: false,
            error: `Invalid email domain "@${domain}". Did you mean "${suggested}"?`,
        };
    }

    const knownTargets = [
        'gmail.com',
        'yahoo.com',
        'outlook.com',
        'hotmail.com',
        'icloud.com',
        'fpt.edu.vn',
    ];
    if (!knownTargets.includes(domain)) {
        const gmailDist = levenshteinDistance(domain, 'gmail.com');
        if (
            gmailDist > 0 &&
            (gmailDist <= 2 ||
                (domain.startsWith('gm') && domain !== 'gmx.com' && domain !== 'gmx.net'))
        ) {
            return {
                valid: false,
                error: `Misspelled Gmail domain "@${domain}". Did you mean "${localPart}@gmail.com"?`,
            };
        }
        for (const target of knownTargets) {
            if (target === 'gmail.com') continue;
            if (levenshteinDistance(domain, target) === 1) {
                return {
                    valid: false,
                    error: `Misspelled email domain "@${domain}". Did you mean "${localPart}@${target}"?`,
                };
            }
        }
    }

    return { valid: true, error: '' };
};

const getCourseSignal = course => {
    const moduleCount = Array.isArray(course.modules) ? course.modules.length : 0;
    const lessonCount = Array.isArray(course.modules)
        ? course.modules.reduce((total, module) => total + (module.lessons?.length || 0), 0)
        : 0;

    return {
        moduleCount,
        lessonCount,
        difficulty: course.difficulty,
        subject: course.subject,
        tags: course.tags || [],
    };
};

module.exports = {
    normalizeText,
    buildSlug,
    isBcryptHash,
    formatProviderLabel,
    COMMON_EMAIL_DOMAIN_TYPOS,
    levenshteinDistance,
    validateEmailSpelling,
    getCourseSignal,
};
