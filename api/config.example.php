<?php
/**
 * Copy this file to config.php on the server and fill it in.
 * config.php is gitignored — never commit real credentials.
 *
 * Hostinger: hPanel → Databases → MySQL Databases gives you all four values.
 * The host is almost always 'localhost' on shared hosting.
 */

return [
    'db' => [
        'host' => 'localhost',
        'name' => 'uXXXXXX_nivas',
        'user' => 'uXXXXXX_nivas',
        'pass' => 'CHANGE_ME',
    ],

    // Only these origins may call the API from a browser. Add your live domain
    // and keep the localhost entry for testing.
    'allowed_origins' => [
        'https://nivas.example.com',
        'http://localhost:8137',
    ],

    // Listings may only be created by addresses matching this. Set to '' to
    // allow any address (not recommended — it removes the only identity check).
    'email_domain' => 'iith.ac.in',

    // Sender for verification-code emails. REQUIRED whenever
    // require_verification is true — nivas_mail() reads both keys, and without
    // them no code can be sent, which means nobody can publish a listing at all.
    // Use a real mailbox on your own domain; Hostinger's mail() is rejected by
    // most providers when the From address doesn't match the sending host.
    'mail_from'      => 'nivas@example.com',
    'mail_from_name' => 'Nivas',

    // false = anyone who submits the form is published immediately.
    // true  = the address must enter a code mailed to it first. Keep this on:
    //         it is what stops a student publishing someone else's phone number.
    'require_verification' => true,
];
