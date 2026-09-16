<?php
// Chunked video upload for course video replacement (admin+).
// Shared hosts usually cap a single POST at 2–8 MB, so the browser sends the
// file in 1 MB pieces and the server stitches them together in data/tmp.
//
//   POST ?action=start    {filename, size, course_id, original}  → {upload_id, chunk_size}
//   POST ?action=chunk&upload_id=&index=   (raw bytes in the body)
//   POST ?action=finish   {upload_id}                            → {replacement}
//   POST ?action=abort    {upload_id}

declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

$action = (string)q('action', '');
const VIDEO_EXTENSIONS = ['mp4', 'webm', 'm4v', 'mov'];

function upload_row(string $id, int $userId): array
{
    if (!preg_match('/^[a-f0-9]{32}$/', $id)) fail('Bad upload id');
    $st = db()->prepare('SELECT * FROM uploads WHERE id = ? AND user_id = ?');
    $st->execute([$id, $userId]);
    $row = $st->fetch();
    if (!$row) fail('Upload not found or expired', 404);
    return $row;
}

function part_path(string $id): string
{
    return TMP_DIR . '/' . $id . '.part';
}

function cleanup_stale_uploads(): void
{
    $cutoff = gmdate('Y-m-d\TH:i:s\Z', time() - 60 * 60 * 24);
    $st = db()->prepare('SELECT id FROM uploads WHERE created_at < ?');
    $st->execute([$cutoff]);
    foreach ($st->fetchAll() as $r) {
        @unlink(part_path($r['id']));
        db()->prepare('DELETE FROM uploads WHERE id = ?')->execute([$r['id']]);
    }
}

/** Accept only files whose first bytes look like MP4/QuickTime or WebM/Matroska. */
function looks_like_video(string $path): bool
{
    $fh = fopen($path, 'rb');
    if (!$fh) return false;
    $head = fread($fh, 64) ?: '';
    fclose($fh);
    if (strlen($head) < 12) return false;
    if (substr($head, 4, 4) === 'ftyp') return true;                 // ISO BMFF (mp4, m4v, mov)
    if (in_array(substr($head, 4, 4), ['moov', 'mdat', 'wide', 'free', 'skip'], true)) return true; // legacy QuickTime atoms
    if (substr($head, 0, 4) === "\x1A\x45\xDF\xA3") return true;   // EBML (webm / mkv)
    return false;
}

