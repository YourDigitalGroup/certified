<?php
// Pending passes: courses recorded by name for people who do not have an account yet.
// They apply automatically when a matching person is added or imported (see users.php),
// or a trainer attaches them to an existing person here.
//
//   GET  ?action=list      trainer+   unclaimed records (with possible matches among existing people) + recently applied
//   POST ?action=create    trainer+   {people:[{first_name,last_name,group_name?}], course_ids:[..], passed_at?, note?}
//   POST ?action=apply     trainer+   {id, user_id}
//   POST ?action=delete    admin+     {id}

declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

$action = (string)q('action', '');

switch ($action) {
    case 'list':
        require_role('trainer');
        $pdo = db();
        $users = $pdo->query('SELECT id, first_name, last_name, email, group_name FROM users')->fetchAll();
        $open = [];
        $claimed = [];
        foreach ($pdo->query('SELECT * FROM pending_passes ORDER BY id DESC')->fetchAll() as $r) {
            $p = pending_public($r);
            if ($r['claimed_user_id'] === null) {
                $fk = name_key($r['first_name']);
                $lk = name_key($r['last_name']);
                $pg = mb_strtolower(trim((string)$r['group_name']));
                $p['matches'] = [];
                foreach ($users as $u) {
                    if (name_key((string)$u['first_name']) !== $fk || name_key((string)$u['last_name']) !== $lk) continue;
                    $ug = mb_strtolower(trim((string)$u['group_name']));
                    $p['matches'][] = ['id' => (int)$u['id'], 'name' => trim($u['first_name'] . ' ' . $u['last_name']), 'email' => $u['email'], 'group_name' => $u['group_name'], 'same_group' => $pg === '' || $ug === '' || $pg === $ug];
                }
                $open[] = $p;
            } elseif (count($claimed) < 50) {
                $u = fetch_user((int)$r['claimed_user_id']);
                $p['claimed_by'] = $u ? ['id' => (int)$u['id'], 'name' => display_name($u), 'email' => $u['email']] : null;
                $claimed[] = $p;
            }
        }
        respond(['pending' => $open, 'claimed' => $claimed]);

    case 'create':
        require_post();
        $actor = require_role('trainer');
        require_csrf();
        $d = input();
        $people = is_array($d['people'] ?? null) ? $d['people'] : [];
        $courseIds = array_values(array_unique(array_map('strval', is_array($d['course_ids'] ?? null) ? $d['course_ids'] : [])));
        if (!$courseIds) fail('Pick at least one course.');
        foreach ($courseIds as $cid) if (!course_exists($cid)) fail('Unknown course "' . $cid . '"');
        if (!$people) fail('Add at least one name.');
        if (count($people) > 500) fail('At most 500 names at a time.');
        $passedAt = iso_or_null($d['passed_at'] ?? '');
        $note = mb_substr(in_str($d, 'note'), 0, 500);
        $groupsCreated = 0;
        $saved = 0;
        $errors = [];
        foreach ($people as $i => $p) {
            if (!is_array($p)) continue;
            $first = trim(in_str($p, 'first_name'));
            $last = trim(in_str($p, 'last_name'));
            if ($first === '' && $last === '') { $errors[] = 'Line ' . ($i + 1) . ': no name'; continue; }
            $group = trim(in_str($p, 'group_name'));
            if ($group !== '') $group = group_ensure($group, $groupsCreated);
            pending_save($first, $last, $group, $courseIds, $passedAt, $note, (int)$actor['id']);
            $saved++;
        }
        audit((int)$actor['id'], 'pending.create', '', ['saved' => $saved, 'courses' => $courseIds, 'note' => $note]);
        respond(['saved' => $saved, 'groups_created' => $groupsCreated, 'errors' => $errors], 201);

    case 'apply':
        require_post();
        $actor = require_role('trainer');
        require_csrf();
        $d = input();
        $st = db()->prepare('SELECT * FROM pending_passes WHERE id = ?');
        $st->execute([(int)in_int($d, 'id', 0)]);
        $p = $st->fetch();
        if (!$p) fail('Pending record not found', 404);
        if ($p['claimed_user_id'] !== null) fail('That record was already applied.', 409);
        $u = fetch_user((int)in_int($d, 'user_id', 0));
        if (!$u) fail('User not found', 404);
        $added = pending_apply($p, (int)$u['id'], (int)$actor['id']);
        audit((int)$actor['id'], 'pending.apply', (string)$u['email'], ['pending_id' => (int)$p['id'], 'name' => trim($p['first_name'] . ' ' . $p['last_name']), 'added' => $added]);
        respond(['status' => 'ok', 'completions_added' => $added, 'user' => user_public($u)]);

    case 'delete':
        require_post();
        $actor = require_role('admin');
        require_csrf();
        $id = (int)in_int(input(), 'id', 0);
        $st = db()->prepare('SELECT * FROM pending_passes WHERE id = ?');
        $st->execute([$id]);
        $p = $st->fetch();
        if (!$p) fail('Pending record not found', 404);
        db()->prepare('DELETE FROM pending_passes WHERE id = ?')->execute([$id]);
        audit((int)$actor['id'], 'pending.delete', trim($p['first_name'] . ' ' . $p['last_name']));
        respond(['status' => 'ok']);

    default:
        fail('Unknown action', 404);
}
