<?php
// User directory: list/search, create, edit, passwords, delete, CSV import/export.
//
//   GET  ?action=list&q=&group=&role=      trainer+
//   GET  ?action=get&id=                   trainer+   (includes completions)
//   GET  ?action=groups                    trainer+
//   GET  ?action=export                    admin+     (CSV download)
//   POST ?action=create                    admin+
//   POST ?action=update                    admin+
//   POST ?action=set_password              admin+     {id, password | clear:true, require_change}
//   POST ?action=delete                    admin+
//   POST ?action=import                    admin+     {rows:[...], mode:'upsert'|'skip'}

declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

$action = (string)q('action', '');

const USER_FIELDS = ['first_name', 'last_name', 'group_name', 'phone', 'address', 'city', 'state', 'zip', 'notes'];
const USER_LIMITS = ['first_name' => 80, 'last_name' => 80, 'group_name' => 120, 'phone' => 40, 'address' => 200, 'city' => 100, 'state' => 60, 'zip' => 20, 'notes' => 2000];

function clean_fields(array $d, array $fallback = []): array
{
    $out = [];
    foreach (USER_FIELDS as $f) {
        $v = array_key_exists($f, $d) ? in_str($d, $f) : ($fallback[$f] ?? '');
        $out[$f] = mb_substr($v, 0, USER_LIMITS[$f]);
    }
    return $out;
}

