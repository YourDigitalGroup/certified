<?php
// The training portal's own progress: read on load, written when a quiz is passed.
//
//   GET  ?action=get                   signed in → {progress}
//   POST ?action=save                  signed in   {course_id, score, total}

declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

$action = (string)q('action', '');

switch ($action) {
    case 'get':
        $u = require_login();
        respond(['progress' => (object)progress_for((int)$u['id'])]);

    case 'save':
        require_post();
        $u = require_login();
        require_csrf();
        $d = input();
        $cid = in_str($d, 'course_id');
        if (!course_exists($cid)) fail('Unknown course', 404);
        $score = in_int($d, 'score');
        $total = in_int($d, 'total');
        if ($score === null || $total === null || $total <= 0 || $score < 0 || $score > $total) fail('Bad score');
        $threshold = (int)setting_get('pass_threshold', 100);
        $need = (int)ceil($total * $threshold / 100);
        if ($score < $need) fail('Score below the pass mark', 422);
        // A pass already recorded (by quiz, trainer or import) keeps its original date; the score is refreshed.
        $upd = db()->prepare("UPDATE completions SET score = ?, total = ?, method = 'quiz' WHERE user_id = ? AND course_id = ?");
        $upd->execute([$score, $total, $u['id'], $cid]);
        if ($upd->rowCount() === 0) {
            db()->prepare("INSERT OR IGNORE INTO completions (user_id, course_id, score, total, passed_at, method, granted_by, note) VALUES (?, ?, ?, ?, ?, 'quiz', NULL, '')")
                ->execute([$u['id'], $cid, $score, $total, now()]);
        }
        respond(['status' => 'ok', 'progress' => (object)progress_for((int)$u['id'])]);

    default:
        fail('Unknown action', 404);
}
