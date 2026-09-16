<?php
// Shared plumbing for every api/*.php endpoint: JSON responses, SQLite access,
// schema migration + first-run seed, sessions, roles, CSRF, rate limiting,
// and the course manifest. Written for PHP 7.4+ (works on 8.x) with pdo_sqlite.

declare(strict_types=1);

require __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

set_exception_handler(function (Throwable $e): void {
    error_log('[portal-api] ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    $body = ['error' => 'Server error'];
    if (DEBUG) $body['detail'] = $e->getMessage() . ' @ ' . basename($e->getFile()) . ':' . $e->getLine();
    http_response_code(500);
    echo json_encode($body);
    exit;
});
set_error_handler(function (int $no, string $str, string $file, int $line): bool {
    if (!(error_reporting() & $no)) return false;
    throw new ErrorException($str, 0, $no, $file, $line);
});

// ---------------------------------------------------------------------------
// Responses & input
// ---------------------------------------------------------------------------
function respond(array $data, int $code = 200): void
{
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function fail(string $message, int $code = 400, array $extra = []): void
{
    respond(array_merge(['error' => $message], $extra), $code);
}

function method(): string
{
    return strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
}

function require_post(): void
{
    if (method() !== 'POST') fail('POST required', 405);
}

/** JSON body (preferred) merged over form fields. */
function input(): array
{
    static $cache = null;
    if ($cache !== null) return $cache;
    $raw = file_get_contents('php://input');
    $data = [];
    $ctype = $_SERVER['CONTENT_TYPE'] ?? '';
    if ($raw !== '' && $raw !== false && stripos($ctype, 'application/json') !== false) {
        $decoded = json_decode($raw, true);
        if (is_array($decoded)) $data = $decoded;
    }
    $cache = array_merge($_POST, $data);
    return $cache;
}

function q(string $key, $default = null)
{
    return array_key_exists($key, $_GET) ? $_GET[$key] : $default;
}

function in_str(array $data, string $key, string $default = ''): string
{
    $v = $data[$key] ?? $default;
    if (is_array($v) || is_object($v)) return $default;
    return trim((string)$v);
}

function in_int(array $data, string $key, ?int $default = null): ?int
{
    if (!array_key_exists($key, $data) || $data[$key] === '' || $data[$key] === null) return $default;
    if (!is_numeric($data[$key])) return $default;
    return (int)$data[$key];
}

function in_bool(array $data, string $key, bool $default = false): bool
{
    if (!array_key_exists($key, $data)) return $default;
    $v = $data[$key];
    if (is_bool($v)) return $v;
    if (is_string($v)) return in_array(strtolower($v), ['1', 'true', 'yes', 'on'], true);
    return (bool)$v;
}

function now(): string
{
    return gmdate('Y-m-d\TH:i:s\Z');
}

function random_token(int $bytes = 16): string
{
    return bin2hex(random_bytes($bytes));
}

function ensure_dir(string $path): void
{
    if (is_dir($path)) return;
    if (!@mkdir($path, 0755, true) && !is_dir($path)) {
        throw new RuntimeException('Cannot create directory ' . $path);
    }
}

function client_ip(): string
{
    return (string)($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
}

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------
function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) return $pdo;
    ensure_dir(DATA_DIR);
    $fresh = !file_exists(DB_FILE);
    $pdo = new PDO('sqlite:' . DB_FILE, null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $pdo->exec('PRAGMA foreign_keys = ON');
    $pdo->exec('PRAGMA busy_timeout = 5000');
    if ($fresh) @chmod(DB_FILE, 0640);
    migrate($pdo);
    return $pdo;
}

function migrate(PDO $pdo): void
{
    $pdo->exec('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)');
    $ver = (int)($pdo->query("SELECT value FROM settings WHERE key = 'schema_version'")->fetchColumn() ?: 0);
    if ($ver < 1) {
        $pdo->exec("CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL UNIQUE,
            first_name TEXT NOT NULL DEFAULT '',
            last_name TEXT NOT NULL DEFAULT '',
            group_name TEXT NOT NULL DEFAULT '',
            phone TEXT NOT NULL DEFAULT '',
            address TEXT NOT NULL DEFAULT '',
            city TEXT NOT NULL DEFAULT '',
            state TEXT NOT NULL DEFAULT '',
            zip TEXT NOT NULL DEFAULT '',
            role TEXT NOT NULL DEFAULT 'student',
            password_hash TEXT,
            must_change_password INTEGER NOT NULL DEFAULT 0,
            active INTEGER NOT NULL DEFAULT 1,
            notes TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            last_login_at TEXT,
            created_by INTEGER
        )");
        $pdo->exec("CREATE TABLE IF NOT EXISTS completions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            course_id TEXT NOT NULL,
            score INTEGER,
            total INTEGER,
            passed_at TEXT NOT NULL,
            method TEXT NOT NULL DEFAULT 'quiz',
            granted_by INTEGER,
            note TEXT NOT NULL DEFAULT '',
            UNIQUE(user_id, course_id)
        )");
        $pdo->exec("CREATE INDEX IF NOT EXISTS idx_completions_course ON completions(course_id)");
        $pdo->exec("CREATE TABLE IF NOT EXISTS quiz_overrides (
            course_id TEXT PRIMARY KEY,
            quiz_json TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            updated_by INTEGER
        )");
        $pdo->exec("CREATE TABLE IF NOT EXISTS video_overrides (
            original TEXT PRIMARY KEY,
            replacement TEXT NOT NULL,
            course_id TEXT NOT NULL DEFAULT '',
            original_name TEXT NOT NULL DEFAULT '',
            size INTEGER NOT NULL DEFAULT 0,
            uploaded_at TEXT NOT NULL,
            uploaded_by INTEGER
        )");
        $pdo->exec("CREATE TABLE IF NOT EXISTS uploads (
            id TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            filename TEXT NOT NULL,
            size INTEGER NOT NULL,
            received INTEGER NOT NULL DEFAULT 0,
            next_index INTEGER NOT NULL DEFAULT 0,
            course_id TEXT NOT NULL,
            original TEXT NOT NULL,
            created_at TEXT NOT NULL
        )");
        $pdo->exec("CREATE TABLE IF NOT EXISTS login_attempts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL,
            ip TEXT NOT NULL,
            at INTEGER NOT NULL,
            success INTEGER NOT NULL
        )");
        $pdo->exec("CREATE INDEX IF NOT EXISTS idx_login_attempts_at ON login_attempts(at)");
        $pdo->exec("CREATE TABLE IF NOT EXISTS audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            at TEXT NOT NULL,
            user_id INTEGER,
            action TEXT NOT NULL,
            target TEXT NOT NULL DEFAULT '',
            detail TEXT
        )");
        $pdo->exec("INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', '1')");
    }
    seed_superadmin($pdo);
}

function seed_superadmin(PDO $pdo): void
{
    $count = (int)$pdo->query('SELECT COUNT(*) FROM users')->fetchColumn();
    if ($count > 0) return;
    $ts = now();
    $st = $pdo->prepare('INSERT INTO users (email, first_name, last_name, group_name, role, password_hash, must_change_password, active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 1, 1, ?, ?)');
    $st->execute([
        normalize_email(SEED_SUPERADMIN_EMAIL),
        SEED_SUPERADMIN_FIRST,
        SEED_SUPERADMIN_LAST,
        SEED_SUPERADMIN_GROUP,
        'superadmin',
        password_hash(SEED_SUPERADMIN_PASSWORD, PASSWORD_DEFAULT),
        $ts,
        $ts,
    ]);
    $pdo->prepare('INSERT INTO audit_log (at, user_id, action, target, detail) VALUES (?, NULL, ?, ?, ?)')
        ->execute([$ts, 'seed.superadmin', SEED_SUPERADMIN_EMAIL, 'Initial super admin created; password change required on first login']);
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
function setting_get(string $key, $default = null)
{
    $st = db()->prepare('SELECT value FROM settings WHERE key = ?');
    $st->execute([$key]);
    $v = $st->fetchColumn();
    return $v === false ? $default : $v;
}

function setting_set(string $key, $value): void
{
    db()->prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')->execute([$key, (string)$value]);
}

/** Settings the portal and admin UI care about, with defaults. */
function public_settings(): array
{
    return [
        'pass_threshold' => (int)setting_get('pass_threshold', 100),
        'portal_title' => (string)setting_get('portal_title', 'Digital Certification'),
    ];
}

// ---------------------------------------------------------------------------
// Sessions & auth
// ---------------------------------------------------------------------------
function session_boot(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) return;
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    session_name(SESSION_NAME);
    ini_set('session.use_strict_mode', '1');
    ini_set('session.gc_maxlifetime', (string)max(SESSION_LIFETIME, 60 * 60 * 24 * 14));
    session_set_cookie_params([
        'lifetime' => 60 * 60 * 24 * 14,
        'path' => '/',
        'secure' => $https,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
    $t = time();
    if (isset($_SESSION['uid']) && isset($_SESSION['last']) && ($t - (int)$_SESSION['last']) > SESSION_LIFETIME) {
        // Idle too long: drop the login but keep the session container.
        unset($_SESSION['uid'], $_SESSION['csrf'], $_SESSION['impersonator_uid']);
    }
    $_SESSION['last'] = $t;
}

function login_session(array $user): string
{
    session_boot();
    session_regenerate_id(true);
    $_SESSION['uid'] = (int)$user['id'];
    $_SESSION['csrf'] = random_token(24);
    $_SESSION['last'] = time();
    return $_SESSION['csrf'];
}

function logout_session(): void
{
    session_boot();
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', [
            'expires' => time() - 42000,
            'path' => $p['path'],
            'domain' => $p['domain'],
            'secure' => $p['secure'],
            'httponly' => $p['httponly'],
            'samesite' => $p['samesite'] ?? 'Lax',
        ]);
    }
    session_destroy();
}

function csrf_token(): string
{
    session_boot();
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = random_token(24);
    return $_SESSION['csrf'];
}

function current_user(): ?array
{
    static $cached = false;
    if ($cached !== false) return $cached;
    session_boot();
    $uid = isset($_SESSION['uid']) ? (int)$_SESSION['uid'] : 0;
    if ($uid <= 0) { $cached = null; return null; }
    $u = fetch_user($uid);
    if (!$u || (int)$u['active'] !== 1) { $cached = null; return null; }
    $cached = $u;
    return $u;
}

function require_login(): array
{
    $u = current_user();
    if (!$u) fail('Not signed in', 401, ['code' => 'unauthenticated']);
    return $u;
}

// ---------------------------------------------------------------------------
// Impersonation ("sign in as"): a permitted super admin temporarily becomes another
// person. The real account is remembered in the session so they can switch back,
// and every audit entry written meanwhile records who was really acting.
// ---------------------------------------------------------------------------
function impersonator(): ?array
{
    session_boot();
    $iid = isset($_SESSION['impersonator_uid']) ? (int)$_SESSION['impersonator_uid'] : 0;
    if ($iid <= 0) return null;
    $u = fetch_user($iid);
    return ($u && (int)$u['active'] === 1) ? $u : null;
}

function can_impersonate(array $actor): bool
{
    if (($actor['role'] ?? '') !== 'superadmin') return false;
    $allow = IMPERSONATE_ALLOWED_EMAILS;
    if (!is_array($allow) || count($allow) === 0) return true;
    return in_array(normalize_email((string)$actor['email']), array_map('normalize_email', $allow), true);
}

/** Session facts the portal and admin UIs need next to the user object. */
function session_extras(): array
{
    $u = current_user();
    $imp = impersonator();
    return [
        'impersonating' => $imp ? ['by' => display_name($imp), 'by_id' => (int)$imp['id'], 'by_email' => $imp['email']] : null,
        'can_impersonate' => (bool)($u && !$imp && can_impersonate($u)),
    ];
}

const ROLES = ['student', 'trainer', 'admin', 'superadmin'];

function role_rank(string $role): int
{
    $i = array_search($role, ROLES, true);
    return $i === false ? -1 : (int)$i;
}

function require_role(string $min): array
{
    $u = require_login();
    if (role_rank($u['role']) < role_rank($min)) fail('You do not have permission to do that', 403, ['code' => 'forbidden']);
    return $u;
}

/** Can $actor create/edit/delete a user holding $targetRole? */
function can_manage(array $actor, string $targetRole): bool
{
    if ($actor['role'] === 'superadmin') return true;
    if ($actor['role'] === 'admin') return role_rank($targetRole) <= role_rank('admin');
    return false;
}

function assignable_roles(array $actor): array
{
    if ($actor['role'] === 'superadmin') return ROLES;
    if ($actor['role'] === 'admin') return ['student', 'trainer', 'admin'];
    return [];
}

/** State-changing requests from a signed-in session must carry the CSRF header. */
function require_csrf(): void
{
    session_boot();
    $sent = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? (input()['csrf'] ?? '');
    $have = $_SESSION['csrf'] ?? '';
    if (!is_string($sent) || $have === '' || !hash_equals($have, $sent)) {
        fail('Security token missing or expired. Reload the page and try again.', 403, ['code' => 'csrf']);
    }
    $site = $_SERVER['HTTP_SEC_FETCH_SITE'] ?? '';
    if ($site === 'cross-site') fail('Cross-site request blocked', 403, ['code' => 'csrf']);
}

function audit(?int $userId, string $action, string $target = '', $detail = null): void
{
    if ($detail !== null && !is_string($detail)) $detail = json_encode($detail, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if (session_status() === PHP_SESSION_ACTIVE && !empty($_SESSION['impersonator_uid'])) {
        $imp = fetch_user((int)$_SESSION['impersonator_uid']);
        $detail = json_encode([
            'impersonated_by' => $imp ? $imp['email'] : (int)$_SESSION['impersonator_uid'],
            'detail' => $detail,
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    }
    db()->prepare('INSERT INTO audit_log (at, user_id, action, target, detail) VALUES (?, ?, ?, ?, ?)')
        ->execute([now(), $userId, $action, $target, $detail]);
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
function normalize_email(string $email): string
{
    return strtolower(trim($email));
}

function valid_email(string $email): bool
{
    return filter_var($email, FILTER_VALIDATE_EMAIL) !== false && strlen($email) <= 254;
}

/** Returns an error message, or null when the password is acceptable. */
function password_problem(string $pw): ?string
{
    if (strlen($pw) < MIN_PASSWORD_LENGTH) return 'Password must be at least ' . MIN_PASSWORD_LENGTH . ' characters.';
    if (strlen($pw) > 200) return 'Password is too long.';
    return null;
}

function fetch_user(int $id): ?array
{
    $st = db()->prepare('SELECT * FROM users WHERE id = ?');
    $st->execute([$id]);
    $u = $st->fetch();
    return $u ?: null;
}

function fetch_user_by_email(string $email): ?array
{
    $st = db()->prepare('SELECT * FROM users WHERE email = ?');
    $st->execute([normalize_email($email)]);
    $u = $st->fetch();
    return $u ?: null;
}

function display_name(array $u): string
{
    $n = trim(($u['first_name'] ?? '') . ' ' . ($u['last_name'] ?? ''));
    return $n !== '' ? $n : (string)($u['email'] ?? '');
}

/** Row → safe public shape (never includes the password hash). */
function user_public(array $u): array
{
    return [
        'id' => (int)$u['id'],
        'email' => $u['email'],
        'first_name' => $u['first_name'],
        'last_name' => $u['last_name'],
        'name' => display_name($u),
        'group_name' => $u['group_name'],
        'phone' => $u['phone'],
        'address' => $u['address'],
        'city' => $u['city'],
        'state' => $u['state'],
        'zip' => $u['zip'],
        'role' => $u['role'],
        'has_password' => !empty($u['password_hash']),
        'must_change_password' => (int)$u['must_change_password'] === 1,
        'active' => (int)$u['active'] === 1,
        'notes' => $u['notes'] ?? '',
        'created_at' => $u['created_at'],
        'updated_at' => $u['updated_at'],
        'last_login_at' => $u['last_login_at'],
    ];
}

// ---------------------------------------------------------------------------
// Login throttling
// ---------------------------------------------------------------------------
function rate_limit_check(string $email, string $ip): void
{
    $pdo = db();
    $since = time() - LOGIN_WINDOW_SECONDS;
    $pdo->prepare('DELETE FROM login_attempts WHERE at < ?')->execute([time() - 60 * 60 * 24]);
    $st = $pdo->prepare('SELECT COUNT(*) FROM login_attempts WHERE success = 0 AND at >= ? AND (email = ? OR ip = ?)');
    $st->execute([$since, $email, $ip]);
    if ((int)$st->fetchColumn() >= LOGIN_MAX_FAILURES) {
        fail('Too many failed sign-in attempts. Please wait a few minutes and try again.', 429, ['code' => 'rate_limited']);
    }
}

function rate_limit_record(string $email, string $ip, bool $success): void
{
    db()->prepare('INSERT INTO login_attempts (email, ip, at, success) VALUES (?, ?, ?, ?)')
        ->execute([$email, $ip, time(), $success ? 1 : 0]);
    if ($success) {
        db()->prepare('DELETE FROM login_attempts WHERE email = ? AND success = 0')->execute([$email]);
    }
}

// ---------------------------------------------------------------------------
// Courses (manifest + overrides) and progress
// ---------------------------------------------------------------------------
function manifest(): array
{
    static $m = null;
    if ($m !== null) return $m;
    if (!is_file(MANIFEST_FILE)) throw new RuntimeException('course-manifest.json is missing from data/');
    $decoded = json_decode((string)file_get_contents(MANIFEST_FILE), true);
    if (!is_array($decoded) || empty($decoded['courses'])) throw new RuntimeException('course-manifest.json is not valid');
    $m = $decoded;
    return $m;
}

/** id => course */
function course_map(): array
{
    static $map = null;
    if ($map !== null) return $map;
    $map = [];
    foreach (manifest()['courses'] as $c) $map[$c['id']] = $c;
    return $map;
}

function course_exists(string $id): bool
{
    return isset(course_map()[$id]);
}

/** Resolve a course by id or (case-insensitive) title. */
function resolve_course_id(string $idOrTitle): ?string
{
    $s = trim($idOrTitle);
    if ($s === '') return null;
    if (course_exists($s)) return $s;
    $lower = mb_strtolower($s);
    foreach (course_map() as $id => $c) {
        if (mb_strtolower($c['title']) === $lower) return $id;
    }
    return null;
}

/** course_id => {score,total,date,method} for one user (the portal's progress map). */
function progress_for(int $userId): array
{
    $st = db()->prepare('SELECT course_id, score, total, passed_at, method FROM completions WHERE user_id = ?');
    $st->execute([$userId]);
    $out = [];
    foreach ($st->fetchAll() as $r) {
        $out[$r['course_id']] = [
            'score' => $r['score'] === null ? null : (int)$r['score'],
            'total' => $r['total'] === null ? null : (int)$r['total'],
            'date' => $r['passed_at'],
            'method' => $r['method'],
        ];
    }
    return $out;
}

/** What the portal needs to swap in: replaced videos and edited quizzes. */
function overrides(): array
{
    $pdo = db();
    $videos = [];
    foreach ($pdo->query('SELECT original, replacement FROM video_overrides')->fetchAll() as $r) {
        $videos[$r['original']] = $r['replacement'];
    }
    $quizzes = [];
    foreach ($pdo->query('SELECT course_id, quiz_json FROM quiz_overrides')->fetchAll() as $r) {
        $q = json_decode($r['quiz_json'], true);
        if (is_array($q) && count($q)) $quizzes[$r['course_id']] = $q;
    }
    // Cast so empty maps serialize as {} rather than [] for the JavaScript side.
    return ['videos' => (object)$videos, 'quizzes' => (object)$quizzes];
}

/** Validate an admin-edited quiz; returns the cleaned array or fails the request. */
function clean_quiz($quiz): array
{
    if (!is_array($quiz) || count($quiz) === 0) fail('A quiz needs at least one question.');
    if (count($quiz) > 50) fail('A quiz can have at most 50 questions.');
    $out = [];
    foreach (array_values($quiz) as $i => $q) {
        $n = $i + 1;
        if (!is_array($q)) fail("Question $n is malformed.");
        $text = trim((string)($q['text'] ?? ''));
        if ($text === '') fail("Question $n needs text.");
        $opts = array_values(array_map(fn($o) => trim((string)$o), is_array($q['options'] ?? null) ? $q['options'] : []));
        $opts = array_values(array_filter($opts, fn($o) => $o !== ''));
        if (count($opts) < 2) fail("Question $n needs at least two answer options.");
        if (count($opts) > 6) fail("Question $n has too many options (max 6).");
        $correct = (int)($q['correct'] ?? -1);
        if ($correct < 0 || $correct >= count($opts)) fail("Question $n needs a correct answer selected.");
        $section = (int)($q['section'] ?? 0);
        if ($section < 0 || $section > 12) $section = 0;
        $out[] = [
            'section' => $section,
            'text' => mb_substr($text, 0, 1000),
            'options' => array_map(fn($o) => mb_substr($o, 0, 500), $opts),
            'correct' => $correct,
            'why' => mb_substr(trim((string)($q['why'] ?? '')), 0, 1000),
        ];
    }
    return $out;
}
