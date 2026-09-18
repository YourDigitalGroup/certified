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
//   POST ?action=request_reset          {email}            email a one-time link (forgot password / first sign-in)
//   GET  ?action=reset_info&token=      → who the link is for, or 410 when expired/used
//   POST ?action=reset_password         {token, password}  set the password and sign in
//   POST ?action=logout

declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

$action = (string)q('action', '');

switch ($action) {
    case 'health':
        $dataWritable = is_dir(DATA_DIR) ? is_writable(DATA_DIR) : is_writable(dirname(DATA_DIR));
        $uploadsWritable = is_dir(UPLOADS_DIR) ? is_writable(UPLOADS_DIR) : is_writable(dirname(UPLOADS_DIR));
        $ok = true;
        $mail = false;
        try { db(); $mail = mail_configured(); } catch (Throwable $e) { $ok = false; }
        respond([
            'ok' => $ok && $dataWritable,
            'php' => PHP_VERSION,
            'sqlite' => extension_loaded('pdo_sqlite'),
            'database' => $ok,
            'data_writable' => $dataWritable,
            'uploads_writable' => $uploadsWritable,
            'manifest' => is_file(MANIFEST_FILE),
            // The sign-in page shows "Forgot your password?" only when email can actually go out.
            'mail' => $mail,
            'curl' => function_exists('curl_init'),
        ]);

    case 'me':
        $u = require_login();
        respond(array_merge(['user' => user_public($u), 'csrf' => csrf_token()], session_extras()));

    case 'bootstrap':
        $u = require_login();
        respond(array_merge([
            'user' => user_public($u),
            'csrf' => csrf_token(),
            'progress' => (object)progress_for((int)$u['id']),
            'overrides' => overrides(),
            'settings' => public_settings(),
        ], session_extras()));

    case 'impersonate':
        // A permitted super admin views the portal (or admin) as another person.
        require_post();
        $u = require_login();
        require_csrf();
        if (impersonator()) fail('You are already viewing as someone else. Return to your account first.', 409, ['code' => 'already_impersonating']);
        if (!can_impersonate($u)) fail('Only the super admin can sign in as another person.', 403, ['code' => 'forbidden']);
        $t = fetch_user((int)in_int(input(), 'user_id', 0));
        if (!$t) fail('User not found', 404);
        if ((int)$t['id'] === (int)$u['id']) fail('That is your own account.');
        if ((int)$t['active'] !== 1) fail('That account is deactivated.');
        audit((int)$u['id'], 'auth.impersonate', $t['email'], ['target_id' => (int)$t['id']]);
        $_SESSION['impersonator_uid'] = (int)$u['id'];
        $_SESSION['uid'] = (int)$t['id'];
        $_SESSION['csrf'] = random_token(24);
        respond(['status' => 'ok', 'user' => user_public($t), 'csrf' => $_SESSION['csrf'],
            'impersonating' => ['by' => display_name($u), 'by_id' => (int)$u['id'], 'by_email' => $u['email']], 'can_impersonate' => false]);

    case 'stop_impersonating':
        require_post();
        require_login();
        require_csrf();
        $imp = impersonator();
        if (!$imp) fail('You are not viewing as anyone else.', 409, ['code' => 'not_impersonating']);
        $target = current_user();
        audit((int)$imp['id'], 'auth.stop_impersonating', $target ? $target['email'] : '');
        unset($_SESSION['impersonator_uid']);
        $_SESSION['uid'] = (int)$imp['id'];
        $_SESSION['csrf'] = random_token(24);
        respond(['status' => 'ok', 'user' => user_public($imp), 'csrf' => $_SESSION['csrf'], 'impersonating' => null, 'can_impersonate' => can_impersonate($imp)]);

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
            if (mail_configured()) {
                // Prove they own the inbox: email a one-time link to set the password.
                reset_rate_check($email, $ip);
                $r = send_password_link($u, 'welcome', $ip, null);
                if (!$r['ok']) fail('We could not send the email to set your password. Please ask your trainer or administrator.', 502, ['code' => 'mail_failed']);
                respond(['status' => 'link_sent', 'email' => $u['email'], 'minutes' => (int)round(RESET_LINK_TTL / 60)]);
            }
            // No email set up: the person creates a password on the spot.
            respond(['status' => 'set_password', 'email' => $u['email'], 'name' => display_name($u)]);
        }
        if ($password === '') {
            respond(['status' => 'password_required', 'email' => $u['email']]);
        }
        if (!verify_password($password, $u['password_hash'])) {
            rate_limit_record($email, $ip, false);
            fail('Invalid email or password.', 401, ['code' => 'bad_credentials']);
        }
        rate_limit_record($email, $ip, true);
        // Hashes from the old site (and any outdated native ones) are upgraded on first successful login.
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
        if (mail_configured()) {
            // With email available the account may only be claimed through the link sent to that inbox.
            fail('For security, set your password through the link we emailed you. Enter your email on the sign-in page to get a new one.', 409, ['code' => 'link_required']);
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

    case 'request_reset':
        // "Forgot your password?" — also covers people who never set one. The answer is the same
        // whether or not the address has an account, so nobody can probe the directory.
        require_post();
        $d = input();
        $email = normalize_email(in_str($d, 'email'));
        if ($email === '' || !valid_email($email)) fail('Enter a valid email address.');
        if (!mail_configured()) fail('Password reset by email is not set up yet. Ask your trainer or administrator to reset your password.', 503, ['code' => 'mail_unavailable']);
        $ip = client_ip();
        reset_rate_check($email, $ip);
        $u = fetch_user_by_email($email);
        if ($u && (int)$u['active'] === 1) {
            $r = send_password_link($u, empty($u['password_hash']) ? 'welcome' : 'reset', $ip, null);
            if (!$r['ok']) fail('We could not send the email right now. Please try again later or ask your administrator.', 502, ['code' => 'mail_failed']);
        }
        respond(['status' => 'sent', 'email' => $email, 'minutes' => (int)round(RESET_LINK_TTL / 60)]);

    case 'reset_info':
        $r = reset_token_lookup((string)q('token', ''));
        if (!$r) fail('This link has expired or was already used. Request a new one from the sign-in page.', 410, ['code' => 'bad_token']);
        respond(['status' => 'ok', 'email' => $r['email'], 'name' => display_name($r), 'purpose' => $r['purpose'], 'has_password' => !empty($r['password_hash'])]);

    case 'reset_password':
        require_post();
        $d = input();
        $r = reset_token_lookup(in_str($d, 'token'));
        if (!$r) fail('This link has expired or was already used. Request a new one from the sign-in page.', 410, ['code' => 'bad_token']);
        $password = (string)($d['password'] ?? '');
        $problem = password_problem($password);
        if ($problem) fail($problem);
        $pdo = db();
        $pdo->prepare('UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = ?, last_login_at = ? WHERE id = ?')
            ->execute([password_hash($password, PASSWORD_DEFAULT), now(), now(), $r['user_id']]);
        $pdo->prepare('UPDATE password_resets SET used_at = ? WHERE id = ?')->execute([time(), $r['id']]);
        $pdo->prepare('DELETE FROM password_resets WHERE user_id = ? AND id <> ?')->execute([$r['user_id'], $r['id']]);
        $u = fetch_user((int)$r['user_id']);
        rate_limit_record($u['email'], client_ip(), true);
        $csrf = login_session($u);
        audit((int)$u['id'], $r['purpose'] === 'welcome' ? 'auth.set_password_by_link' : 'auth.reset_password', $u['email']);
        respond(['status' => 'ok', 'user' => user_public($u), 'csrf' => $csrf]);

    case 'change_password':
        require_post();
        $u = require_login();
        require_csrf();
        $d = input();
        $current = (string)($d['current_password'] ?? '');
        $new = (string)($d['new_password'] ?? '');
        if (!empty($u['password_hash'])) {
            if ($current === '' || !verify_password($current, $u['password_hash'])) fail('Your current password is not correct.', 403, ['code' => 'bad_current']);
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
