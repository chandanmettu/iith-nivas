<?php
/**
 * POST { kind, name, email, phone?, hostel?, message }
 * Stores the report. No mailbox is configured, so check nivas_feedback
 * in phpMyAdmin instead of expecting an email.
 */

declare(strict_types=1);
require __DIR__ . '/db.php';

$body = nivas_begin('POST');
nivas_throttle('feedback', 6, 3600);

$kind    = nivas_str($body, 'kind', 32) ?: 'Feature request';
$name    = nivas_str($body, 'name', 64, true);
$email   = trim(nivas_str($body, 'email', 190, true));
$message = nivas_str($body, 'message', 1200, true);
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    nivas_fail(422, 'Give an email we can reply to.');
}

$phone  = nivas_str($body, 'phone', 24);
$hostel = nivas_hostel(nivas_str($body, 'hostel', 64));

nivas_db()->prepare(
    'INSERT INTO nivas_feedback (kind, name, email, phone, hostel, message) VALUES (?, ?, ?, ?, ?, ?)'
)->execute([$kind, $name, $email, $phone, $hostel, $message]);

nivas_send(['ok' => true]);