switch ($action) {
    case 'start':
        require_post();
        $actor = require_role('admin');
        require_csrf();
        $d = input();
        $filename = in_str($d, 'filename');
        $size = in_int($d, 'size', 0) ?? 0;
        $courseId = in_str($d, 'course_id');
        $original = in_str($d, 'original');
        $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
        if (!in_array($ext, VIDEO_EXTENSIONS, true)) fail('Upload an .mp4, .webm, .m4v or .mov file.');
        if ($size <= 0) fail('The file is empty.');
        if ($size > MAX_VIDEO_BYTES) fail('That file is larger than the ' . round(MAX_VIDEO_BYTES / 1048576) . ' MB limit.');
        if (!course_exists($courseId)) fail('Unknown course', 404);
        $slotOk = false;
        foreach (course_map()[$courseId]['videos'] as $v) if ($v['src'] === $original) $slotOk = true;
        if (!$slotOk) fail('That video slot does not belong to this course.');
        ensure_dir(TMP_DIR);
        if (!is_writable(TMP_DIR)) fail('The server cannot write to data/tmp. Check folder permissions.', 500);
        $customDir = UPLOADS_DIR . '/' . CUSTOM_UPLOADS_SUBDIR;
        ensure_dir($customDir);
        if (!is_writable($customDir)) fail('The server cannot write to uploads/custom. Check folder permissions.', 500);
        cleanup_stale_uploads();
        $id = random_token(16);
        db()->prepare('INSERT INTO uploads (id, user_id, filename, size, received, next_index, course_id, original, created_at) VALUES (?, ?, ?, ?, 0, 0, ?, ?, ?)')
            ->execute([$id, $actor['id'], mb_substr($filename, 0, 200), $size, $courseId, $original, now()]);
        file_put_contents(part_path($id), '');
        respond(['upload_id' => $id, 'chunk_size' => CHUNK_SIZE, 'total_chunks' => (int)ceil($size / CHUNK_SIZE)]);

    case 'chunk':
        require_post();
        $actor = require_role('admin');
        require_csrf();
        $id = (string)q('upload_id', '');
        $index = (int)q('index', -1);
        $row = upload_row($id, (int)$actor['id']);
        if ($index !== (int)$row['next_index']) {
            // Client retried a chunk we already have, or skipped one.
            if ($index < (int)$row['next_index']) respond(['status' => 'ok', 'received' => (int)$row['received'], 'next_index' => (int)$row['next_index']]);
            fail('Out-of-order chunk', 409, ['next_index' => (int)$row['next_index']]);
        }
        $data = file_get_contents('php://input');
        if ($data === false || $data === '') fail('Empty chunk');
        if (strlen($data) > CHUNK_SIZE + 1024) fail('Chunk too large');
        if ((int)$row['received'] + strlen($data) > (int)$row['size']) fail('More data than announced');
        $fh = fopen(part_path($id), 'ab');
        if (!$fh) fail('Cannot write upload', 500);
        fwrite($fh, $data);
        fclose($fh);
        $received = (int)$row['received'] + strlen($data);
        db()->prepare('UPDATE uploads SET received = ?, next_index = ? WHERE id = ?')->execute([$received, $index + 1, $id]);
        respond(['status' => 'ok', 'received' => $received, 'next_index' => $index + 1]);

    case 'finish':
        require_post();
        $actor = require_role('admin');
        require_csrf();
        $d = input();
        $id = in_str($d, 'upload_id');
        $row = upload_row($id, (int)$actor['id']);
        $part = part_path($id);
        if (!is_file($part) || filesize($part) !== (int)$row['size']) fail('Upload incomplete (' . (is_file($part) ? filesize($part) : 0) . ' of ' . $row['size'] . ' bytes).', 409);
        if (!looks_like_video($part)) { @unlink($part); db()->prepare('DELETE FROM uploads WHERE id = ?')->execute([$id]); fail('That file does not look like a video.'); }
        $ext = strtolower(pathinfo($row['filename'], PATHINFO_EXTENSION));
        $base = preg_replace('/[^a-z0-9]+/', '-', strtolower(pathinfo($row['filename'], PATHINFO_FILENAME)));
        $base = trim((string)$base, '-') ?: 'video';
        $name = $row['course_id'] . '-' . substr($base, 0, 40) . '-' . random_token(4) . '.' . $ext;
        $customDir = UPLOADS_DIR . '/' . CUSTOM_UPLOADS_SUBDIR;
        ensure_dir($customDir);
        $guard = $customDir . '/.htaccess';
        if (!is_file($guard)) {
            @file_put_contents($guard, "# Uploaded media only: never execute scripts from here.\n<FilesMatch \"\\.(php|phtml|phar|cgi|pl|py)$\">\n  <IfModule mod_authz_core.c>\n    Require all denied\n  </IfModule>\n  <IfModule !mod_authz_core.c>\n    Deny from all\n  </IfModule>\n</FilesMatch>\n");
        }
        $dest = $customDir . '/' . $name;
        if (!@rename($part, $dest)) {
            if (!@copy($part, $dest)) fail('Could not move the uploaded file into uploads/custom.', 500);
            @unlink($part);
        }
        @chmod($dest, 0644);
        $replacement = 'uploads/' . CUSTOM_UPLOADS_SUBDIR . '/' . $name;
        // Drop the previous replacement file for this slot if it is now unused.
        $st = db()->prepare('SELECT replacement FROM video_overrides WHERE original = ?');
        $st->execute([$row['original']]);
        $prev = $st->fetchColumn();
        db()->prepare('INSERT OR REPLACE INTO video_overrides (original, replacement, course_id, original_name, size, uploaded_at, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?)')
            ->execute([$row['original'], $replacement, $row['course_id'], $row['filename'], (int)$row['size'], now(), $actor['id']]);
        if ($prev && $prev !== $replacement) {
            $st = db()->prepare('SELECT COUNT(*) FROM video_overrides WHERE replacement = ?');
            $st->execute([$prev]);
            if ((int)$st->fetchColumn() === 0) {
                $real = realpath(PORTAL_ROOT . '/' . $prev);
                $custom = realpath($customDir);
                if ($real && $custom && strpos($real, $custom) === 0 && is_file($real)) @unlink($real);
            }
        }
        db()->prepare('DELETE FROM uploads WHERE id = ?')->execute([$id]);
        audit((int)$actor['id'], 'courses.replace_video', $row['original'], ['course' => $row['course_id'], 'file' => $replacement, 'size' => (int)$row['size']]);
        respond(['status' => 'ok', 'original' => $row['original'], 'replacement' => $replacement]);

    case 'abort':
        require_post();
        $actor = require_role('admin');
        require_csrf();
        $d = input();
        $id = in_str($d, 'upload_id');
        $row = upload_row($id, (int)$actor['id']);
        @unlink(part_path($row['id']));
        db()->prepare('DELETE FROM uploads WHERE id = ?')->execute([$id]);
        respond(['status' => 'ok']);

    default:
        fail('Unknown action', 404);
}
