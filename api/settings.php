<?php
// Site settings (super admin) and the activity log (admin+).
//
//   GET  ?action=get                     admin+
//   POST ?action=save                    superadmin   {pass_threshold, portal_title}
//   GET  ?action=audit&limit=            admin+

declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

$action = (string)q('action', '');

switch ($action) {
    case 'get':
        require_role('admin');
        respond(['settings' => public_settings()]);

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
        audit((int)$actor['id'], 'settings.save', '', public_settings());
        respond(['settings' => public_settings()]);

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
