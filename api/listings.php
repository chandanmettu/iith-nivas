<?php
/**
 * GET  ?since=…            -> every published listing (contact only when shared)
 * POST { ownerToken, … }   -> create or update the caller's listing
 * POST { ownerToken, delete: true } -> remove it
 *
 * PRIVACY RULE, load-bearing: the SELECT below never reads the email column,
 * and name/phone are only copied into the response when share_contact = 1.
 * If you add a field here, decide which side of that line it sits on.
 */

declare(strict_types=1);
require __DIR__ . '/db.php';

$method = ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST' ? 'POST' : 'GET';
$body   = nivas_begin($method);
$db     = nivas_db();

/* ── Read ───────────────────────────────────────────────────────────────── */

if ($method === 'GET') {
    $rows = $db->query(
        'SELECT l.id, l.hostel, l.room, l.display_name, l.phone, l.share_contact,
                l.willing_to_move, l.note, l.updated_at
           FROM nivas_listings l
          ORDER BY l.updated_at DESC'
    )->fetchAll();

    $preferences = [];
    foreach ($db->query('SELECT listing_id, rank_order, hostel, pod, floor FROM nivas_preferences ORDER BY rank_order')->fetchAll() as $pref) {
        $preferences[(int) $pref['listing_id']][] = [
            'hostel' => $pref['hostel'],
            'pod'    => $pref['pod'] === null ? null : (int) $pref['pod'],
            'floor'  => $pref['floor'] === null ? null : (int) $pref['floor'],
        ];
    }

    $counts = [];
    foreach ($db->query('SELECT hostel, room, COUNT(*) AS total FROM nivas_bookmarks GROUP BY hostel, room')->fetchAll() as $count) {
        $counts[$count['hostel'] . '-' . $count['room']] = (int) $count['total'];
    }

    $listings = [];
    foreach ($rows as $row) {
        $shared   = (int) $row['share_contact'] === 1;
        $listings[] = [
            'id'            => (string) $row['id'],
            'hostel'        => $row['hostel'],
            'room'          => $row['room'],
            'willingToMove' => (int) $row['willing_to_move'] === 1,
            'note'          => $row['note'],
            'preferences'   => $preferences[(int) $row['id']] ?? [],
            'shareContact'  => $shared,
            // Only present when the student ticked the box.
            'name'          => $shared ? $row['display_name'] : null,
            'phone'         => $shared ? $row['phone'] : null,
            'updatedAt'     => $row['updated_at'],
        ];
    }

    nivas_send(['ok' => true, 'listings' => $listings, 'bookmarkCounts' => $counts]);
}

/* ── Write ──────────────────────────────────────────────────────────────── */

$owner = nivas_owner($body);
if (!$owner && nivas_config()['require_verification']) {
    nivas_fail(401, 'Verify your email before publishing a listing.');
}
if (!$owner) {
    // Verification switched off: fall back to a bare email row so writes still
    // have a stable owner. Only sane for a closed test.
    $email = nivas_email(nivas_str($body, 'email', 190, true));
    if ($email === '') {
        nivas_fail(422, 'A valid institute email is required.');
    }
    $db->prepare('INSERT IGNORE INTO nivas_owners (email, token_hash) VALUES (?, ?)')
        ->execute([$email, nivas_hash(bin2hex(random_bytes(16)))]);
    $statement = $db->prepare('SELECT * FROM nivas_owners WHERE email = ? LIMIT 1');
    $statement->execute([$email]);
    $owner = $statement->fetch();
}

if (!empty($body['delete'])) {
    $db->prepare('DELETE FROM nivas_listings WHERE owner_id = ?')->execute([$owner['id']]);
    nivas_send(['ok' => true, 'deleted' => true]);
}

nivas_throttle('listing', 20, 3600);

$hostel = nivas_hostel(nivas_str($body, 'hostel', 64, true));
$room   = nivas_room(nivas_str($body, 'room', 8, true));
$name   = nivas_str($body, 'name', 64, true);
if ($hostel === '') nivas_fail(422, 'Pick a hostel from the list.');
if ($room === '')   nivas_fail(422, 'Use a room number like 912 — floor 1-9, room 01-30.');

$share = !empty($body['shareContact']);
$phone = nivas_phone(nivas_str($body, 'phone', 24));
if ($share && $phone === '') {
    nivas_fail(422, 'Add a working phone number, or turn off sharing your contact.');
}

// One listing per room: refuse if somebody else already holds it.
$claim = $db->prepare('SELECT owner_id FROM nivas_listings WHERE hostel = ? AND room = ? LIMIT 1');
$claim->execute([$hostel, $room]);
$existing = $claim->fetch();
if ($existing && (int) $existing['owner_id'] !== (int) $owner['id']) {
    nivas_fail(409, 'Someone has already listed that room. If it is yours, use the feature-request form and we will sort it out.');
}

$db->beginTransaction();
try {
    // A student holds one listing; moving room updates the same row.
    $db->prepare('DELETE FROM nivas_listings WHERE owner_id = ?')->execute([$owner['id']]);
    $db->prepare(
        'INSERT INTO nivas_listings
            (owner_id, hostel, room, display_name, phone, share_contact, willing_to_move, note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )->execute([
        $owner['id'], $hostel, $room, $name, $phone,
        $share ? 1 : 0,
        !empty($body['willingToMove']) ? 1 : 0,
        nivas_str($body, 'note', 280),
    ]);
    $listingId = (int) $db->lastInsertId();

    $preferences = is_array($body['preferences'] ?? null) ? array_slice($body['preferences'], 0, 3) : [];
    $insert = $db->prepare('INSERT INTO nivas_preferences (listing_id, rank_order, hostel, pod, floor) VALUES (?, ?, ?, ?, ?)');
    $rank = 0;
    foreach ($preferences as $preference) {
        $prefHostel = nivas_hostel(is_array($preference) ? ($preference['hostel'] ?? '') : '');
        if ($prefHostel === '') continue;
        $pod   = isset($preference['pod']) ? (int) $preference['pod'] : 0;
        $floor = isset($preference['floor']) ? (int) $preference['floor'] : 0;
        $insert->execute([
            $listingId, ++$rank, $prefHostel,
            ($pod >= 1 && $pod <= 4) ? $pod : null,
            ($floor >= 1 && $floor <= NIVAS_FLOOR_COUNT) ? $floor : null,
        ]);
    }
    $db->commit();
} catch (Throwable $e) {
    $db->rollBack();
    error_log('Nivas listing write failed: ' . $e->getMessage());
    nivas_fail(500, 'Could not save that. Try again.');
}

nivas_send(['ok' => true, 'saved' => true]);
