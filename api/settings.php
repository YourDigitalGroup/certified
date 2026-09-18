<?php
// Site settings (super admin), email (Mailgun) settings and the activity log (admin+).
//
//   GET  ?action=get                     admin+       settings; super admins also get the email settings (key masked)
//   POST ?action=save                    superadmin   {pass_threshold?, portal_title?, mail_domain?, mail_region?, mail_api_key?,
//                                                      mail_clear_key?, mail_from_name?, mail_from_email?, mail_reply_to?, mail_site_url?}
//   POST ?action=test_mail               superadmin   {to?}   send a test email (defaults to your own address)
//   GET  ?action=audit&limit=            admin+

declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

$action = (string)q('action', '');

switch ($action) {
    case 'get':
        $u = require_role('admin');
        respond([
            'settings' => public_settings(),
            'mail' => $u['role'] === 'superadmin' ? mail_admin_view() : ['configured' => mail_configured()],
        ]);

    case 'save':
        require_post();
        $actor = require_role('superadmin');
        require_csrf();
        $d = input();
        if (array_key_exists('pass_threshold', $d)) {
            $t = in_int($d, 'pass_threshold', 100);
            if ($t === null || $t < 50 || $t > 100) fail('Pass threshold must be between 50 and 100.');
            setting_set('pass_threshold', $t);
        }
        if (array_key_exists('portal_title', $d)) {
            $title = mb_substr(in_str($d, 'portal_title', 'Digital Certification'), 0, 80);
            setting_set('portal_title', $title !== '' ? $title : 'Digital Certification');
        }

        // Email (Mailgun). Each field is optional so the UI can save what changed.
        if (array_key_exists('mail_domain', $d)) {
            $dom = strtolower(trim(in_str($d, 'mail_domain')));
            if ($dom !== '' && !preg_match('/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/', $dom)) fail('Enter the Mailgun sending domain, e.g. mg.yourcompany.com.');
            setting_set('mail_domain', $dom);
        }
        if (array_key_exists('mail_region', $d)) setting_set('mail_region', in_str($d, 'mail_region') === 'eu' ? 'eu' : 'us');
        if (array_key_exists('mail_from_name', $d)) setting_set('mail_from_name', mb_substr(trim(in_str($d, 'mail_from_name')), 0, 80));
        if (array_key_exists('mail_from_email', $d)) {
            $fe = normalize_email(in_str($d, 'mail_from_email'));
            if ($fe !== '' && !valid_email($fe)) fail('Enter a valid From email address.');
            setting_set('mail_from_email', $fe);
        }
        if (array_key_exists('mail_reply_to', $d)) {
            $rt = normalize_email(in_str($d, 'mail_reply_to'));
            if ($rt !== '' && !valid_email($rt)) fail('Enter a valid Reply-To email address, or leave it blank.');
            setting_set('mail_reply_to', $rt);
        }
        if (array_key_exists('mail_site_url', $d)) {
            // Blank pins the address detected from this request, so links never depend on the Host header again.
            $su = trim(in_str($d, 'mail_site_url'));
            if ($su === '') $su = detected_site_url();
            if (!preg_match('~^https?://[^\s/]+(/[^\s]*)?$~i', $su)) fail('The portal address must start with http:// or https://');
            setting_set('mail_site_url', rtrim($su, '/') . '/');
        }
        if (in_bool($d, 'mail_clear_key', false)) {
            setting_set('mail_api_key', '');
        } elseif (array_key_exists('mail_api_key', $d) && trim(in_str($d, 'mail_api_key')) !== '') {
            $k = trim(in_str($d, 'mail_api_key'));
            if (preg_match('/\s/', $k) || strlen($k) < 20 || strlen($k) > 200) fail('That does not look like a Mailgun API key.');
            setting_set('mail_api_key', $k);
        }

        // The audit entry never includes the key.
        audit((int)$actor['id'], 'settings.save', '', array_merge(public_settings(), ['mail' => array_diff_key(mail_admin_view(), ['key_hint' => 1])]));
        respond(['settings' => public_settings(), 'mail' => mail_admin_view()]);

    case 'test_mail':
        require_post();
        $actor = require_role('superadmin');
        require_csrf();
        if (!mail_configured()) fail('Fill in the sending domain, From address and API key first.', 400, ['code' => 'mail_unavailable']);
        $to = normalize_email(in_str(input(), 'to', (string)$actor['email']));
        if (!valid_email($to)) fail('Enter a valid email address to send the test to.');
        $title = (string)setting_get('portal_title', 'Digital Certification');
        $text = "This is a test message from the $title admin panel. If you can read this, Mailgun is set up correctly.\n\nSent " . now() . " for " . site_url();
        $html = mail_layout($title, '<p style="font-size:15px;line-height:1.55;margin:0;white-space:pre-line">' . htmlspecialchars($text, ENT_QUOTES, 'UTF-8') . '</p>');
        $r = mail_send($to, display_name($actor), 'Test email from ' . $title, $text, $html);
        audit((int)$actor['id'], 'settings.test_mail', $to, ['sent' => $r['ok'], 'error' => $r['ok'] ? null : $r['error']]);
        if (!$r['ok']) fail($r['error'], 502, ['code' => 'mail_failed']);
        respond(['status' => 'sent', 'to' => $to]);

    case 'audit':
        require_role('admin');
        $limit = max(1, min(500, (int)q('limit', 100)));
        $st = db()->prepare('SELECT a.id, a.at, a.action, a.target, a.detail, u.first_name, u.last_name, u.email FROM audit_log a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT ?');
        $st->bindValue(1, $limit, PDO::PARAM_INT);
        $st->execute();
        $rows = [];
        foreach ($st->fetchAll() as $r) {
            $rows[] = [
                'id' => (int)$r['id'],
                'at' => $r['at'],
                'action' => $r['action'],
                'target' => $r['target'],
                'detail' => $r['detail'],
                'who' => trim(($r['first_name'] ?? '') . ' ' . ($r['last_name'] ?? '')) ?: ($r['email'] ?? 'system'),
            ];
        }
        respond(['entries' => $rows]);

    default:
        fail('Unknown action', 404);
}
