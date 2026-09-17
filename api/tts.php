<?php
// Narration clips for the portal, generated once and shared by everyone.
//
//   POST api/tts.php   {voice, text, timestamps:true|false}      signed in + CSRF
//
// The first request for a given voice+text asks ElevenLabs to synthesize it and stores
// the result in data/vo-cache; every later request (any person, any browser) is served
// from that file. The API key never leaves the server. Only narration texts that the
// course manifest lists (by hash) and only the configured voice ids are accepted, so
// the endpoint cannot be used to synthesize arbitrary speech at your expense.
//
// With timestamps=true the response is ElevenLabs' JSON ({audio_base64, alignment, …});
// otherwise it is the raw audio/mpeg bytes. Both are what the portal used to fetch
// directly from ElevenLabs.

declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

require_post();
require_login();
require_csrf();

if (!defined('ELEVENLABS_API_KEY') || ELEVENLABS_API_KEY === '') fail('Narration is not configured on this server.', 503, ['code' => 'tts_disabled']);

$d = input();
$voice = in_str($d, 'voice');
$text = (string)($d['text'] ?? '');
$timestamps = in_bool($d, 'timestamps', true);

if (!preg_match('/^[A-Za-z0-9]{10,40}$/', $voice) || !in_array($voice, ELEVENLABS_VOICES, true)) fail('Unknown voice', 400);
if ($text === '' || strlen($text) > 6000) fail('Bad text', 400);

// Allowlist: only the narration the course scripts contain.
$allowed = manifest()['narration_hashes'] ?? null;
$hash = sha1($text);
if (!is_array($allowed) || !in_array($hash, $allowed, true)) fail('That text is not part of a course.', 403, ['code' => 'not_course_text']);

ensure_dir(VO_CACHE_DIR);
if (!is_file(VO_CACHE_DIR . '/.htaccess')) {
    @file_put_contents(VO_CACHE_DIR . '/.htaccess', "<IfModule mod_authz_core.c>\n  Require all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\n  Deny from all\n</IfModule>\n");
}
$file = VO_CACHE_DIR . '/' . sha1($voice . '|' . ELEVENLABS_MODEL . '|' . ($timestamps ? 'ts' : 'mp3') . '|' . $text) . ($timestamps ? '.json' : '.mp3');

function send_cached(string $file, bool $timestamps, string $cacheState = 'hit'): void
{
    header('Content-Type: ' . ($timestamps ? 'application/json; charset=utf-8' : 'audio/mpeg'));
    header('Cache-Control: private, max-age=2592000');
    header('Content-Length: ' . (string)filesize($file));
    header('X-VO-Cache: ' . $cacheState);
    readfile($file);
    exit;
}

if (is_file($file) && filesize($file) > 0) send_cached($file, $timestamps);

// Generate.
$url = 'https://api.elevenlabs.io/v1/text-to-speech/' . rawurlencode($voice) . ($timestamps ? '/with-timestamps' : '');
$body = json_encode([
    'text' => $text,
    'model_id' => ELEVENLABS_MODEL,
    'voice_settings' => ['stability' => 0.5, 'similarity_boost' => 0.75],
], JSON_UNESCAPED_UNICODE);
$headers = ['xi-api-key: ' . ELEVENLABS_API_KEY, 'Content-Type: application/json', 'Accept: ' . ($timestamps ? 'application/json' : 'audio/mpeg')];

$status = 0;
$resp = false;
if (function_exists('curl_init')) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $body,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 90,
        CURLOPT_CONNECTTIMEOUT => 15,
    ]);
    $resp = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    if ($resp === false) { error_log('[portal-tts] curl: ' . $err); fail('Could not reach the narration service.', 502, ['code' => 'tts_unreachable']); }
} else {
    $ctx = stream_context_create(['http' => ['method' => 'POST', 'header' => implode("\r\n", $headers), 'content' => $body, 'timeout' => 90, 'ignore_errors' => true]]);
    $resp = @file_get_contents($url, false, $ctx);
    if ($resp === false) fail('Could not reach the narration service.', 502, ['code' => 'tts_unreachable']);
    foreach ($http_response_header ?? [] as $h) if (preg_match('#^HTTP/\S+\s+(\d{3})#', $h, $m)) $status = (int)$m[1];
}

if ($status < 200 || $status >= 300) {
    error_log('[portal-tts] ElevenLabs HTTP ' . $status . ': ' . substr((string)$resp, 0, 300));
    fail('The narration service refused the request (HTTP ' . $status . ').', 502, ['code' => 'tts_failed']);
}
if ($timestamps) {
    $decoded = json_decode((string)$resp, true);
    if (!is_array($decoded) || empty($decoded['audio_base64'])) fail('Unexpected narration response.', 502, ['code' => 'tts_bad_response']);
} elseif (strlen((string)$resp) < 100) {
    fail('Unexpected narration response.', 502, ['code' => 'tts_bad_response']);
}

$tmp = $file . '.' . random_token(4) . '.tmp';
if (@file_put_contents($tmp, $resp) === false || !@rename($tmp, $file)) {
    @unlink($tmp);
    // Could not cache (permissions?) — still serve this one response.
    header('Content-Type: ' . ($timestamps ? 'application/json; charset=utf-8' : 'audio/mpeg'));
    header('X-VO-Cache: nostore');
    echo $resp;
    exit;
}
send_cached($file, $timestamps, 'miss');
