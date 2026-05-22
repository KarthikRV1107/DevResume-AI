import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Language Detection ───────────────────────────────────────────────
interface LangSignature {
  keywords: RegExp[];
  patterns: RegExp[];
  name: string;
}

const LANG_SIGNATURES: LangSignature[] = [
  { name: "Python", keywords: [/\bdef\b/, /\bclass\b/, /\bimport\b/, /\bself\b/, /\bprint\s*\(/, /\basync\s+def\b/], patterns: [/:\s*$/, /^\s*#/, /\bNone\b/, /\bTrue\b/, /\bFalse\b/, /\bif\s+__name__\s*==/, /\bwith\b.*\bas\b/] },
  { name: "TypeScript", keywords: [/\binterface\b/, /\btype\b.*=/, /:\s*(string|number|boolean)\b/, /\benum\b/, /\bas\s+\w+/], patterns: [/\bconst\b/, /\blet\b/, /=>\s*{/, /import.*from/, /\.tsx?$/, /\bReact\b/, /\bPromise</] },
  { name: "JavaScript", keywords: [/\bfunction\b/, /\bconst\b/, /\blet\b/, /\bvar\b/, /\basync\b/], patterns: [/=>\s*{/, /console\.log/, /require\(/, /module\.exports/, /\.then\(/, /\.catch\(/] },
  { name: "Java", keywords: [/\bpublic\b/, /\bprivate\b/, /\bclass\b/, /\bstatic\b/, /\bfinal\b/, /\babstract\b/], patterns: [/System\.out/, /\bvoid\b/, /\bString\b/, /\bnew\b.*\(/, /\@Override/, /\bextends\b/, /\bimplements\b/] },
  { name: "C++", keywords: [/\b#include\b/, /\bstd::/, /\bcout\b/, /\bnamespace\b/, /\bvirtual\b/], patterns: [/\bint\s+main/, /\bvector</, /\btemplate\b/, /\bconst\s+\w+\s*&/, /\bstd::unique_ptr/] },
  { name: "Go", keywords: [/\bfunc\b/, /\bpackage\b/, /\bfmt\./, /\bgo\b/, /\bdefer\b/], patterns: [/:=/, /\bchan\b/, /\bgoroutine\b/, /\berror\b/, /\binterface\s*{/] },
  { name: "Rust", keywords: [/\bfn\b/, /\blet\s+mut\b/, /\bimpl\b/, /\bstruct\b/, /\btrait\b/], patterns: [/->/, /\bmatch\b/, /\bOption</, /\bResult</, /\bpub\s+fn\b/] },
  { name: "C#", keywords: [/\busing\b/, /\bnamespace\b/, /\bclass\b/, /\bpublic\b/, /\basync\s+Task/], patterns: [/\bvar\b/, /\bawait\b/, /\bLINQ\b/, /\bIEnumerable/, /Console\.Write/] },
  { name: "PHP", keywords: [/\<\?php/, /\bfunction\b/, /\$\w+/, /\becho\b/], patterns: [/->/, /\barray\(/, /\bnew\b/, /\bclass\b/] },
  { name: "Ruby", keywords: [/\bdef\b/, /\bend\b/, /\bclass\b/, /\brequire\b/], patterns: [/\bdo\b.*\|/, /\battr_/, /\bputs\b/, /\byield\b/] },
  { name: "Swift", keywords: [/\bfunc\b/, /\bvar\b/, /\blet\b/, /\bguard\b/, /\bstruct\b/], patterns: [/\boptional\b/i, /\bif let\b/, /\bswitch\b/, /\bprotocol\b/] },
  { name: "Kotlin", keywords: [/\bfun\b/, /\bval\b/, /\bvar\b/, /\bdata\s+class\b/], patterns: [/\bwhen\b/, /\bcompanion\s+object\b/, /\bsuspend\b/, /\bcoroutine/i] },
];

function detectLanguage(code: string): string {
  let best = "Unknown";
  let bestScore = 0;
  for (const sig of LANG_SIGNATURES) {
    let score = 0;
    for (const kw of sig.keywords) if (kw.test(code)) score += 2;
    for (const p of sig.patterns) if (p.test(code)) score += 1;
    if (score > bestScore) { bestScore = score; best = sig.name; }
  }
  return best;
}

// ─── Static Analysis ──────────────────────────────────────────────────
interface StaticIssue {
  type: "todo" | "stub" | "security" | "syntax" | "missing_return" | "empty_function" | "complexity" | "naming" | "error_handling" | "performance" | "dead_code" | "documentation";
  message: string;
  severity: "info" | "warning" | "error";
  line?: number;
  file?: string;
}

function staticAnalyze(code: string, language: string): StaticIssue[] {
  const issues: StaticIssue[] = [];
  const lines = code.split("\n");

  const todoRegex = /(?:#|\/\/|\/\*)\s*(TODO|FIXME|HACK|XXX|BUG):?\s*(.*)/gi;
  let match;
  while ((match = todoRegex.exec(code)) !== null) {
    const tag = match[1].toUpperCase();
    const task = match[2]?.trim() || `Unspecified ${tag}`;
    const lineNum = code.slice(0, match.index).split("\n").length;
    issues.push({ type: "todo", message: `[${tag}] ${task}`, severity: tag === "FIXME" || tag === "BUG" ? "error" : "warning", line: lineNum });
  }

  const passCount = (code.match(/\bpass\b/g) || []).length;
  const emptyBodies = (code.match(/{\s*}/g) || []).length;
  const notImplemented = (code.match(/raise\s+NotImplementedError|throw\s+new\s+Error\(['"]not implemented/gi) || []).length;
  if (passCount > 0) issues.push({ type: "stub", message: `${passCount} pass statement(s) — unimplemented logic`, severity: "warning" });
  if (emptyBodies > 0) issues.push({ type: "empty_function", message: `${emptyBodies} empty block(s) — possible stub`, severity: "warning" });
  if (notImplemented > 0) issues.push({ type: "stub", message: `${notImplemented} NotImplementedError / throw — placeholder logic`, severity: "warning" });

  // Security
  if (/(?:secret|api_key|password|token|private_key|access_key)/i.test(code) && /["']\w{8,}["']/.test(code)) {
    issues.push({ type: "security", message: "Possible hardcoded secret or credential", severity: "error" });
  }
  if (/eval\s*\(/.test(code)) issues.push({ type: "security", message: "Use of eval() — potential code injection risk", severity: "error" });
  if (/innerHTML\s*=/.test(code)) issues.push({ type: "security", message: "Direct innerHTML assignment — XSS risk", severity: "error" });
  if (/\bexec\s*\(/.test(code) && language === "Python") issues.push({ type: "security", message: "Use of exec() — arbitrary code execution risk", severity: "error" });
  if (/dangerouslySetInnerHTML/.test(code)) issues.push({ type: "security", message: "dangerouslySetInnerHTML used — ensure content is sanitized", severity: "warning" });
  if (/\bhttp:\/\//.test(code) && !/localhost|127\.0\.0\.1/.test(code)) issues.push({ type: "security", message: "Non-HTTPS URL detected — data may be transmitted insecurely", severity: "warning" });

  // Bracket balance
  const opens = (code.match(/[({[]/g) || []).length;
  const closes = (code.match(/[)}\]]/g) || []).length;
  if (Math.abs(opens - closes) > 1) issues.push({ type: "syntax", message: `Bracket imbalance (${opens} open vs ${closes} close)`, severity: "error" });

  // Missing return
  if (["JavaScript", "TypeScript", "Java"].includes(language)) {
    const funcBlocks = code.match(/function\s+\w+[^{]*{[^}]*}/gs) || [];
    for (const block of funcBlocks) {
      if (!/\breturn\b/.test(block) && !/\bvoid\b/.test(block)) {
        const name = block.match(/function\s+(\w+)/)?.[1] || "anonymous";
        issues.push({ type: "missing_return", message: `Function '${name}' may be missing a return statement`, severity: "info" });
      }
    }
  }

  // Complexity
  let maxNesting = 0, currentNesting = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    currentNesting += (trimmed.match(/{/g) || []).length - (trimmed.match(/}/g) || []).length;
    if (currentNesting > maxNesting) maxNesting = currentNesting;
  }
  if (maxNesting > 5) issues.push({ type: "complexity", message: `Deep nesting detected (${maxNesting} levels) — consider refactoring`, severity: "warning" });

  // Long functions
  const funcStarts = [...code.matchAll(/\b(?:function|def|func|fn|fun)\s+\w+/g)];
  if (funcStarts.length > 0) {
    const avgFuncLen = Math.round(lines.length / funcStarts.length);
    if (avgFuncLen > 50) issues.push({ type: "complexity", message: `Functions average ${avgFuncLen} lines — consider breaking into smaller units`, severity: "warning" });
  }

  // Error handling
  const hasPromise = /\.then\(|async\s|await\s/.test(code);
  const hasCatch = /\.catch\(|\bcatch\b|\bexcept\b/.test(code);
  if (hasPromise && !hasCatch) issues.push({ type: "error_handling", message: "Async code without error handling (.catch / try-catch)", severity: "warning" });
  if (!/\btry\b/.test(code) && lines.length > 30 && (language === "JavaScript" || language === "TypeScript")) {
    issues.push({ type: "error_handling", message: "No try-catch blocks — consider adding error boundaries", severity: "info" });
  }

  // Naming
  const singleCharVars = code.match(/\b(?:let|const|var|int|float|double)\s+([a-z])\b/g) || [];
  if (singleCharVars.length > 3) issues.push({ type: "naming", message: `${singleCharVars.length} single-character variable names — hurts readability`, severity: "info" });

  // Debug statements
  const consoleCount = (code.match(/console\.(log|debug|warn|info)\s*\(/g) || []).length;
  const printCount = language === "Python" ? (code.match(/\bprint\s*\(/g) || []).length : 0;
  if (consoleCount + printCount > 5) issues.push({ type: "dead_code", message: `${consoleCount + printCount} debug/print statements — remove before production`, severity: "info" });

  // Commented-out code
  const commentedCode = lines.filter(l => { const t = l.trim(); return (t.startsWith("//") || t.startsWith("#")) && /[=;{()}]/.test(t) && !/TODO|FIXME|HACK|NOTE|XXX/i.test(t); }).length;
  if (commentedCode > 5) issues.push({ type: "dead_code", message: `~${commentedCode} lines of commented-out code — consider removing`, severity: "info" });

  // Documentation
  const docstrings = (code.match(/"""|'''|\/\*\*/g) || []).length;
  const jsdoc = (code.match(/\/\*\*[\s\S]*?\*\//g) || []).length;
  if (funcStarts.length > 3 && docstrings + jsdoc === 0) issues.push({ type: "documentation", message: `${funcStarts.length} functions with no documentation — add docstrings/JSDoc`, severity: "info" });

  // Performance
  if (/\bfor\b.*\bfor\b/s.test(code)) issues.push({ type: "performance", message: "Nested loops detected — may cause O(n²) performance", severity: "warning" });
  if (/\.forEach\(.*\.forEach\(/s.test(code)) issues.push({ type: "performance", message: "Nested forEach calls — consider restructuring for efficiency", severity: "warning" });
  const domQueries = (code.match(/document\.(querySelector|getElementById|getElementsBy)/g) || []).length;
  if (domQueries > 5) issues.push({ type: "performance", message: `${domQueries} direct DOM queries — consider caching`, severity: "info" });
  if (/new RegExp\(.*\+/.test(code)) issues.push({ type: "security", message: "Dynamic RegExp with user input — ReDoS risk", severity: "warning" });
  if (/JSON\.parse\s*\(\s*(?!['"`])/.test(code) && !/try/.test(code)) issues.push({ type: "error_handling", message: "JSON.parse without try-catch — will throw on invalid input", severity: "warning" });
  const anyCount = (code.match(/:\s*any\b/g) || []).length;
  if (anyCount > 5) issues.push({ type: "naming", message: `${anyCount} uses of 'any' type — reduces type safety`, severity: "warning" });
  if (/useEffect\(\s*(?:async|.*=>\s*{[^}]*(?:await|fetch|axios))/.test(code)) issues.push({ type: "performance", message: "Async operation directly in useEffect — use cleanup pattern", severity: "info" });
  if (/(?:window|document)\.(?:addEventListener)/.test(code) && !/removeEventListener/.test(code)) issues.push({ type: "performance", message: "Event listener without cleanup — potential memory leak", severity: "warning" });

  // Duplicate code
  const normalizedLines = lines.map(l => l.trim()).filter(l => l.length > 20 && !l.startsWith("//") && !l.startsWith("#") && !l.startsWith("import") && !l.startsWith("from"));
  const lineCounts: Record<string, number> = {};
  for (const l of normalizedLines) lineCounts[l] = (lineCounts[l] || 0) + 1;
  const duplicateLines = Object.entries(lineCounts).filter(([, c]) => c >= 3).length;
  if (duplicateLines > 0) issues.push({ type: "complexity", message: `${duplicateLines} code pattern(s) repeated 3+ times — possible duplication`, severity: "warning" });

  // File-level analysis for multi-file projects
  const fileBlocks = code.split(/\/\/ ═══ .+ ═══/);
  if (fileBlocks.length > 2) {
    const fileHeaders = code.match(/\/\/ ═══ (.+?) ═══/g) || [];
    if (fileHeaders.length > 20 && !code.includes("index.") && !code.includes("main.")) {
      issues.push({ type: "complexity", message: "Large project with no clear entry point (index/main file)", severity: "info" });
    }
    const configFiles = fileHeaders.filter(h => /config|\.env|settings/i.test(h)).length;
    if (configFiles === 0 && fileHeaders.length > 5) {
      issues.push({ type: "complexity", message: "No configuration files detected — consider externalizing config", severity: "info" });
    }
    const testFiles = fileHeaders.filter(h => /\.test\.|\.spec\.|__test__|_test\./i.test(h)).length;
    const srcFiles = fileHeaders.length - testFiles;
    if (testFiles === 0 && srcFiles > 5) {
      issues.push({ type: "documentation", message: `${srcFiles} source files with 0 test files — add unit tests`, severity: "warning" });
    } else if (testFiles > 0 && srcFiles > 0) {
      const ratio = Math.round((testFiles / srcFiles) * 100);
      if (ratio < 30) issues.push({ type: "documentation", message: `Test coverage ratio: ${ratio}% (${testFiles}/${srcFiles} files) — aim for higher coverage`, severity: "info" });
    }
  }

  return issues;
}

// ─── Enterprise Security Scanner ──────────────────────────────────────
interface SecurityFinding {
  id: string;
  category: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  description: string;
  file?: string;
  line?: number;
  owasp?: string;
  cwe?: string;
  remediation: string;
}

function enterpriseSecurityScan(code: string, language: string): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const lines = code.split("\n");
  let findingId = 0;

  const addFinding = (f: Omit<SecurityFinding, "id">) => {
    findings.push({ ...f, id: `SEC-${++findingId}` });
  };

  // ── OWASP A01: Broken Access Control ──
  if (/(?:isAdmin|is_admin|role)\s*[=!]==?\s*['"]/.test(code)) {
    addFinding({ category: "Access Control", severity: "high", title: "Client-side role check detected", description: "Authorization decisions should be server-side, not client-side string comparisons.", owasp: "A01:2021", cwe: "CWE-285", remediation: "Move authorization checks to server-side middleware or RLS policies." });
  }
  if (/localStorage\.getItem\(['"](?:token|auth|role|user|session)/i.test(code)) {
    addFinding({ category: "Access Control", severity: "medium", title: "Sensitive data in localStorage", description: "Storing auth tokens/roles in localStorage is vulnerable to XSS attacks.", owasp: "A01:2021", cwe: "CWE-922", remediation: "Use httpOnly cookies or secure session management." });
  }

  // ── OWASP A02: Cryptographic Failures ──
  if (/\bmd5\b|\bsha1\b/i.test(code) && !/sha256|sha384|sha512|bcrypt|argon/i.test(code)) {
    addFinding({ category: "Cryptography", severity: "high", title: "Weak hashing algorithm (MD5/SHA1)", description: "MD5 and SHA1 are cryptographically broken.", owasp: "A02:2021", cwe: "CWE-328", remediation: "Use SHA-256, bcrypt, or argon2 for hashing." });
  }
  if (/\bDES\b|\b3DES\b|\bRC4\b/i.test(code)) {
    addFinding({ category: "Cryptography", severity: "high", title: "Weak encryption algorithm", description: "DES/3DES/RC4 are considered insecure.", owasp: "A02:2021", cwe: "CWE-327", remediation: "Use AES-256-GCM or ChaCha20-Poly1305." });
  }
  if (/(?:BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY|PRIVATE\s+KEY)/i.test(code)) {
    addFinding({ category: "Cryptography", severity: "critical", title: "Private key embedded in source code", description: "Private keys must never be committed to source code.", owasp: "A02:2021", cwe: "CWE-321", remediation: "Remove the key, rotate it, and use environment variables or a secrets manager." });
  }

  // ── OWASP A03: Injection ──
  if (/\$\{.*\}.*(?:SELECT|INSERT|UPDATE|DELETE|DROP|ALTER)/i.test(code) || /['"]\s*\+\s*\w+.*(?:SELECT|INSERT|UPDATE|DELETE)/i.test(code)) {
    addFinding({ category: "Injection", severity: "critical", title: "Possible SQL injection", description: "String interpolation in SQL queries allows attackers to execute arbitrary SQL.", owasp: "A03:2021", cwe: "CWE-89", remediation: "Use parameterized queries or an ORM." });
  }
  if (/child_process|spawn|exec(?:Sync)?\s*\(/.test(code) && /\$\{|\+\s*\w+/.test(code)) {
    addFinding({ category: "Injection", severity: "critical", title: "Possible command injection", description: "User input in shell commands enables remote code execution.", owasp: "A03:2021", cwe: "CWE-78", remediation: "Avoid shell commands with user input. Use validated arguments and allowlists." });
  }
  if (/\.query\s*\(\s*['"`].*\$\{/.test(code)) {
    addFinding({ category: "Injection", severity: "high", title: "Template literal in database query", description: "Interpolating values directly into database queries risks injection.", owasp: "A03:2021", cwe: "CWE-89", remediation: "Use parameterized queries with placeholder values." });
  }

  // ── OWASP A04: Insecure Design ──
  if (/(?:rate.?limit|throttl)/i.test(code) === false && /(?:login|signin|sign_in|authenticate)/i.test(code)) {
    addFinding({ category: "Insecure Design", severity: "medium", title: "No rate limiting on authentication", description: "Authentication endpoints without rate limiting enable brute-force attacks.", owasp: "A04:2021", cwe: "CWE-307", remediation: "Implement rate limiting (e.g., express-rate-limit, fail2ban)." });
  }

  // ── OWASP A05: Security Misconfiguration ──
  if (/cors\(\s*\)/.test(code) || /Access-Control-Allow-Origin.*\*/.test(code)) {
    addFinding({ category: "Misconfiguration", severity: "medium", title: "Permissive CORS policy", description: "Wildcard CORS allows any origin to access your API.", owasp: "A05:2021", cwe: "CWE-942", remediation: "Restrict CORS to specific trusted origins." });
  }
  if (/debug\s*[:=]\s*(?:true|True|1)\b/.test(code) || /DEBUG\s*=\s*True/.test(code)) {
    addFinding({ category: "Misconfiguration", severity: "high", title: "Debug mode enabled", description: "Debug mode in production exposes stack traces and internal details.", owasp: "A05:2021", cwe: "CWE-489", remediation: "Disable debug mode in production environments." });
  }
  if (/(?:helmet|csp|Content-Security-Policy)/i.test(code) === false && /express|fastify|koa/i.test(code)) {
    addFinding({ category: "Misconfiguration", severity: "medium", title: "Missing security headers", description: "No CSP/Helmet detected for web server — vulnerable to XSS and clickjacking.", owasp: "A05:2021", cwe: "CWE-693", remediation: "Use Helmet.js or set CSP, X-Frame-Options, X-Content-Type-Options headers." });
  }

  // ── OWASP A06: Vulnerable Components ──
  // Detect package.json dependency patterns
  if (/\"dependencies\"/.test(code)) {
    const outdatedPatterns = [
      { pkg: "lodash", version: /\"lodash\":\s*\"[\^~]?[0-3]\./, title: "Outdated lodash (prototype pollution)" },
      { pkg: "express", version: /\"express\":\s*\"[\^~]?[0-3]\./, title: "Outdated Express.js" },
      { pkg: "axios", version: /\"axios\":\s*\"[\^~]?0\.[0-1]/, title: "Outdated axios" },
    ];
    for (const p of outdatedPatterns) {
      if (p.version.test(code)) {
        addFinding({ category: "Dependencies", severity: "high", title: p.title, description: `Potentially vulnerable version of ${p.pkg} detected.`, owasp: "A06:2021", cwe: "CWE-1104", remediation: `Update ${p.pkg} to the latest stable version.` });
      }
    }
  }

  // ── OWASP A07: Auth Failures ──
  if (/password.*(?:=|:)\s*['"][^'"]{1,7}['"]/i.test(code)) {
    addFinding({ category: "Authentication", severity: "medium", title: "Weak password detected", description: "Short hardcoded passwords indicate weak authentication practices.", owasp: "A07:2021", cwe: "CWE-521", remediation: "Enforce minimum password length (12+ chars) and complexity requirements." });
  }
  if (/jwt\.sign\(/.test(code) && !/expiresIn|exp/i.test(code)) {
    addFinding({ category: "Authentication", severity: "high", title: "JWT without expiration", description: "JWTs without expiration never expire, increasing token theft risk.", owasp: "A07:2021", cwe: "CWE-613", remediation: "Always set expiresIn for JWT tokens (e.g., 15 minutes for access tokens)." });
  }

  // ── OWASP A08: Data Integrity ──
  if (/npm install|pip install|curl.*\|\s*(?:bash|sh)/.test(code)) {
    addFinding({ category: "Data Integrity", severity: "medium", title: "Unverified package installation", description: "Installing packages without integrity checks risks supply chain attacks.", owasp: "A08:2021", cwe: "CWE-494", remediation: "Use lockfiles, verify checksums, and pin dependency versions." });
  }

  // ── OWASP A09: Logging Failures ──
  if (/console\.log\(.*(?:password|token|secret|key|credit)/i.test(code)) {
    addFinding({ category: "Logging", severity: "high", title: "Sensitive data in logs", description: "Logging passwords, tokens, or secrets exposes them in log files.", owasp: "A09:2021", cwe: "CWE-532", remediation: "Never log sensitive data. Use redaction or structured logging." });
  }

  // ── OWASP A10: SSRF ──
  if (/fetch\s*\(\s*(?:\w+|`\$\{)/.test(code) || /axios\.\w+\(\s*\w+/.test(code) || /request\(\s*\w+/.test(code)) {
    const hasValidation = /url\.startsWith|whitelist|allowlist|allowedHosts|validUrl/i.test(code);
    if (!hasValidation) {
      addFinding({ category: "SSRF", severity: "medium", title: "Possible SSRF vulnerability", description: "User-controlled URLs in fetch/axios without validation enable SSRF attacks.", owasp: "A10:2021", cwe: "CWE-918", remediation: "Validate and whitelist allowed URLs. Block internal network ranges." });
    }
  }

  // ── Additional: Secrets Detection ──
  const secretPatterns = [
    { regex: /(?:AKIA|ASIA)[A-Z0-9]{16}/, title: "AWS Access Key ID exposed", severity: "critical" as const },
    { regex: /ghp_[a-zA-Z0-9]{36}/, title: "GitHub Personal Access Token exposed", severity: "critical" as const },
    { regex: /sk-[a-zA-Z0-9]{32,}/, title: "OpenAI/Stripe secret key exposed", severity: "critical" as const },
    { regex: /xox[bpors]-[a-zA-Z0-9-]+/, title: "Slack token exposed", severity: "critical" as const },
    { regex: /-----BEGIN\s+(?:RSA|EC|DSA)?\s*PRIVATE\s+KEY-----/, title: "Private key in source code", severity: "critical" as const },
    { regex: /(?:mongodb|postgres|mysql):\/\/[^\s'"]+:[^\s'"]+@/, title: "Database connection string with credentials", severity: "critical" as const },
    { regex: /AIza[0-9A-Za-z_-]{35}/, title: "Google API key exposed", severity: "critical" as const },
    { regex: /ya29\.[0-9A-Za-z_-]+/, title: "Google OAuth token exposed", severity: "critical" as const },
    { regex: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, title: "JWT token hardcoded in source", severity: "high" as const },
    { regex: /SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}/, title: "SendGrid API key exposed", severity: "critical" as const },
    { regex: /sq0[a-z]{3}-[a-zA-Z0-9_-]{22,}/, title: "Square API key exposed", severity: "critical" as const },
    { regex: /sk_live_[a-zA-Z0-9]{24,}/, title: "Stripe live secret key exposed", severity: "critical" as const },
    { regex: /rk_live_[a-zA-Z0-9]{24,}/, title: "Stripe restricted key exposed", severity: "critical" as const },
    { regex: /AAAA[A-Za-z0-9_-]{7}:[A-Za-z0-9_-]{140}/, title: "Firebase Cloud Messaging key exposed", severity: "critical" as const },
  ];
  for (const sp of secretPatterns) {
    for (let i = 0; i < lines.length; i++) {
      if (sp.regex.test(lines[i])) {
        addFinding({ category: "Secrets", severity: sp.severity, title: sp.title, description: `Found at line ${i + 1}. Rotate this credential immediately.`, line: i + 1, owasp: "A02:2021", cwe: "CWE-798", remediation: "Remove the secret, rotate it, and use environment variables or a vault." });
        break;
      }
    }
  }

  // ── Compliance Indicators ──
  if (/(?:email|phone|ssn|social.security|date.of.birth|dob|credit.card)/i.test(code) && !/encrypt|hash|mask|redact/i.test(code)) {
    addFinding({ category: "Compliance", severity: "medium", title: "PII handled without protection", description: "Personal identifiable information should be encrypted or masked.", cwe: "CWE-359", remediation: "Encrypt PII at rest and in transit. Implement data masking for logs and displays." });
  }

  return findings;
}

// ─── Dependency Audit (from package.json/requirements) ────────────────
interface DependencyFinding {
  package: string;
  version: string;
  severity: "critical" | "high" | "medium" | "low";
  issue: string;
  recommendation: string;
  license?: string;
}

function auditDependencies(code: string): DependencyFinding[] {
  const findings: DependencyFinding[] = [];
  
  // Extract package.json dependencies
  const pkgMatch = code.match(/"dependencies"\s*:\s*\{([^}]+)\}/);
  const devPkgMatch = code.match(/"devDependencies"\s*:\s*\{([^}]+)\}/);
  
  const knownVulnerablePatterns: { pkg: string; versionPattern: RegExp; severity: "critical" | "high" | "medium"; issue: string; rec: string }[] = [
    { pkg: "lodash", versionPattern: /[\^~]?[0-3]\./, severity: "critical", issue: "Prototype pollution vulnerabilities", rec: "Update to lodash@4.17.21+" },
    { pkg: "minimist", versionPattern: /[\^~]?0\./, severity: "high", issue: "Prototype pollution", rec: "Update to minimist@1.2.6+" },
    { pkg: "node-forge", versionPattern: /[\^~]?0\./, severity: "high", issue: "Multiple cryptographic vulnerabilities", rec: "Update to node-forge@1.3.0+" },
    { pkg: "jsonwebtoken", versionPattern: /[\^~]?[0-7]\./, severity: "high", issue: "JWT algorithm confusion vulnerability", rec: "Update to jsonwebtoken@9.0.0+" },
    { pkg: "moment", versionPattern: /[\^~]?\d/, severity: "low", issue: "Deprecated library with ReDoS risks", rec: "Migrate to date-fns, dayjs, or Luxon" },
    { pkg: "request", versionPattern: /[\^~]?\d/, severity: "medium", issue: "Deprecated and unmaintained", rec: "Migrate to axios, got, or node-fetch" },
  ];

  const allDeps = (pkgMatch?.[1] || "") + (devPkgMatch?.[1] || "");
  for (const vuln of knownVulnerablePatterns) {
    const depMatch = allDeps.match(new RegExp(`"${vuln.pkg}"\\s*:\\s*"(${vuln.versionPattern.source}[^"]*)"`, "i"));
    if (depMatch) {
      findings.push({ package: vuln.pkg, version: depMatch[1], severity: vuln.severity, issue: vuln.issue, recommendation: vuln.rec });
    }
  }

  // Check for no lockfile reference
  if (/\"dependencies\"/.test(code) && !/package-lock|yarn\.lock|pnpm-lock|bun\.lock/i.test(code)) {
    findings.push({ package: "project", version: "N/A", severity: "medium", issue: "No lockfile detected — builds may be non-deterministic", recommendation: "Use npm ci/yarn install --frozen-lockfile in CI" });
  }

  return findings;
}

// ─── Compliance Checks ───────────────────────────────────────────────
interface ComplianceCheck {
  framework: string;
  control: string;
  status: "pass" | "fail" | "warning" | "not_applicable";
  description: string;
  remediation?: string;
}

function runComplianceChecks(code: string, securityFindings: SecurityFinding[]): ComplianceCheck[] {
  const checks: ComplianceCheck[] = [];
  
  const hasAuth = /auth|login|signin|session|jwt|token/i.test(code);
  const hasEncryption = /encrypt|aes|rsa|crypto|bcrypt|argon/i.test(code);
  const hasLogging = /logger|winston|pino|bunyan|console\.(?:log|error|warn)/i.test(code);
  const hasInputValidation = /zod|joi|yup|validator|sanitize|validate/i.test(code);
  const hasPII = /(?:email|phone|ssn|credit.card|address)/i.test(code);
  const criticalFindings = securityFindings.filter(f => f.severity === "critical").length;
  const highFindings = securityFindings.filter(f => f.severity === "high").length;

  // SOC2 Controls
  checks.push({ framework: "SOC2", control: "CC6.1 - Access Control", status: hasAuth ? "pass" : "warning", description: hasAuth ? "Authentication mechanisms detected" : "No authentication mechanisms found", remediation: hasAuth ? undefined : "Implement authentication and authorization" });
  checks.push({ framework: "SOC2", control: "CC6.7 - Encryption", status: hasEncryption ? "pass" : (hasPII ? "fail" : "not_applicable"), description: hasEncryption ? "Encryption mechanisms detected" : "No encryption detected for data protection", remediation: hasEncryption ? undefined : "Implement encryption for sensitive data" });
  checks.push({ framework: "SOC2", control: "CC7.2 - Monitoring", status: hasLogging ? "pass" : "warning", description: hasLogging ? "Logging mechanisms detected" : "Insufficient logging and monitoring", remediation: hasLogging ? undefined : "Add structured logging with audit trails" });
  checks.push({ framework: "SOC2", control: "CC8.1 - Input Validation", status: hasInputValidation ? "pass" : "fail", description: hasInputValidation ? "Input validation library detected" : "No input validation framework detected", remediation: hasInputValidation ? undefined : "Add input validation using Zod, Joi, or similar" });

  // GDPR Controls
  checks.push({ framework: "GDPR", control: "Art. 25 - Data Protection by Design", status: criticalFindings === 0 ? (highFindings === 0 ? "pass" : "warning") : "fail", description: `${criticalFindings} critical and ${highFindings} high severity vulnerabilities`, remediation: criticalFindings > 0 ? "Fix all critical security findings before deployment" : undefined });
  checks.push({ framework: "GDPR", control: "Art. 32 - Security of Processing", status: hasEncryption ? "pass" : (hasPII ? "fail" : "not_applicable"), description: hasPII ? (hasEncryption ? "PII is processed with encryption" : "PII processed without encryption") : "No PII processing detected" });
  checks.push({ framework: "GDPR", control: "Art. 33 - Data Breach Notification", status: hasLogging ? "warning" : "fail", description: hasLogging ? "Basic logging exists but incident response unclear" : "No logging for breach detection", remediation: "Implement security event monitoring and incident response procedures" });

  return checks;
}

// ─── Momentum Score ──────────────────────────────────────────────────
function calculateMomentum(code: string, issues: StaticIssue[]): number {
  const lines = code.split("\n");
  const codeLines = lines.filter((l) => l.trim() && !l.trim().startsWith("#") && !l.trim().startsWith("//"));
  const totalLines = Math.max(codeLines.length, 1);
  const todoCount = issues.filter((i) => i.type === "todo").length;
  const stubCount = issues.filter((i) => i.type === "stub" || i.type === "empty_function").length;
  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  const funcsDefined = (code.match(/\b(def|function|func|fn|fun)\s+\w+/g) || []).length;
  const classesCount = (code.match(/\bclass\s+\w+/g) || []).length;
  const structureScore = Math.min(25, (funcsDefined + classesCount) * 4);
  const hasTryCatch = /\btry\b/.test(code);
  const hasCatch = /\.catch\(|\bcatch\b|\bexcept\b/.test(code);
  const errorHandlingBonus = (hasTryCatch ? 5 : 0) + (hasCatch ? 3 : 0);
  const docstrings = (code.match(/"""|'''|\/\*\*/g) || []).length;
  const docBonus = Math.min(8, docstrings * 3);
  const hasImports = /\bimport\b|\brequire\b|\b#include\b|\busing\b/.test(code);
  const importBonus = hasImports ? 3 : 0;
  const hasTests = /\b(test|it|describe|expect|assert)\s*\(/.test(code);
  const testBonus = hasTests ? 8 : 0;
  const hasTypes = /:\s*(string|number|boolean|int|float|i32|u64)\b|\binterface\b|\btype\b.*=/.test(code);
  const typeBonus = hasTypes ? 5 : 0;
  const todoPenalty = Math.min(20, todoCount * 4);
  const stubPenalty = Math.min(15, stubCount * 6);
  const errorPenalty = Math.min(15, errorCount * 5);
  const warningPenalty = Math.min(10, warningCount * 2);
  const lineScore = Math.min(25, Math.round((totalLines / 50) * 25));
  const raw = lineScore + structureScore + errorHandlingBonus + docBonus + importBonus + testBonus + typeBonus - todoPenalty - stubPenalty - errorPenalty - warningPenalty;
  return Math.max(5, Math.min(95, raw));
}

// ─── Code Metrics ─────────────────────────────────────────────────────
function computeMetrics(code: string, language: string) {
  const lines = code.split("\n");
  const totalLines = lines.length;
  const blankLines = lines.filter(l => l.trim() === "").length;
  const commentLines = lines.filter(l => { const t = l.trim(); return t.startsWith("//") || t.startsWith("#") || t.startsWith("/*") || t.startsWith("*") || t.startsWith("'''") || t.startsWith('"""'); }).length;
  const codeLines = totalLines - blankLines - commentLines;
  const funcCount = (code.match(/\b(?:def|function|func|fn|fun)\s+\w+/g) || []).length;
  const classCount = (code.match(/\bclass\s+\w+/g) || []).length;
  const importCount = (code.match(/\b(?:import|require|#include|using)\b/g) || []).length;
  const commentRatio = totalLines > 0 ? Math.round((commentLines / totalLines) * 100) : 0;
  return { total_lines: totalLines, code_lines: codeLines, blank_lines: blankLines, comment_lines: commentLines, comment_ratio: commentRatio, functions: funcCount, classes: classCount, imports: importCount };
}

function sseMessage(data: any): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

// ─── VirusTotal URL Scanner ──────────────────────────────────────────
interface VirusTotalResult {
  url: string;
  malicious: number;
  suspicious: number;
  harmless: number;
  undetected: number;
  status: "clean" | "suspicious" | "malicious" | "error";
  permalink?: string;
  error?: string;
}

function extractUrls(code: string): string[] {
  const urlRegex = /https?:\/\/[^\s'"`,;\])}><]+/gi;
  const matches = code.match(urlRegex) || [];
  // Deduplicate and filter out common non-interesting URLs
  const filtered = [...new Set(matches)].filter(u => {
    const lower = u.toLowerCase();
    return !lower.includes("localhost") &&
           !lower.includes("127.0.0.1") &&
           !lower.includes("example.com") &&
           !lower.includes("schemas.") &&
           !lower.includes("www.w3.org") &&
           !lower.includes("deno.land") &&
           !lower.includes("cdn.jsdelivr.net") &&
           !lower.includes("unpkg.com") &&
           !lower.includes("googleapis.com/auth") &&
           !lower.includes("json-schema.org");
  });
  return filtered.slice(0, 10); // Scan max 10 URLs
}

async function scanUrlsWithVirusTotal(urls: string[], apiKey: string): Promise<VirusTotalResult[]> {
  const results: VirusTotalResult[] = [];

  for (const url of urls) {
    try {
      // URL ID for VT is base64url of the URL
      const urlId = btoa(url).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

      const response = await fetch(`https://www.virustotal.com/api/v3/urls/${urlId}`, {
        headers: { "x-apikey": apiKey },
      });

      if (response.status === 404) {
        // URL not in VT database — submit it
        const submitResp = await fetch("https://www.virustotal.com/api/v3/urls", {
          method: "POST",
          headers: { "x-apikey": apiKey, "Content-Type": "application/x-www-form-urlencoded" },
          body: `url=${encodeURIComponent(url)}`,
        });
        if (submitResp.ok) {
          results.push({ url, malicious: 0, suspicious: 0, harmless: 0, undetected: 0, status: "clean", error: "Submitted for scanning — results pending" });
        } else {
          await submitResp.text();
          results.push({ url, malicious: 0, suspicious: 0, harmless: 0, undetected: 0, status: "error", error: "Failed to submit URL" });
        }
        continue;
      }

      if (!response.ok) {
        const errText = await response.text();
        results.push({ url, malicious: 0, suspicious: 0, harmless: 0, undetected: 0, status: "error", error: `VT API error: ${response.status}` });
        continue;
      }

      const data = await response.json();
      const stats = data?.data?.attributes?.last_analysis_stats || {};
      const malicious = stats.malicious || 0;
      const suspicious = stats.suspicious || 0;
      const harmless = stats.harmless || 0;
      const undetected = stats.undetected || 0;
      const permalink = data?.data?.links?.self || undefined;

      let status: VirusTotalResult["status"] = "clean";
      if (malicious > 0) status = "malicious";
      else if (suspicious > 0) status = "suspicious";

      results.push({ url, malicious, suspicious, harmless, undetected, status, permalink });
    } catch (e) {
      results.push({ url, malicious: 0, suspicious: 0, harmless: 0, undetected: 0, status: "error", error: e instanceof Error ? e.message : "Unknown error" });
    }
  }

  return results;
}

// ─── Main Handler ─────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Require an authenticated user
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const supa = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    );
    const { data: userData, error: userErr } = await supa.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { code, language, explanation_level, stream, project_name, total_files } = body;

    if (!code || typeof code !== "string") {
      return new Response(JSON.stringify({ error: "code field is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Increased limit for large projects: 5MB
    if (code.length > 5_000_000) {
      return new Response(JSON.stringify({ error: "Code exceeds 5MB limit. Try uploading fewer files." }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const detectedLang = language || detectLanguage(code);
    const issues = staticAnalyze(code, detectedLang);
    const securityFindings = enterpriseSecurityScan(code, detectedLang);
    const dependencyFindings = auditDependencies(code);
    const complianceResults = runComplianceChecks(code, securityFindings);
    const momentum = calculateMomentum(code, issues);
    const metrics = computeMetrics(code, detectedLang);
    const level = explanation_level || "Intermediate";

    // VirusTotal URL scanning
    const VT_API_KEY = Deno.env.get("VIRUSTOTAL_API_KEY");
    const extractedUrls = extractUrls(code);
    let virusTotalResults: VirusTotalResult[] = [];
    if (VT_API_KEY && extractedUrls.length > 0) {
      try {
        virusTotalResults = await scanUrlsWithVirusTotal(extractedUrls, VT_API_KEY);
      } catch (e) {
        console.error("VirusTotal scan error:", e);
      }
    }

    const classMatch = code.match(/class\s+(\w+)/);
    const funcMatches = code.match(/\b(?:def|function|func|fn|fun)\s+(\w+)/g) || [];
    const exportMatches = code.match(/export\s+(?:default\s+)?(?:function|class|const)\s+(\w+)/g) || [];
    const goalHint = project_name
      ? `Analyze project: ${project_name} (${total_files || "?"} files, ${metrics.code_lines} lines)`
      : classMatch
      ? `Build ${classMatch[1]} (${funcMatches.length} method(s), ${metrics.code_lines} lines)`
      : funcMatches.length > 0
      ? `Implement ${funcMatches.length} function(s) across ${metrics.code_lines} lines`
      : exportMatches.length > 0
      ? `Module with ${exportMatches.length} export(s)`
      : "Complete the code module";

    const issueSummary = {
      errors: issues.filter(i => i.severity === "error").length,
      warnings: issues.filter(i => i.severity === "warning").length,
      info: issues.filter(i => i.severity === "info").length,
      types: [...new Set(issues.map(i => i.type))],
    };

    const securitySummary = {
      critical: securityFindings.filter(f => f.severity === "critical").length,
      high: securityFindings.filter(f => f.severity === "high").length,
      medium: securityFindings.filter(f => f.severity === "medium").length,
      low: securityFindings.filter(f => f.severity === "low").length,
      total: securityFindings.length,
    };

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const buildStaticResult = () => ({
      goal: goalHint,
      language: detectedLang,
      current_state: `${issues.length} issue(s) detected (${issueSummary.errors} errors, ${issueSummary.warnings} warnings) | ${securityFindings.length} security finding(s)`,
      completion_percentage: momentum,
      effort_level: momentum > 65 ? "Low" : momentum > 35 ? "Medium" : "High",
      next_steps: [
        ...securityFindings.filter(f => f.severity === "critical").map(f => `🔴 CRITICAL: ${f.title}`).slice(0, 2),
        ...issues.filter(i => i.severity === "error").map(i => `🔴 Fix: ${i.message}`).slice(0, 3),
        ...securityFindings.filter(f => f.severity === "high").map(f => `🟠 Security: ${f.title}`).slice(0, 2),
        ...issues.filter(i => i.severity === "warning").map(i => `🟡 Address: ${i.message}`).slice(0, 3),
        ...issues.filter(i => i.severity === "info").map(i => `💡 Consider: ${i.message}`).slice(0, 2),
      ].slice(0, 8) || ["Review and refactor existing logic"],
      risks: [
        ...securityFindings.filter(f => f.severity === "critical" || f.severity === "high").map(f => `🔒 ${f.title}: ${f.description}`),
        ...issues.filter(i => i.severity === "error").map(i => i.message),
      ].slice(0, 8),
      issues,
      confidence_score: 0.75,
      architectural_improvements: [],
      metrics,
      source: "static-analysis",
      security_issues: securityFindings,
      dependency_audit: dependencyFindings,
      compliance_checks: complianceResults,
      security_summary: securitySummary,
      virustotal_results: virusTotalResults,
    });

    const systemPrompt = `You are DevResume AI, an elite-level code analysis engine used by senior engineers. Perform deep, precise analysis including security assessment.

RULES:
- Be surgical — reference actual code patterns, variable names, and line-level issues
- Don't hallucinate features or patterns not present in the code
- Calibrate completion_percentage carefully: use ${momentum}% as baseline, adjust ±20 based on code quality
- Severity matters: prioritize critical security > errors > warnings > suggestions
- Consider: architecture, maintainability, testability, security, performance, and readability
- For next_steps: be specific and actionable
- For risks: identify actual vulnerabilities, not generic advice
- architectural_improvements should suggest design pattern changes

SECURITY CONTEXT:
${securitySummary.total} security findings: ${securitySummary.critical} critical, ${securitySummary.high} high, ${securitySummary.medium} medium
Top findings: ${securityFindings.slice(0, 5).map(f => `[${f.severity.toUpperCase()}] ${f.title}`).join("; ")}
Dependency issues: ${dependencyFindings.length} found
Compliance: ${complianceResults.filter(c => c.status === "fail").length} failures, ${complianceResults.filter(c => c.status === "warning").length} warnings

CONTEXT:
Language: ${detectedLang}
Code Lines: ${metrics.code_lines} | Functions: ${metrics.functions} | Classes: ${metrics.classes}
Comment Ratio: ${metrics.comment_ratio}%
Static Issues: ${issueSummary.errors} errors, ${issueSummary.warnings} warnings, ${issueSummary.info} info
Issue Types Found: ${issueSummary.types.join(", ")}
Explanation Level: ${level}`;

    const userPrompt = `Analyze this ${detectedLang} code thoroughly (security + quality):

\`\`\`${detectedLang.toLowerCase()}
${code.slice(0, 60000)}
\`\`\``;

    const toolSchema = {
      type: "function" as const,
      function: {
        name: "return_analysis",
        description: "Return the structured code analysis result with deep insights including security",
        parameters: {
          type: "object",
          properties: {
            goal: { type: "string", description: "What the code is trying to accomplish" },
            explanation: { type: "string", description: "Detailed current state assessment (2-4 sentences) including security posture" },
            completion_percentage: { type: "number", description: `0-100 score. Baseline: ${momentum}%. Adjust ±20` },
            effort_level: { type: "string", enum: ["Low", "Medium", "High"] },
            next_steps: { type: "array", items: { type: "string" }, description: "4-8 specific, actionable steps including security fixes. Prefix: 🔴 critical, 🟠 security, 🟡 important, 💡 nice-to-have" },
            risks: { type: "array", items: { type: "string" }, description: "3-6 specific risks including security vulnerabilities" },
            architectural_improvements: { type: "array", items: { type: "string" }, description: "1-4 design pattern or architecture suggestions" },
            code_quality_grade: { type: "string", enum: ["A", "B", "C", "D", "F"] },
            highlights: { type: "array", items: { type: "string" }, description: "1-3 things the code does well" },
          },
          required: ["goal", "explanation", "completion_percentage", "effort_level", "next_steps", "risks", "architectural_improvements", "code_quality_grade", "highlights"],
          additionalProperties: false,
        },
      },
    };

    if (stream) {
      const encoder = new TextEncoder();
      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            controller.enqueue(encoder.encode(sseMessage({ type: "progress", message: `Detected language: ${detectedLang}` })));
            controller.enqueue(encoder.encode(sseMessage({ type: "progress", message: `${metrics.code_lines} code lines | ${metrics.functions} functions | ${metrics.classes} classes` })));
            controller.enqueue(encoder.encode(sseMessage({ type: "progress", message: `Found ${issues.length} code issue(s) — momentum ${momentum}%` })));
            controller.enqueue(encoder.encode(sseMessage({ type: "progress", message: `🔒 Security scan: ${securityFindings.length} finding(s) (${securitySummary.critical} critical, ${securitySummary.high} high)` })));
            controller.enqueue(encoder.encode(sseMessage({ type: "progress", message: `📦 Dependency audit: ${dependencyFindings.length} issue(s) found` })));
            controller.enqueue(encoder.encode(sseMessage({ type: "progress", message: `📋 Compliance: ${complianceResults.filter(c => c.status === "fail").length} failures, ${complianceResults.filter(c => c.status === "pass").length} passing` })));
            if (virusTotalResults.length > 0) {
              const vtMalicious = virusTotalResults.filter(r => r.status === "malicious").length;
              const vtSuspicious = virusTotalResults.filter(r => r.status === "suspicious").length;
              controller.enqueue(encoder.encode(sseMessage({ type: "progress", message: `🛡️ VirusTotal: ${virusTotalResults.length} URL(s) scanned — ${vtMalicious} malicious, ${vtSuspicious} suspicious` })));
            }

            if (!LOVABLE_API_KEY) {
              controller.enqueue(encoder.encode(sseMessage({ type: "progress", message: "Running deep static + security analysis..." })));
              controller.enqueue(encoder.encode(sseMessage({ type: "result", data: buildStaticResult() })));
            } else {
              controller.enqueue(encoder.encode(sseMessage({ type: "progress", message: "AI is analyzing patterns, architecture, security & compliance..." })));

              const llmResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                method: "POST",
                headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                  model: "google/gemini-2.5-pro",
                  messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
                  tools: [toolSchema],
                  tool_choice: { type: "function", function: { name: "return_analysis" } },
                }),
              });

              if (!llmResponse.ok) {
                const status = llmResponse.status;
                controller.enqueue(encoder.encode(sseMessage({ type: "progress", message: status === 429 ? "Rate limited — falling back to static analysis" : `AI error (${status}) — using static analysis` })));
                controller.enqueue(encoder.encode(sseMessage({ type: "result", data: buildStaticResult() })));
              } else {
                controller.enqueue(encoder.encode(sseMessage({ type: "progress", message: "Processing AI insights..." })));
                const llmData = await llmResponse.json();
                const toolCall = llmData.choices?.[0]?.message?.tool_calls?.[0];
                let analysis: any;

                if (toolCall?.function?.arguments) {
                  analysis = typeof toolCall.function.arguments === "string" ? JSON.parse(toolCall.function.arguments) : toolCall.function.arguments;
                } else {
                  const content = llmData.choices?.[0]?.message?.content || "";
                  const jsonMatch = content.match(/\{[\s\S]*\}/);
                  analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
                }

                if (analysis) {
                  controller.enqueue(encoder.encode(sseMessage({
                    type: "result",
                    data: {
                      goal: analysis.goal || goalHint,
                      language: detectedLang,
                      current_state: analysis.explanation || `${issues.length} issue(s) detected`,
                      completion_percentage: Math.max(5, Math.min(95, analysis.completion_percentage ?? momentum)),
                      effort_level: analysis.effort_level || "Medium",
                      next_steps: analysis.next_steps || [],
                      risks: analysis.risks || [],
                      issues,
                      confidence_score: 0.94,
                      architectural_improvements: analysis.architectural_improvements || [],
                      code_quality_grade: analysis.code_quality_grade || null,
                      highlights: analysis.highlights || [],
                      metrics,
                      source: "llm-enhanced",
                      security_issues: securityFindings,
                      dependency_audit: dependencyFindings,
                      compliance_checks: complianceResults,
                      security_summary: securitySummary,
                      virustotal_results: virusTotalResults,
                    },
                  })));
                } else {
                  controller.enqueue(encoder.encode(sseMessage({ type: "result", data: buildStaticResult() })));
                }
              }
            }
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          } catch (e) {
            console.error("Stream error:", e);
            controller.enqueue(encoder.encode(sseMessage({ type: "error", message: "Analysis failed. Please try again." })));
            controller.close();
          }
        },
      });

      return new Response(readableStream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
    }

    // Non-streaming
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify(buildStaticResult()), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const llmResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        tools: [toolSchema],
        tool_choice: { type: "function", function: { name: "return_analysis" } },
      }),
    });

    if (!llmResponse.ok) {
      const status = llmResponse.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error("LLM analysis failed");
    }

    const llmData = await llmResponse.json();
    const toolCall = llmData.choices?.[0]?.message?.tool_calls?.[0];
    let analysis: any;
    if (toolCall?.function?.arguments) {
      analysis = typeof toolCall.function.arguments === "string" ? JSON.parse(toolCall.function.arguments) : toolCall.function.arguments;
    } else {
      const content = llmData.choices?.[0]?.message?.content || "";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    }
    if (!analysis) throw new Error("Failed to parse LLM response");

    return new Response(JSON.stringify({
      goal: analysis.goal || goalHint,
      language: detectedLang,
      current_state: analysis.explanation || `${issues.length} issue(s) detected`,
      completion_percentage: Math.max(5, Math.min(95, analysis.completion_percentage ?? momentum)),
      effort_level: analysis.effort_level || "Medium",
      next_steps: analysis.next_steps || [],
      risks: analysis.risks || [],
      issues,
      confidence_score: 0.94,
      architectural_improvements: analysis.architectural_improvements || [],
      code_quality_grade: analysis.code_quality_grade || null,
      highlights: analysis.highlights || [],
      metrics,
      source: "llm-enhanced",
      security_issues: securityFindings,
      dependency_audit: dependencyFindings,
      compliance_checks: complianceResults,
      security_summary: securitySummary,
      virustotal_results: virusTotalResults,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("analyze error:", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
