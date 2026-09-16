<?php
// Who has passed what. Trainers and up can mark people as passed (attendance)
// from the user side or from the course side, one at a time or in bulk.
//
//   GET  ?action=for_user&user_id=       trainer+
//   GET  ?action=for_course&course_id=   trainer+
//   GET  ?action=summary                 trainer+   (pass counts per course)
//   POST ?action=set                     trainer+   {user_ids:[..], course_ids:[..], passed:true|false, note?}

declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

$action = (string)q('action', '');

function ids_from($v): array
{
    if (!is_array($v)) $v = [$v];
    $out = [];
    foreach ($v as $x) { if ($x !== null && $x !== '') $out[] = $x; }
    return array_values(array_unique($out, SORT_REGULAR));
}

switch ($action) {
    case 'for_user':
        require_role('trainer');
        $uid = (int)q('user_id', 0);
        if (!fetch_user($uid)) fail('User not found', 404);
        respond(['progress' => (object)progress_for($uid)]);

    case 'for_course':
        require_role('trainer');
        $cid = (string)q('course_id', '');
        if (!course_exists($cid)) fail('Unknown course', 404);
        $st = db()->prepare('SELECT c.user_id, c.score, c.total, c.passed_at, c.method, c.note, g.first_name AS g_first, g.last_name AS g_last, g.email AS g_email
            FROM completions c LEFT JOIN users g ON g.id = c.granted_by WHERE c.course_id = ?');
        $st->execute([$cid]);
        $rows = [];
        foreach ($st->fetchAll() as $r) {
            $rows[] = [
                'user_id' => (int)$r['user_id'],
                'score' => $r['score'] === null ? null : (int)$r['score'],
                'total' => $r['total'] === null ? null : (int)$r['total'],
                'passed_at' => $r['passed_at'],
                'method' => $r['method'],
                'note' => $r['note'],
                'granted_by' => trim(($r['g_first'] ?? '') . ' ' . ($r['g_last'] ?? '')) ?: ($r['g_email'] ?? null),
            ];
        }
        respond(['course_id' => $cid, 'completions' => $rows]);

    case 'summary':
        require_role('trainer');
        $counts = [];
        foreach (db()->query('SELECT course_id, COUNT(*) AS n FROM completions GROUP BY course_id')->fetchAll() as $r) {
            $counts[$r['course_id']] = (int)$r['n'];
        }
        respond(['counts' => (object)$counts, 'users' => (int)db()->query('SELECT COUNT(*) FROM users')->fetchColumn()]);

    case 'set':
        require_post();
        $actor = require_role('trainer');
        require_csrf();
        $d = input();
        $userIds = array_map('intval', ids_from($d['user_ids'] ?? ($d['user_id'] ?? [])));
        $courseIds = array_map('strval', ids_from($d['course_ids'] ?? ($d['course_id'] ?? [])));
        $passed = in_bool($d, 'passed', true);
        $note = mb_substr(in_str($d, 'note'), 0, 500);
        if (!$userIds) fail('Pick at least one person.');
        if (!$courseIds) fail('Pick at least one course.');
        if (count($userIds) * count($courseIds) > 20000) fail('That is too many changes at once.');
        foreach ($courseIds as $cid) if (!course_exists($cid)) fail('Unknown course "' . $cid . '"');
        $pdo = db();
        $placeholders = implode(',', array_fill(0, count($userIds), '?'));
        $st = $pdo->prepare("SELECT id FROM users WHERE id IN ($placeholders)");
        $st->execute($userIds);
        $valid = array_map('intval', array_column($st->fetchAll(), 'id'));
        if (count($valid) !== count($userIds)) fail('One or more users no longer exist.');

        $changed = 0;
        $pdo->beginTransaction();
        try {
            if ($passed) {
                // INSERT OR IGNORE keeps an existing pass (and its quiz score) intact; a note updates either way.
                $ins = $pdo->prepare("INSERT OR IGNORE INTO completions (user_id, course_id, score, total, passed_at, method, granted_by, note)
                    VALUES (?, ?, NULL, NULL, ?, 'trainer', ?, ?)");
                $noteUpd = $pdo->prepare('UPDATE completions SET note = ? WHERE user_id = ? AND course_id = ?');
                foreach ($valid as $uid) {
                    foreach ($courseIds as $cid) {
                        $ins->execute([$uid, $cid, now(), $actor['id'], $note]);
                        $n = (int)$pdo->query('SELECT changes()')->fetchColumn();
                        $changed += $n;
                        if ($n === 0 && $note !== '') $noteUpd->execute([$note, $uid, $cid]);
                    }
                }
            } else {
                $del = $pdo->prepare('DELETE FROM completions WHERE user_id = ? AND course_id = ?');
                foreach ($valid as $uid) {
                    foreach ($courseIds as $cid) {
                        $del->execute([$uid, $cid]);
                        $changed += (int)$pdo->query('SELECT changes()')->fetchColumn();
                    }
                }
            }
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
        audit((int)$actor['id'], $passed ? 'completions.mark' : 'completions.unmark', implode(',', $courseIds), ['users' => $valid, 'note' => $note]);
        respond(['status' => 'ok', 'changed' => $changed]);

    default:
        fail('Unknown action', 404);
}