function completions_of(int $userId): array
{
    $st = db()->prepare('SELECT c.course_id, c.score, c.total, c.passed_at, c.method, c.note, c.granted_by, g.first_name AS g_first, g.last_name AS g_last, g.email AS g_email
        FROM completions c LEFT JOIN users g ON g.id = c.granted_by WHERE c.user_id = ? ORDER BY c.passed_at DESC');
    $st->execute([$userId]);
    $out = [];
    foreach ($st->fetchAll() as $r) {
        $out[] = [
            'course_id' => $r['course_id'],
            'score' => $r['score'] === null ? null : (int)$r['score'],
            'total' => $r['total'] === null ? null : (int)$r['total'],
            'passed_at' => $r['passed_at'],
            'method' => $r['method'],
            'note' => $r['note'],
            'granted_by' => $r['granted_by'] ? trim(($r['g_first'] ?? '') . ' ' . ($r['g_last'] ?? '')) ?: $r['g_email'] : null,
        ];
    }
    return $out;
}

function target_user_or_fail(array $actor, int $id): array
{
    $t = fetch_user($id);
    if (!$t) fail('User not found', 404);
    if (!can_manage($actor, $t['role'])) fail('You cannot manage a ' . $t['role'] . ' account', 403);
    return $t;
}

switch ($action) {
    case 'list':
        require_role('trainer');
        $qs = mb_strtolower(trim((string)q('q', '')));
        $group = trim((string)q('group', ''));
        $role = trim((string)q('role', ''));
        $sql = 'SELECT u.*, (SELECT COUNT(*) FROM completions c WHERE c.user_id = u.id) AS completed_count FROM users u WHERE 1=1';
        $args = [];
        if ($qs !== '') {
            $sql .= " AND (LOWER(u.first_name || ' ' || u.last_name) LIKE ? OR LOWER(u.email) LIKE ? OR LOWER(u.group_name) LIKE ? OR u.phone LIKE ?)";
            $like = '%' . $qs . '%';
            array_push($args, $like, $like, $like, $like);
        }
        if ($group !== '') { $sql .= ' AND u.group_name = ?'; $args[] = $group; }
        if ($role !== '' && in_array($role, ROLES, true)) { $sql .= ' AND u.role = ?'; $args[] = $role; }
        $sql .= ' ORDER BY LOWER(u.last_name), LOWER(u.first_name), u.email LIMIT 5000';
        $st = db()->prepare($sql);
        $st->execute($args);
        $users = [];
        foreach ($st->fetchAll() as $r) {
            $p = user_public($r);
            $p['completed_count'] = (int)$r['completed_count'];
            $users[] = $p;
        }
        $groups = db()->query("SELECT group_name, COUNT(*) AS n FROM users WHERE group_name <> '' GROUP BY group_name ORDER BY LOWER(group_name)")->fetchAll();
        respond(['users' => $users, 'groups' => $groups, 'course_count' => count(course_map())]);

    case 'groups':
        require_role('trainer');
        $groups = db()->query("SELECT group_name, COUNT(*) AS n FROM users WHERE group_name <> '' GROUP BY group_name ORDER BY LOWER(group_name)")->fetchAll();
        respond(['groups' => $groups]);

    case 'get':
        require_role('trainer');
        $id = (int)q('id', 0);
        $u = fetch_user($id);
        if (!$u) fail('User not found', 404);
        respond(['user' => user_public($u), 'completions' => completions_of($id)]);

    case 'export':
        $actor = require_role('admin');
        $rows = db()->query('SELECT * FROM users ORDER BY LOWER(last_name), LOWER(first_name)')->fetchAll();
        $completions = [];
        foreach (db()->query('SELECT user_id, course_id FROM completions')->fetchAll() as $c) {
            $completions[(int)$c['user_id']][] = $c['course_id'];
        }
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="portal-users-' . gmdate('Y-m-d') . '.csv"');
        $out = fopen('php://output', 'w');
        fputcsv($out, ['first_name', 'last_name', 'email', 'group', 'phone', 'address', 'city', 'state', 'zip', 'role', 'has_password', 'completed', 'last_login']);
        foreach ($rows as $r) {
            fputcsv($out, [
                $r['first_name'], $r['last_name'], $r['email'], $r['group_name'], $r['phone'], $r['address'], $r['city'], $r['state'], $r['zip'], $r['role'],
                empty($r['password_hash']) ? 'no' : 'yes',
                implode('|', $completions[(int)$r['id']] ?? []),
                $r['last_login_at'] ?? '',
            ]);
        }
        fclose($out);
        audit((int)$actor['id'], 'users.export', '', count($rows) . ' rows');
        exit;

    case 'create':
        require_post();
        $actor = require_role('admin');
        require_csrf();
        $d = input();
        $email = normalize_email(in_str($d, 'email'));
        if (!valid_email($email)) fail('Enter a valid email address.');
        if (fetch_user_by_email($email)) fail('A user with that email already exists.', 409, ['code' => 'duplicate']);
        $role = in_str($d, 'role', 'student');
        if (!in_array($role, assignable_roles($actor), true)) fail('You cannot assign the role "' . $role . '".', 403);
        $fields = clean_fields($d);
        $password = (string)($d['password'] ?? '');
        $hash = null;
        if ($password !== '') {
            $problem = password_problem($password);
            if ($problem) fail($problem);
            $hash = password_hash($password, PASSWORD_DEFAULT);
        }
        $requireChange = in_bool($d, 'require_change', false) && $hash !== null;
        $ts = now();
        $st = db()->prepare('INSERT INTO users (email, first_name, last_name, group_name, phone, address, city, state, zip, notes, role, password_hash, must_change_password, active, created_at, updated_at, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)');
        $st->execute([$email, $fields['first_name'], $fields['last_name'], $fields['group_name'], $fields['phone'], $fields['address'], $fields['city'], $fields['state'], $fields['zip'], $fields['notes'],
            $role, $hash, $requireChange ? 1 : 0, $ts, $ts, $actor['id']]);
        $id = (int)db()->lastInsertId();
        audit((int)$actor['id'], 'users.create', $email, ['role' => $role, 'passwordless' => $hash === null]);
        respond(['user' => user_public(fetch_user($id))], 201);

    case 'update':
        require_post();
        $actor = require_role('admin');
        require_csrf();
        $d = input();
        $id = in_int($d, 'id', 0);
        $t = target_user_or_fail($actor, (int)$id);
        $fields = clean_fields($d, $t);
        $email = array_key_exists('email', $d) ? normalize_email(in_str($d, 'email')) : $t['email'];
        if (!valid_email($email)) fail('Enter a valid email address.');
        if ($email !== $t['email']) {
            $other = fetch_user_by_email($email);
            if ($other && (int)$other['id'] !== (int)$t['id']) fail('Another user already has that email.', 409, ['code' => 'duplicate']);
        }
        $role = array_key_exists('role', $d) ? in_str($d, 'role', $t['role']) : $t['role'];
        if ($role !== $t['role']) {
            if ((int)$t['id'] === (int)$actor['id']) fail('You cannot change your own role.', 403);
            if (!in_array($role, assignable_roles($actor), true)) fail('You cannot assign the role "' . $role . '".', 403);
        }
        $active = array_key_exists('active', $d) ? in_bool($d, 'active', true) : ((int)$t['active'] === 1);
        if (!$active && (int)$t['id'] === (int)$actor['id']) fail('You cannot deactivate your own account.', 403);
        db()->prepare('UPDATE users SET email = ?, first_name = ?, last_name = ?, group_name = ?, phone = ?, address = ?, city = ?, state = ?, zip = ?, notes = ?, role = ?, active = ?, updated_at = ? WHERE id = ?')
            ->execute([$email, $fields['first_name'], $fields['last_name'], $fields['group_name'], $fields['phone'], $fields['address'], $fields['city'], $fields['state'], $fields['zip'], $fields['notes'],
                $role, $active ? 1 : 0, now(), $t['id']]);
        audit((int)$actor['id'], 'users.update', $email, ['id' => (int)$t['id'], 'role' => $role, 'active' => $active]);
        respond(['user' => user_public(fetch_user((int)$t['id']))]);

    case 'set_password':
        require_post();
        $actor = require_role('admin');
        require_csrf();
        $d = input();
        $t = target_user_or_fail($actor, (int)in_int($d, 'id', 0));
        if (in_bool($d, 'clear', false)) {
            if ((int)$t['id'] === (int)$actor['id']) fail('You cannot remove your own password.', 403);
            db()->prepare('UPDATE users SET password_hash = NULL, must_change_password = 0, updated_at = ? WHERE id = ?')->execute([now(), $t['id']]);
            audit((int)$actor['id'], 'users.clear_password', $t['email']);
            respond(['user' => user_public(fetch_user((int)$t['id']))]);
        }
        $password = (string)($d['password'] ?? '');
        $problem = password_problem($password);
        if ($problem) fail($problem);
        $requireChange = in_bool($d, 'require_change', true);
        db()->prepare('UPDATE users SET password_hash = ?, must_change_password = ?, updated_at = ? WHERE id = ?')
            ->execute([password_hash($password, PASSWORD_DEFAULT), $requireChange ? 1 : 0, now(), $t['id']]);
        audit((int)$actor['id'], 'users.set_password', $t['email'], ['require_change' => $requireChange]);
        respond(['user' => user_public(fetch_user((int)$t['id']))]);

    case 'delete':
        require_post();
        $actor = require_role('admin');
        require_csrf();
        $d = input();
        $t = target_user_or_fail($actor, (int)in_int($d, 'id', 0));
        if ((int)$t['id'] === (int)$actor['id']) fail('You cannot delete your own account.', 403);
        db()->prepare('DELETE FROM users WHERE id = ?')->execute([$t['id']]);
        audit((int)$actor['id'], 'users.delete', $t['email'], ['id' => (int)$t['id'], 'role' => $t['role']]);
        respond(['status' => 'ok']);

    case 'import':
        require_post();
        $actor = require_role('admin');
        require_csrf();
        $d = input();
        $rows = $d['rows'] ?? null;
        if (!is_array($rows) || count($rows) === 0) fail('No rows to import.');
        if (count($rows) > 5000) fail('Import at most 5000 rows at a time.');
        $mode = in_str($d, 'mode', 'upsert') === 'skip' ? 'skip' : 'upsert';
        $assignable = assignable_roles($actor);
        $pdo = db();
        $created = 0; $updated = 0; $skipped = 0; $errors = []; $completionsAdded = 0;
        $pdo->beginTransaction();
        try {
            foreach ($rows as $i => $row) {
                $line = $i + 1;
                if (!is_array($row)) { $errors[] = "Row $line: malformed"; continue; }
                $email = normalize_email(in_str($row, 'email'));
                if (!valid_email($email)) { $errors[] = "Row $line: invalid email \"$email\""; continue; }
                $fields = clean_fields($row);
                $role = in_str($row, 'role', 'student');
                $role = strtolower(str_replace([' ', '-', '_'], '', $role));
                if ($role === 'super' || $role === 'superadministrator') $role = 'superadmin';
                if ($role === 'administrator') $role = 'admin';
                if (!in_array($role, ROLES, true)) $role = 'student';
                $existing = fetch_user_by_email($email);
                if ($existing) {
                    if ($mode === 'skip') { $skipped++; continue; }
                    if (!can_manage($actor, $existing['role'])) { $errors[] = "Row $line: cannot modify {$existing['role']} $email"; continue; }
                    $newRole = in_array($role, $assignable, true) && array_key_exists('role', $row) && in_str($row, 'role') !== '' ? $role : $existing['role'];
                    if ((int)$existing['id'] === (int)$actor['id']) $newRole = $existing['role'];
                    $merged = [];
                    foreach (USER_FIELDS as $f) $merged[$f] = (array_key_exists($f, $row) && in_str($row, $f) !== '') ? $fields[$f] : $existing[$f];
                    $pdo->prepare('UPDATE users SET first_name = ?, last_name = ?, group_name = ?, phone = ?, address = ?, city = ?, state = ?, zip = ?, notes = ?, role = ?, updated_at = ? WHERE id = ?')
                        ->execute([$merged['first_name'], $merged['last_name'], $merged['group_name'], $merged['phone'], $merged['address'], $merged['city'], $merged['state'], $merged['zip'], $merged['notes'], $newRole, now(), $existing['id']]);
                    $uid = (int)$existing['id'];
                    $updated++;
                } else {
                    if (!in_array($role, $assignable, true)) $role = 'student';
                    $password = (string)($row['password'] ?? '');
                    $hash = null;
                    if ($password !== '') {
                        if (password_problem($password)) { $errors[] = "Row $line: password too short for $email (min " . MIN_PASSWORD_LENGTH . "), created without one"; }
                        else $hash = password_hash($password, PASSWORD_DEFAULT);
                    }
                    $ts = now();
                    $pdo->prepare('INSERT INTO users (email, first_name, last_name, group_name, phone, address, city, state, zip, notes, role, password_hash, must_change_password, active, created_at, updated_at, created_by)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)')
                        ->execute([$email, $fields['first_name'], $fields['last_name'], $fields['group_name'], $fields['phone'], $fields['address'], $fields['city'], $fields['state'], $fields['zip'], $fields['notes'],
                            $role, $hash, $hash ? 1 : 0, $ts, $ts, $actor['id']]);
                    $uid = (int)$pdo->lastInsertId();
                    $created++;
                }
                // Optional "completed" column: course ids or titles separated by | ; ,
                $completed = $row['completed'] ?? '';
                $list = is_array($completed) ? $completed : preg_split('/[|;,]/', (string)$completed);
                foreach ($list as $item) {
                    $cid = resolve_course_id((string)$item);
                    if ($cid === null) { if (trim((string)$item) !== '') $errors[] = "Row $line: unknown course \"" . trim((string)$item) . '"'; continue; }
                    $pdo->prepare("INSERT OR IGNORE INTO completions (user_id, course_id, score, total, passed_at, method, granted_by, note) VALUES (?, ?, NULL, NULL, ?, 'import', ?, '')")
                        ->execute([$uid, $cid, now(), $actor['id']]);
                    $completionsAdded += (int)$pdo->query('SELECT changes()')->fetchColumn();
                }
            }
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
        audit((int)$actor['id'], 'users.import', '', ['created' => $created, 'updated' => $updated, 'skipped' => $skipped, 'errors' => count($errors)]);
        respond(['created' => $created, 'updated' => $updated, 'skipped' => $skipped, 'completions_added' => $completionsAdded, 'errors' => array_slice($errors, 0, 200)]);

    default:
        fail('Unknown action', 404);
}
