<?php
// Courses: the generated manifest plus admin overrides (edited quizzes,
// replaced videos).
//
//   GET  ?action=list                    trainer+   (courses with pass counts and override flags)
//   GET  ?action=get&id=                 trainer+   (full course: original + override quiz, video slots)
//   GET  ?action=overrides               signed in  (what the portal swaps in)
//   POST ?action=save_quiz               admin+     {id, quiz:[...]}
//   POST ?action=reset_quiz              admin+     {id}
//   POST ?action=revert_video            admin+     {original}

declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

$action = (string)q('action', '');

function video_override_rows(): array
{
    $out = [];
    $st = db()->query('SELECT v.*, u.first_name, u.last_name, u.email FROM video_overrides v LEFT JOIN users u ON u.id = v.uploaded_by');
    foreach ($st->fetchAll() as $r) {
        $out[$r['original']] = [
            'replacement' => $r['replacement'],
            'original_name' => $r['original_name'],
            'size' => (int)$r['size'],
            'uploaded_at' => $r['uploaded_at'],
            'uploaded_by' => trim(($r['first_name'] ?? '') . ' ' . ($r['last_name'] ?? '')) ?: ($r['email'] ?? null),
        ];
    }
    return $out;
}

switch ($action) {
    case 'list':
        require_role('trainer');
        $counts = [];
        foreach (db()->query('SELECT course_id, COUNT(*) AS n FROM completions GROUP BY course_id')->fetchAll() as $r) $counts[$r['course_id']] = (int)$r['n'];
        $quizOv = array_column(db()->query('SELECT course_id, updated_at FROM quiz_overrides')->fetchAll(), 'updated_at', 'course_id');
        $videoOv = video_override_rows();
        $courses = [];
        foreach (manifest()['courses'] as $c) {
            $replaced = 0;
            foreach ($c['videos'] as $v) if (isset($videoOv[$v['src']])) $replaced++;
            $courses[] = [
                'id' => $c['id'],
                'title' => $c['title'],
                'section' => $c['section'],
                'sectionIndex' => $c['sectionIndex'],
                'kind' => $c['kind'],
                'type' => $c['type'],
                'order' => $c['order'],
                'video_count' => count($c['videos']),
                'videos_replaced' => $replaced,
                'question_count' => isset($quizOv[$c['id']]) ? null : count($c['quiz']),
                'quiz_edited_at' => $quizOv[$c['id']] ?? null,
                'passed_count' => $counts[$c['id']] ?? 0,
            ];
        }
        // Fill in edited question counts.
        foreach (db()->query('SELECT course_id, quiz_json FROM quiz_overrides')->fetchAll() as $r) {
            $n = count(json_decode($r['quiz_json'], true) ?: []);
            foreach ($courses as &$c) if ($c['id'] === $r['course_id']) $c['question_count'] = $n;
            unset($c);
        }
        respond(['sections' => manifest()['sections'], 'courses' => $courses, 'total_users' => (int)db()->query('SELECT COUNT(*) FROM users')->fetchColumn()]);

    case 'get':
        require_role('trainer');
        $id = (string)q('id', '');
        $c = course_map()[$id] ?? null;
        if (!$c) fail('Unknown course', 404);
        $st = db()->prepare('SELECT quiz_json, updated_at, updated_by FROM quiz_overrides WHERE course_id = ?');
        $st->execute([$id]);
        $ov = $st->fetch();
        $videoOv = video_override_rows();
        $videos = [];
        // Which other courses share each video (replacing it affects them too).
        $usage = [];
        foreach (manifest()['courses'] as $other) foreach ($other['videos'] as $v) $usage[$v['src']][] = $other['id'];
        foreach ($c['videos'] as $i => $v) {
            $videos[] = [
                'index' => $i,
                'src' => $v['src'],
                'current' => $videoOv[$v['src']]['replacement'] ?? $v['src'],
                'override' => $videoOv[$v['src']] ?? null,
                'shared_with' => array_values(array_filter($usage[$v['src']] ?? [], fn($x) => $x !== $id)),
            ];
        }
        respond([
            'course' => [
                'id' => $c['id'], 'title' => $c['title'], 'section' => $c['section'], 'kind' => $c['kind'], 'type' => $c['type'], 'order' => $c['order'],
                'steps' => $c['steps'] ?? [],
                'original_quiz' => $c['quiz'],
                'quiz' => $ov ? (json_decode($ov['quiz_json'], true) ?: $c['quiz']) : $c['quiz'],
                'quiz_edited' => (bool)$ov,
                'quiz_edited_at' => $ov['updated_at'] ?? null,
                'videos' => $videos,
            ],
        ]);

    case 'overrides':
        require_login();
        respond(overrides());

    case 'save_quiz':
        require_post();
        $actor = require_role('admin');
        require_csrf();
        $d = input();
        $id = in_str($d, 'id');
        if (!course_exists($id)) fail('Unknown course', 404);
        $quiz = clean_quiz($d['quiz'] ?? null);
        db()->prepare('INSERT OR REPLACE INTO quiz_overrides (course_id, quiz_json, updated_at, updated_by) VALUES (?, ?, ?, ?)')
            ->execute([$id, json_encode($quiz, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), now(), $actor['id']]);
        audit((int)$actor['id'], 'courses.save_quiz', $id, count($quiz) . ' questions');
        respond(['status' => 'ok', 'quiz' => $quiz]);

    case 'reset_quiz':
        require_post();
        $actor = require_role('admin');
        require_csrf();
        $d = input();
        $id = in_str($d, 'id');
        if (!course_exists($id)) fail('Unknown course', 404);
        db()->prepare('DELETE FROM quiz_overrides WHERE course_id = ?')->execute([$id]);
        audit((int)$actor['id'], 'courses.reset_quiz', $id);
        respond(['status' => 'ok', 'quiz' => course_map()[$id]['quiz']]);

    case 'revert_video':
        require_post();
        $actor = require_role('admin');
        require_csrf();
        $d = input();
        $original = in_str($d, 'original');
        $st = db()->prepare('SELECT replacement FROM video_overrides WHERE original = ?');
        $st->execute([$original]);
        $row = $st->fetch();
        if (!$row) fail('No replacement is set for that video', 404);
        db()->prepare('DELETE FROM video_overrides WHERE original = ?')->execute([$original]);
        // Remove the uploaded file if nothing else points at it.
        $st = db()->prepare('SELECT COUNT(*) FROM video_overrides WHERE replacement = ?');
        $st->execute([$row['replacement']]);
        if ((int)$st->fetchColumn() === 0) {
            $path = PORTAL_ROOT . '/' . $row['replacement'];
            $custom = realpath(UPLOADS_DIR . '/' . CUSTOM_UPLOADS_SUBDIR);
            $real = realpath($path);
            if ($real && $custom && strpos($real, $custom) === 0 && is_file($real)) @unlink($real);
        }
        audit((int)$actor['id'], 'courses.revert_video', $original, $row['replacement']);
        respond(['status' => 'ok']);

    default:
        fail('Unknown action', 404);
}
