<?php
// Groups: the list people can belong to, with membership and progress at a glance.
//
//   GET  ?action=list                    trainer+   groups with counts and progress
//   GET  ?action=get&name=               trainer+   one group + members (same shape as users list)
//   POST ?action=create                  admin+     {name}
//   POST ?action=rename                  admin+     {name, new_name}   (renaming onto an existing group merges into it)
//   POST ?action=delete                  admin+     {name, reassign_to?}  (members move to reassign_to, or lose their group)

declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

$action = (string)q('action', '');

function group_stats(): array
{
    $total = count(course_map());
    $processIds = array_values(array_map(fn($c) => (string)$c['id'], array_filter(course_map(), fn($c) => (int)$c['sectionIndex'] === 0)));
    $processCount = count($processIds);
    $sql = "SELECT g.id, g.name, g.created_at,
        (SELECT COUNT(*) FROM users u WHERE u.group_name = g.name) AS members,
        (SELECT COUNT(*) FROM users u WHERE u.group_name = g.name AND u.role = 'student') AS students,
        (SELECT COUNT(*) FROM users u WHERE u.group_name = g.name AND u.role IN ('trainer','admin','superadmin')) AS staff,
        (SELECT COUNT(*) FROM users u WHERE u.group_name = g.name AND NOT EXISTS (SELECT 1 FROM completions c WHERE c.user_id = u.id)) AS not_started,
        (SELECT COUNT(*) FROM users u WHERE u.group_name = g.name AND (SELECT COUNT(*) FROM completions c WHERE c.user_id = u.id) >= ?) AS certified,
        (SELECT COUNT(*) FROM users u WHERE u.group_name = g.name AND (SELECT COUNT(*) FROM completions c WHERE c.user_id = u.id AND c.course_id IN (" . implode(',', array_fill(0, max(1, $processCount), '?')) . ")) >= ?) AS process_complete,
        (SELECT COALESCE(SUM((SELECT COUNT(*) FROM completions c WHERE c.user_id = u.id)), 0) FROM users u WHERE u.group_name = g.name) AS completions,
        (SELECT MAX(u.last_login_at) FROM users u WHERE u.group_name = g.name) AS last_active
        FROM groups g ORDER BY LOWER(g.name)";
    $st = db()->prepare($sql);
    $st->execute(array_merge([$total], $processIds ?: [''], [$processCount]));
    $out = [];
    foreach ($st->fetchAll() as $r) {
        $members = (int)$r['members'];
        $out[] = [
            'id' => (int)$r['id'],
            'name' => $r['name'],
            'members' => $members,
            'students' => (int)$r['students'],
            'staff' => (int)$r['staff'],
            'not_started' => (int)$r['not_started'],
            'process_complete' => (int)$r['process_complete'],
            'certified' => (int)$r['certified'],
            'avg_pct' => $members && $total ? (int)round(100 * (int)$r['completions'] / ($members * $total)) : 0,
            'last_active' => $r['last_active'],
            'created_at' => $r['created_at'],
        ];
    }
    return $out;
}

switch ($action) {
    case 'list':
        require_role('trainer');
        respond(['groups' => group_stats(), 'course_count' => count(course_map())]);

    case 'get':
        require_role('trainer');
        $g = group_find((string)q('name', ''));
        if (!$g) fail('Group not found', 404);
        $st = db()->prepare('SELECT u.*, (SELECT COUNT(*) FROM completions c WHERE c.user_id = u.id) AS completed_count,
            (SELECT group_concat(c.course_id) FROM completions c WHERE c.user_id = u.id) AS completed_ids
            FROM users u WHERE u.group_name = ? ORDER BY LOWER(u.last_name), LOWER(u.first_name), u.email');
        $st->execute([$g['name']]);
        $members = [];
        foreach ($st->fetchAll() as $r) {
            $p = user_public($r);
            $p['completed_count'] = (int)$r['completed_count'];
            $p['completed_ids'] = $r['completed_ids'] ? explode(',', $r['completed_ids']) : [];
            $members[] = $p;
        }
        $stats = array_values(array_filter(group_stats(), fn($x) => $x['id'] === (int)$g['id']));
        respond(['group' => $stats ? $stats[0] : ['id' => (int)$g['id'], 'name' => $g['name'], 'members' => count($members)], 'members' => $members, 'course_count' => count(course_map())]);

    case 'create':
        require_post();
        $actor = require_role('admin');
        require_csrf();
        $name = trim(preg_replace('/\s+/', ' ', in_str(input(), 'name')));
        if ($name === '' || mb_strlen($name) > 120) fail('Enter a group name (up to 120 characters).');
        if (group_find($name)) fail('That group already exists.', 409, ['code' => 'duplicate']);
        db()->prepare('INSERT INTO groups (name, created_at) VALUES (?, ?)')->execute([$name, now()]);
        audit((int)$actor['id'], 'groups.create', $name);
        respond(['group' => group_find($name)], 201);

    case 'rename':
        require_post();
        $actor = require_role('admin');
        require_csrf();
        $d = input();
        $g = group_find(in_str($d, 'name'));
        if (!$g) fail('Group not found', 404);
        $new = trim(preg_replace('/\s+/', ' ', in_str($d, 'new_name')));
        if ($new === '' || mb_strlen($new) > 120) fail('Enter the new name (up to 120 characters).');
        $target = group_find($new);
        $pdo = db();
        $pdo->beginTransaction();
        try {
            if ($target && (int)$target['id'] !== (int)$g['id']) {
                // Merge: move everyone into the existing group and drop this one.
                $pdo->prepare('UPDATE users SET group_name = ?, updated_at = ? WHERE group_name = ?')->execute([$target['name'], now(), $g['name']]);
                $pdo->prepare('DELETE FROM groups WHERE id = ?')->execute([$g['id']]);
                $pdo->commit();
                audit((int)$actor['id'], 'groups.merge', $g['name'], ['into' => $target['name']]);
                respond(['group' => group_find($target['name']), 'merged' => true]);
            }
            $pdo->prepare('UPDATE groups SET name = ? WHERE id = ?')->execute([$new, $g['id']]);
            $pdo->prepare('UPDATE users SET group_name = ?, updated_at = ? WHERE group_name = ?')->execute([$new, now(), $g['name']]);
            $pdo->commit();
        } catch (Throwable $e) { $pdo->rollBack(); throw $e; }
        audit((int)$actor['id'], 'groups.rename', $g['name'], ['to' => $new]);
        respond(['group' => group_find($new), 'merged' => false]);

    case 'delete':
        require_post();
        $actor = require_role('admin');
        require_csrf();
        $d = input();
        $g = group_find(in_str($d, 'name'));
        if (!$g) fail('Group not found', 404);
        $reassign = in_str($d, 'reassign_to');
        $to = '';
        if ($reassign !== '') { $t = group_find($reassign); if (!$t) fail('Unknown group to move people into', 404); if ((int)$t['id'] === (int)$g['id']) fail('Pick a different group.'); $to = $t['name']; }
        $pdo = db();
        $pdo->beginTransaction();
        try {
            $pdo->prepare('UPDATE users SET group_name = ?, updated_at = ? WHERE group_name = ?')->execute([$to, now(), $g['name']]);
            $pdo->prepare('DELETE FROM groups WHERE id = ?')->execute([$g['id']]);
            $pdo->commit();
        } catch (Throwable $e) { $pdo->rollBack(); throw $e; }
        audit((int)$actor['id'], 'groups.delete', $g['name'], ['moved_to' => $to]);
        respond(['status' => 'ok']);

    default:
        fail('Unknown action', 404);
}
