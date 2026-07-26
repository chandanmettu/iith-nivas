<?php
/**
 * Email ownership check.
 *
 *   POST { step: "request", email }        -> mails a 6-digit code
 *   POST { step: "confirm", email, code }  -> returns { ownerToken }
 *
 * This is the only identity in the system. It does not prove the person lives
 * in the room they claim — it proves they can receive mail at an institute
 * address, so a listing (and any phone number on it) is traceable to a real
 * account rather than anonymous. Without it, anybody could publish anybody's
 * number. Do not disable it for a public launch.
 */

declare(strict_types=1);
require __DIR__ . '/db.php';

$body = nivas_begin('POST');
$step = nivas_str($body, 'step', 16, true);
$db   = nivas_db();

if ($step === 'request') {
    nivas_throttle('code', 5, 900);   // 5 codes per IP per 15 minutes

    $email = nivas_email(nivas_str($body, 'email', 190, true));
    if ($email === '') {
        $domain = nivas_config()['email_domain'];
        nivas_fail(422, $domain === ''
            ? 'That email address is not valid.'
            : "Use your @{$domain} address.");
    }

    $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    $db->prepare('DELETE FROM nivas_codes WHERE email = ?')->execute([$email]);
    $db->prepare('INSERT INTO nivas_codes (email, code_hash, expires_at) VALUES (?, ?, (NOW() + INTERVAL 15 MINUTE))')
        ->execute([$email, nivas_hash($code)]);

    $sent = nivas_mail(
        $email,
        'Your Nivas code: ' . $code,
        "Your Nivas verification code is {$code}\n\n"
        . "It expires in 15 minutes. If you didn't ask for this, ignore this email — "
        . "nothing has been published in your name.\n"
    );
    if (!$sent) {
        error_log('Nivas: mail() failed for ' . $email);
        nivas_fail(500, 'Could not send the code. Try again in a minute.');
    }
    nivas_send(['ok' => true, 'sent' => true]);
}

if ($step === 'confirm') {
    nivas_throttle('confirm', 12, 900);

    $email = nivas_email(nivas_str($body, 'email', 190, true));
    $code  = preg_replace('/\D/', '', nivas_str($body, 'code', 8, true)) ?? '';
    if ($email === '' || $code === '') {
        nivas_fail(422, 'Enter the six-digit code we emailed you.');
    }

    $statement = $db->prepare('SELECT * FROM nivas_codes WHERE email = ? ORDER BY id DESC LIMIT 1');
    $statement->execute([$email]);
    $row = $statement->fetch();

    if (!$row || strtotime((string) $row['expires_at']) < time()) {
        nivas_fail(410, 'That code has expired. Ask for a new one.');
    }
    if ((int) $row['attempts'] >= 5) {
        nivas_fail(429, 'Too many wrong tries. Ask for a new code.');
    }
    if (!hash_equals((string) $row['code_hash'], nivas_hash($code))) {
        $db->prepare('UPDATE nivas_codes SET attempts = attempts + 1 WHERE id = ?')->execute([$row['id']]);
        nivas_fail(401, 'That code is not right.');
    }

    $db->prepare('DELETE FROM nivas_codes WHERE email = ?')->execute([$email]);

    // Issue (or rotate) the long-lived token this browser will send with writes.
    $token = bin2hex(random_bytes(32));
    $db->prepare(
        'INSERT INTO nivas_owners (email, token_hash) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE token_hash = VALUES(token_hash), last_seen_at = NOW()'
    )->execute([$email, nivas_hash($token)]);

    nivas_send(['ok' => true, 'ownerToken' => $token, 'email' => $email]);
}

nivas_fail(422, 'Unknown step.');
