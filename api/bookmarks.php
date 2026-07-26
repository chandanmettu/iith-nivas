<?php
/**
 * POST { deviceToken }                        -> this device's bookmarks
 * POST { deviceToken, hostel, room, on }      -> add / remove one
 *
 * Bookmarks are keyed by an anonymous device token, not by an owner, so a
 * student can save rooms before verifying an email. Nothing personal is stored
 * against them, and the public counts are aggregate only.
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
        $db->prepare('INSERT IGNORE INTO nivas_bookmarks (device_token, hostel, room) VALUES (?, ?, ?)')
            ->execute([$deviceHash, $hostel, $room]);
    } else {
        $db->prepare('DELETE FROM nivas_bookmarks WHERE device_token = ? AND hostel = ? AND room = ?')
            ->execute([$deviceHash, $hostel, $room]);
    }
}

$mine = $db->prepare('SELECT hostel, room FROM nivas_bookmarks WHERE device_token = ? ORDER BY created_at DESC');
$mine->execute([$deviceHash]);

$counts = [];
foreach ($db->query('SELECT hostel, room, COUNT(*) AS total FROM nivas_bookmarks GROUP BY hostel, room')->fetchAll() as $row) {
    $counts[$row['hostel'] . '-' . $row['room']] = (int) $row['total'];
}

nivas_send([
    'ok'        => true,
    'bookmarks' => $mine->fetchAll(),
    'counts'    => $counts,
]);
