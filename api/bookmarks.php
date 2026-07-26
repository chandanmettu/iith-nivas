<?php
/**
 * POST { deviceToken }                              -> this device's bookmarks
 * POST { deviceToken, hostel, room, on, name? }      -> add / remove one
 *
 * Bookmarks are keyed by an anonymous device token, not by an owner, so a
 * student can save rooms before verifying an email. The name is only
 * collected because the waitlist feature shows it — first come, first
 * served — to whoever else is looking at that same room; it is not required
 * for a bookmark to work as a private save.
 */

declare(strict_types=1);
require __DIR__ . '/db.php';

$body = nivas_begin('POST');
$db   = nivas_db();

$device = nivas_str($body, 'deviceToken', 128, true);
if (mb_strlen($device) < 16) {
    nivas_fail(422, 'Bad device token.');
}
$deviceHash = nivas_hash($device);

$hostel = nivas_hostel(nivas_str($body, 'hostel', 64));
$room   = nivas_room(nivas_str($body, 'room', 8));

// A hostel+room in the body means "toggle this one"; otherwise it's a read.
if ($hostel !== '' && $room !== '') {
    nivas_throttle('bookmark', 120, 3600);

    if (!empty($body['on'])) {
        $name = nivas_str($body, 'name', 64);
        $db->prepare('INSERT INTO nivas_bookmarks (device_token, hostel, room, name) VALUES (?, ?, ?, ?)
                      ON DUPLICATE KEY UPDATE name = VALUES(name)')
            ->execute([$deviceHash, $hostel, $room, $name]);
    } else {
        $db->prepare('DELETE FROM nivas_bookmarks WHERE device_token = ? AND hostel = ? AND room = ?')
            ->execute([$deviceHash, $hostel, $room]);
    }
}

$mine = $db->prepare('SELECT hostel, room FROM nivas_bookmarks WHERE device_token = ? ORDER BY created_at DESC');
$mine->execute([$deviceHash]);

$counts   = [];
$waitlist = [];
$rows = $db->query(
    'SELECT hostel, room, name FROM nivas_bookmarks ORDER BY created_at ASC'
)->fetchAll();
foreach ($rows as $row) {
    $key = $row['hostel'] . '-' . $row['room'];
    $counts[$key] = ($counts[$key] ?? 0) + 1;
    $waitlist[$key][] = $row['name'] !== '' ? $row['name'] : 'A student';
}

nivas_send([
    'ok'        => true,
    'bookmarks' => $mine->fetchAll(),
    'counts'    => $counts,
    'waitlist'  => $waitlist,
]);
