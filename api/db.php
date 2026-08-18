<?php
/**
 * Shared bootstrap: config, database handle, CORS, JSON helpers, validation,
 * rate limiting. Every endpoint requires this file first.
 */

declare(strict_types=1);

// Never leak stack traces to a browser; log them instead.
ini_set('display_errors', '0');
error_reporting(E_ALL);

const NIVAS_FLOOR_COUNT     = 9;
const NIVAS_ROOMS_PER_FLOOR = 30;   // pods of 8 / 8 / 6 / 8 — mirrors app.js

const NIVAS_HOSTELS = [
    'Aryabhatta', 'Bhabha', 'Bhaskara', 'Brahmagupta', 'Charaka', 'Kalam',
    'Kapila', 'Kautilya', 'Raman', 'Ramanujan', 'Sarabhai',
    'Susruta', 'Varahamihira', 'Viswesvaraya', 'Vyasa',
];

function nivas_config(): array
{
    static $config = null;
    if ($config === null) {
        $path = __DIR__ . '/config.php';
        if (!is_file($path)) {
            nivas_fail(500, 'The API is not configured yet: copy config.example.php to config.php.');
        }
        $config = require $path;
    }
    return $config;
}

function nivas_db(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        $db = nivas_config()['db'];
        try {
            $pdo = new PDO(
                "mysql:host={$db['host']};dbname={$db['name']};charset=utf8mb4",
                $db['user'],
                $db['pass'],
                [
                    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES   => false,
                ]
            );
        } catch (Throwable $e) {
            error_log('Nivas DB connect failed: ' . $e->getMessage());
            nivas_fail(500, 'Database unavailable.');
        }
    }
    return $pdo;
}

/** CORS + preflight. Call once, first thing, in every endpoint. */
function nivas_begin(string $method): array
{
    $origin  = $_SERVER['HTTP_ORIGIN'] ?? '';
    $allowed = nivas_config()['allowed_origins'];
    if ($origin !== '' && in_array($origin, $allowed, true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
    }
    header('Access-Control-Allow-Headers: Content-Type');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');

    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== $method) {
        nivas_fail(405, 'Method not allowed.');
    }
    if ($method !== 'POST') {
        return [];
    }
    $raw  = file_get_contents('php://input') ?: '';
    $body = json_decode($raw, true);
    return is_array($body) ? $body : [];
}

function nivas_send(array $payload, int $status = 200)
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function nivas_fail(int $status, string $message)
{
    nivas_send(['ok' => false, 'error' => $message], $status);
}

/* ── Validation ─────────────────────────────────────────────────────────── */

function nivas_str(array $body, string $key, int $max, bool $required = false): string
{
    $value = trim((string) ($body[$key] ?? ''));
    if ($value === '' && $required) {
        nivas_fail(422, "Missing field: {$key}.");
    }
    if (mb_strlen($value) > $max) {
        $value = mb_substr($value, 0, $max);
    }
    return $value;
}

function nivas_hostel(?string $name): string
{
    return in_array($name, NIVAS_HOSTELS, true) ? (string) $name : '';
}

/**
 * Rooms are three digits: floor 1-9, then 01-30. Returns '' when invalid, so
 * a bad room can never reach the database.
 */
function nivas_room(?string $value): string
{
    $digits = preg_replace('/\D/', '', (string) $value) ?? '';
    if (!preg_match('/^\d{3}$/', $digits)) {
        return '';
    }
    $floor = (int) $digits[0];
    $index = (int) substr($digits, 1);
    if ($floor < 1 || $floor > NIVAS_FLOOR_COUNT) return '';
    if ($index < 1 || $index > NIVAS_ROOMS_PER_FLOOR) return '';
    return $digits;
}

function nivas_email(string $value): string
{
    $value = strtolower(trim($value));
    if (!filter_var($value, FILTER_VALIDATE_EMAIL)) {
        return '';
    }
    $domain = nivas_config()['email_domain'];
    if ($domain !== '' && !str_ends_with($value, '@' . $domain)) {
        return '';
    }
    return $value;
}

/** Digits only, so a stored number is always dialable. */
function nivas_phone(string $value): string
{
    $digits = preg_replace('/[^\d+]/', '', $value) ?? '';
    return mb_strlen($digits) >= 8 && mb_strlen($digits) <= 20 ? $digits : '';
}

/* ── Identity ───────────────────────────────────────────────────────────── */

function nivas_hash(string $token): string
{
    return hash('sha256', $token);
}

/** Resolves the caller's owner row from the token they hold, or null. */
function nivas_owner(array $body): ?array
{
    $token = nivas_str($body, 'ownerToken', 128);
    if ($token === '') {
        return null;
    }
    $statement = nivas_db()->prepare('SELECT * FROM nivas_owners WHERE token_hash = ? LIMIT 1');
    $statement->execute([nivas_hash($token)]);
    $owner = $statement->fetch();
    if ($owner) {
        nivas_db()->prepare('UPDATE nivas_owners SET last_seen_at = NOW() WHERE id = ?')
            ->execute([$owner['id']]);
    }
    return $owner ?: null;
}

/* ── Throttle ───────────────────────────────────────────────────────────── */

/** Allows $limit events per $seconds for a bucket; exits 429 beyond that. */
function nivas_throttle(string $bucket, int $limit, int $seconds): void
{
    $db = nivas_db();
    $db->prepare('DELETE FROM nivas_rate WHERE created_at < (NOW() - INTERVAL 1 DAY)')->execute();

    $key   = $bucket . ':' . ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    $seconds = max(1, (int) $seconds);   // inlined below: never user input
    $count = $db->prepare("SELECT COUNT(*) FROM nivas_rate WHERE bucket = ? AND created_at > (NOW() - INTERVAL {$seconds} SECOND)");
    $count->execute([$key]);
    if ((int) $count->fetchColumn() >= $limit) {
        nivas_fail(429, 'Too many attempts. Wait a few minutes and try again.');
    }
    $db->prepare('INSERT INTO nivas_rate (bucket) VALUES (?)')->execute([$key]);
}

/* ── Mail ───────────────────────────────────────────────────────────────── */

function nivas_mail(string $to, string $subject, string $body): bool
{
    $config = nivas_config();
    // Fail loudly rather than sending "From:  <>", which silently gets dropped
    // by most providers and looks like a mail-delivery problem instead of a
    // missing config key. Both keys are in config.example.php.
    if (empty($config['mail_from']) || empty($config['mail_from_name'])) {
        error_log('Nivas: mail_from / mail_from_name missing from config.php — cannot send verification codes');
        return false;
    }
    $from    = $config['mail_from'];
    $name    = $config['mail_from_name'];
    $headers = implode("\r\n", [
        'From: ' . $name . ' <' . $from . '>',
        'Reply-To: ' . $from,
        'Content-Type: text/plain; charset=utf-8',
        'MIME-Version: 1.0',
    ]);
    return @mail($to, $subject, $body, $headers);
}
