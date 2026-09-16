<?php
// Sign-in, first-time password creation, forced password change, sign-out,
// and the one-call "bootstrap" the portal loads on every page view.
//
//   GET  ?action=me                     → current user (401 when signed out)
//   GET  ?action=bootstrap              → user + progress + overrides + settings
//   GET  ?action=health                 → host check (no auth)
//   POST ?action=login                  {email, password?}
//   POST ?action=set_initial_password   {email, password}   (account has no password yet)
//   POST ?action=change_password        {current_password?, new_password}
//   POST ?action=logout

declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

$action = (string)q('action', '');

switch ($action) {
    case 'health':
        $dataWritable = is_dir(DATA_DIR) ? is_writable(DATA_DIR) : is_writable(dirname(DATA_DIR));
        $uploadsWritable = is_dir(UPLOADS_DIR) ? is_writable(UPLOADS_DIR) : is_writable(dirname(UPLOADS_DIR));
        $ok = true;
        try { db(); } catch (Throwable $e) { $ok = false; }
        respond([
            'ok' => $ok && $dataWritable,
            'php' => PHP_VERSION,
            'sqlite' => extension_loaded('pdo_sqlite'),
            'database' => $ok,
            'data_writable' => $dataWritable,
            'uploads_writable' => $uploadsWritable,
            'manifest' => is_file(MANIFEST_FILE),
        ]);

    case 'me':
        $u = require_login();
        respond(['user' => user_public($u), 'csrf' => csrf_token()]);

    case 'bootstrap':
        $u = require_login();
        respond([
            'user' => user_public($u),
            'csrf' => csrf_token(),
            'progress' => (object)progress_for((int)$u['id']),
            'overrides' => overrides(),
            'settings' => public_settings(),
        ]);

    case 'login':
        require_post();
        $d = input();
        $email = normalize_email(in_str($d, 'email'));
        $password = (string)($d['password'] ?? '');
        if ($email === '' || !valid_email($email)) fail('Enter a valid email address.');
        $ip = client_ip();
        rate_limit_check($email, $ip);

        $u = fetch_user_by_email($email);
        if (!$u || (int)$u['active'] !== 1) {
            rate_limit_record($email, $ip, false);
            if ($password === '') fail('No account found for that email. Ask your trainer or administrator to add you.', 404, ['code' => 'no_account']);
            fail('Invalid email or password.', 401, ['code' => 'bad_credentials']);
        }

        if (empty($u['password_hash'])) {
            // Account was created without a password: the person creates one now.
            respond(['status' => 'set_password', 'email' => $u['email'], 'name' => display_name($u)]);
        }
        if ($password === '') {
            respond(['status' => 'password_required', 'email' => $u['email']]);
        }
        if (!password_verify($password, $u['password_hash'])) {
            rate_limit_record($email, $ip, false);
            fail('Invalid email or password.', 401, ['code' => 'bad_credentials']);
        }
        rate_limit_record($email, $ip, true);
        if (password_needs_rehash($u['password_hash'], PASSWORD_DEFAULT)) {
            db()->prepare('UPDATE users SET password_hash = ? WHERE id = ?')->execute([password_hash($password, PASSWORD_DEFAULT), $u['id']]);
        }
        $csrf = login_session($u);
        db()->prepare('UPDATE users SET last_login_at = ? WHERE id = ?')->execute([now(), $u['id']]);
        audit((int)$u['id'], 'auth.login', $u['email']);
        $u = fetch_user((int)$u['id']);
        respond(['status' => 'ok', 'user' => user_public($u), 'csrf' => $csrf]);

    case 'set_initial_password':
        require_post();
        $d = input();
        $email = normalize_email(in_str($d, 'email'));
        $password = (string)($d['password'] ?? '');
        if ($email === '' || !valid_email($email)) fail('Enter a valid email address.');
        $ip = client_ip();
        rate_limit_check($email, $ip);
        $u = fetch_user_by_email($email);
        if (!$u || (int)$u['active'] !== 1) {
            rate_limit_record($email, $ip, false);
            fail('No account found for that email.', 404, ['code' => 'no_account']);
        }
        if (!empty($u['password_hash'])) {
            rate_limit_record($email, $ip, false);
            fail('This account already has a password. Sign in with it instead.', 409, ['code' => 'has_password']);
        }
        $problem = password_problem($password);
        if ($problem) fail($problem);
        db()->prepare('UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = ?, last_login_at = ? WHERE id = ?')
            ->execute([password_hash($password, PASSWORD_DEFAULT), now(), now(), $u['id']]);
        rate_limit_record($email, $ip, true);
        $u = fetch_user((int)$u['id']);
        $csrf = login_session($u);
        audit((int)$u['id'], 'auth.set_initial_password', $u['email']);
        respond(['status' => 'ok', 'user' => user_public($u), 'csrf' => $csrf]);

    case 'change_password':
        require_post();
        $u = require_login();
        require_csrf();
        $d = input();
        $current = (string)($d['current_password'] ?? '');
        $new = (string)($d['new_password'] ?? '');
        if (!empty($u['password_hash'])) {
            if ($current === '' || !password_verify($current, $u['password_hash'])) fail('Your current password is not correct.', 403, ['code' => 'bad_current']);
            if ($current === $new) fail('Choose a password different from your current one.');
        }
        $problem = password_problem($new);
        if ($problem) fail($problem);
        db()->prepare('UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?')
            ->execute([password_hash($new, PASSWORD_DEFAULT), now(), $u['id']]);
        audit((int)$u['id'], 'auth.change_password', $u['email']);
        $u = fetch_user((int)$u['id']);
        respond(['status' => 'ok', 'user' => user_public($u)]);

    case 'logout':
        require_post();
        $u = current_user();
        if ($u) audit((int)$u['id'], 'auth.logout', $u['email']);
        logout_session();
        respond(['status' => 'ok']);

    default:
        fail('Unknown action', 404);
}
