<?php

declare(strict_types=1);

function envv(string $key, ?string $default = null): ?string
{
    $value = getenv($key);
    if ($value === false || $value === '') {
        return $default;
    }
    return $value;
}

function json_response(int $status, array $payload): void
{
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode($payload);
    exit;
}

function request_json(): array
{
    $raw = file_get_contents('php://input') ?: '';
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function normalize_email(string $email): string
{
    return strtolower(trim($email));
}

function is_valid_email(string $email): bool
{
    return (bool) filter_var($email, FILTER_VALIDATE_EMAIL);
}

function is_strong_password(string $password): bool
{
    return (bool) preg_match('/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$/', $password);
}

function generate_otp(): string
{
    return (string) random_int(100000, 999999);
}

function now_iso(): string
{
    return gmdate('c');
}

function parse_duration_seconds(string $value, int $fallback = 600): int
{
    if (preg_match('/^(\d+)([smhd])$/i', trim($value), $m)) {
        $n = (int) $m[1];
        $u = strtolower($m[2]);
        return match ($u) {
            's' => $n,
            'm' => $n * 60,
            'h' => $n * 3600,
            'd' => $n * 86400,
            default => $fallback,
        };
    }
    return $fallback;
}

function github_cfg(): array
{
    return [
        'mode' => strtolower(envv('GITHUB_DB_MODE', 'file') ?? 'file'),
        'owner' => envv('GITHUB_DB_OWNER'),
        'repo' => envv('GITHUB_DB_REPO'),
        'branch' => envv('GITHUB_DB_BRANCH', 'main'),
        'filePath' => envv('GITHUB_DB_EMAIL_FILE_PATH', 'server/data/email-auth.json'),
        'token' => envv('GITHUB_DB_TOKEN'),
        'committerName' => envv('GITHUB_DB_COMMITTER_NAME', 'Auth App Bot'),
        'committerEmail' => envv('GITHUB_DB_COMMITTER_EMAIL', 'noreply@example.com'),
    ];
}

function github_request(string $method, string $url, ?array $body = null): array
{
    $cfg = github_cfg();
    $headers = [
        'Accept: application/vnd.github+json',
        'User-Agent: auth-app-php-api',
        'Authorization: Bearer ' . ($cfg['token'] ?? ''),
        'Content-Type: application/json',
    ];

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    if ($body !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    }

    $resp = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);

    if ($resp === false) {
        throw new RuntimeException('GitHub API network error: ' . $err);
    }

    $json = json_decode($resp, true);
    if (!is_array($json)) {
        $json = [];
    }

    return ['status' => $status, 'body' => $json];
}

function empty_store(): array
{
    return [
        'users' => [],
        'pendingSignups' => [],
        'passwordResets' => [],
    ];
}

function normalize_store(array $store): array
{
    return [
        'users' => isset($store['users']) && is_array($store['users']) ? $store['users'] : [],
        'pendingSignups' => isset($store['pendingSignups']) && is_array($store['pendingSignups']) ? $store['pendingSignups'] : [],
        'passwordResets' => isset($store['passwordResets']) && is_array($store['passwordResets']) ? $store['passwordResets'] : [],
    ];
}

function local_store_path(): string
{
    $custom = envv('EMAIL_AUTH_FILE_DB_PATH');
    if ($custom) {
        return $custom;
    }
    return sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'auth-email-store.json';
}

function read_store_with_meta(): array
{
    $cfg = github_cfg();
    if ($cfg['mode'] === 'api') {
        if (!$cfg['owner'] || !$cfg['repo'] || !$cfg['token']) {
            throw new RuntimeException('Missing GitHub API DB config.');
        }

        $encodedPath = implode('/', array_map('rawurlencode', explode('/', (string) $cfg['filePath'])));
        $url = 'https://api.github.com/repos/' . $cfg['owner'] . '/' . $cfg['repo'] . '/contents/' . $encodedPath . '?ref=' . rawurlencode((string) $cfg['branch']);
        $resp = github_request('GET', $url);

        if ($resp['status'] === 404) {
            return ['store' => empty_store(), 'sha' => null];
        }

        if ($resp['status'] < 200 || $resp['status'] >= 300) {
            $msg = $resp['body']['message'] ?? 'GitHub API read failed';
            throw new RuntimeException($msg);
        }

        $content = (string) ($resp['body']['content'] ?? '');
        $sha = $resp['body']['sha'] ?? null;
        $decoded = base64_decode(str_replace("\n", '', $content), true);
        if ($decoded === false) {
            return ['store' => empty_store(), 'sha' => $sha];
        }

        $store = json_decode($decoded, true);
        if (!is_array($store)) {
            $store = empty_store();
        }

        return ['store' => normalize_store($store), 'sha' => $sha];
    }

    $path = local_store_path();
    if (!file_exists($path)) {
        file_put_contents($path, json_encode(empty_store(), JSON_PRETTY_PRINT));
    }
    $raw = file_get_contents($path);
    $store = json_decode($raw ?: '', true);
    if (!is_array($store)) {
        $store = empty_store();
    }

    return ['store' => normalize_store($store), 'sha' => null];
}

function write_store(array $store): void
{
    $cfg = github_cfg();
    $store = normalize_store($store);

    if ($cfg['mode'] === 'api') {
        $current = read_store_with_meta();
        $sha = $current['sha'];

        $encodedPath = implode('/', array_map('rawurlencode', explode('/', (string) $cfg['filePath'])));
        $url = 'https://api.github.com/repos/' . $cfg['owner'] . '/' . $cfg['repo'] . '/contents/' . $encodedPath;

        $payload = [
            'message' => 'chore(auth): update email auth store via php api',
            'content' => base64_encode(json_encode($store, JSON_PRETTY_PRINT)),
            'branch' => $cfg['branch'],
            'committer' => [
                'name' => $cfg['committerName'],
                'email' => $cfg['committerEmail'],
            ],
        ];
        if ($sha) {
            $payload['sha'] = $sha;
        }

        $resp = github_request('PUT', $url, $payload);
        if ($resp['status'] < 200 || $resp['status'] >= 300) {
            $msg = $resp['body']['message'] ?? 'GitHub API write failed';
            throw new RuntimeException($msg);
        }
        return;
    }

    file_put_contents(local_store_path(), json_encode($store, JSON_PRETTY_PRINT));
}

function smtp_read($fp): string
{
    $data = '';
    while (!feof($fp)) {
        $line = fgets($fp, 515);
        if ($line === false) {
            break;
        }
        $data .= $line;
        if (strlen($line) < 4 || $line[3] !== '-') {
            break;
        }
    }
    return $data;
}

function smtp_cmd($fp, string $cmd, array $expectPrefixes = ['2', '3']): string
{
    fwrite($fp, $cmd . "\r\n");
    $resp = smtp_read($fp);
    $first = substr(trim($resp), 0, 1);
    if (!in_array($first, $expectPrefixes, true)) {
        throw new RuntimeException('SMTP command failed: ' . trim($resp));
    }
    return $resp;
}

function send_mail_smtp(string $to, string $subject, string $text): void
{
    $host = envv('SMTP_HOST', 'smtp.gmail.com');
    $port = (int) (envv('SMTP_PORT', '587') ?? '587');
    $user = envv('SMTP_USER');
    $pass = envv('SMTP_PASS');
    $from = envv('SMTP_FROM', 'Auth App <no-reply@example.com>');
    $secure = strtolower(envv('SMTP_SECURE', 'false') ?? 'false') === 'true';

    if (!$user || !$pass) {
        throw new RuntimeException('SMTP credentials are missing.');
    }

    $transport = $secure ? 'ssl://' . $host : $host;
    $fp = @stream_socket_client($transport . ':' . $port, $errno, $errstr, 15);
    if (!$fp) {
        throw new RuntimeException('SMTP connect failed: ' . $errstr);
    }

    stream_set_timeout($fp, 20);
    $greeting = smtp_read($fp);
    if (substr(trim($greeting), 0, 1) !== '2') {
        fclose($fp);
        throw new RuntimeException('SMTP greeting failed: ' . trim($greeting));
    }

    smtp_cmd($fp, 'EHLO nexl.me');

    if (!$secure) {
        smtp_cmd($fp, 'STARTTLS', ['2']);
        if (!stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
            fclose($fp);
            throw new RuntimeException('Failed to enable TLS for SMTP');
        }
        smtp_cmd($fp, 'EHLO nexl.me');
    }

    smtp_cmd($fp, 'AUTH LOGIN', ['3']);
    smtp_cmd($fp, base64_encode($user), ['3']);
    smtp_cmd($fp, base64_encode($pass), ['2']);

    $fromEmail = $from;
    if (preg_match('/<([^>]+)>/', $from, $m)) {
        $fromEmail = $m[1];
    }

    smtp_cmd($fp, 'MAIL FROM:<' . $fromEmail . '>', ['2']);
    smtp_cmd($fp, 'RCPT TO:<' . $to . '>', ['2', '3']);
    smtp_cmd($fp, 'DATA', ['3']);

    $headers = [];
    $headers[] = 'From: ' . $from;
    $headers[] = 'To: ' . $to;
    $headers[] = 'Subject: ' . $subject;
    $headers[] = 'MIME-Version: 1.0';
    $headers[] = 'Content-Type: text/plain; charset=UTF-8';

    $data = implode("\r\n", $headers) . "\r\n\r\n" . $text . "\r\n.";
    smtp_cmd($fp, $data, ['2']);
    smtp_cmd($fp, 'QUIT', ['2']);

    fclose($fp);
}

function set_cors(): void
{
    $allowed = explode(',', envv('CORS_ORIGIN', 'http://nexl.me') ?? 'http://nexl.me');
    $allowed = array_values(array_filter(array_map('trim', $allowed)));

    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin && in_array($origin, $allowed, true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
    } elseif (!empty($allowed)) {
        header('Access-Control-Allow-Origin: ' . $allowed[0]);
    }

    header('Vary: Origin');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
}

set_cors();

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
if (str_starts_with($path, '/api/')) {
    $path = substr($path, 4);
}

if ($path === '/health' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    json_response(200, [
        'ok' => true,
        'storage' => strtolower(envv('GITHUB_DB_MODE', 'file') ?? 'file') === 'api' ? 'github-api' : 'file',
        'authMode' => 'email-only',
        'timestamp' => now_iso(),
    ]);
}

try {
    $storeMeta = read_store_with_meta();
    $store = $storeMeta['store'];
} catch (Throwable $e) {
    json_response(500, ['message' => 'Storage unavailable: ' . $e->getMessage()]);
}

$body = request_json();

if ($path === '/register' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $resend = (bool) ($body['resend'] ?? false);
    $email = normalize_email((string) ($body['email'] ?? ''));

    if (!is_valid_email($email)) {
        json_response(400, ['message' => 'Enter a valid email.']);
    }

    if ($resend) {
        $idx = -1;
        foreach ($store['pendingSignups'] as $i => $p) {
            if (normalize_email((string) ($p['email'] ?? '')) === $email) {
                $idx = $i;
                break;
            }
        }
        if ($idx < 0) {
            json_response(404, ['message' => 'No pending signup found for this email.']);
        }

        $otp = generate_otp();
        $store['pendingSignups'][$idx]['otpHash'] = password_hash($otp, PASSWORD_BCRYPT);
        $store['pendingSignups'][$idx]['otpExpiresAt'] = gmdate('c', time() + 5 * 60);
        $store['pendingSignups'][$idx]['otpSentAt'] = now_iso();

        write_store($store);
        send_mail_smtp($email, 'Verify Your Account: OTP Code', "Your OTP is: {$otp}. It expires in 5 minutes.");
        json_response(200, ['message' => 'OTP sent to your email.']);
    }

    $username = trim((string) ($body['username'] ?? ''));
    $password = (string) ($body['password'] ?? '');
    $confirmPassword = (string) ($body['confirmPassword'] ?? '');

    if (strlen($username) < 3) {
        json_response(400, ['message' => 'Username must be at least 3 characters.']);
    }

    if (!is_strong_password($password)) {
        json_response(400, ['message' => 'Password must include upper, lower, number, symbol and be 8+ chars.']);
    }

    if ($password !== $confirmPassword) {
        json_response(400, ['message' => 'Passwords do not match.']);
    }

    foreach ($store['users'] as $u) {
        if (normalize_email((string) ($u['email'] ?? '')) === $email) {
            json_response(409, ['message' => 'An account with this email already exists.']);
        }
    }

    $otp = generate_otp();
    $pending = [
        'id' => bin2hex(random_bytes(16)),
        'username' => $username,
        'email' => $email,
        'passwordHash' => password_hash($password, PASSWORD_BCRYPT),
        'otpHash' => password_hash($otp, PASSWORD_BCRYPT),
        'otpExpiresAt' => gmdate('c', time() + 5 * 60),
        'otpSentAt' => now_iso(),
        'createdAt' => now_iso(),
        'updatedAt' => now_iso(),
    ];

    $store['pendingSignups'] = array_values(array_filter(
        $store['pendingSignups'],
        fn($p) => normalize_email((string) ($p['email'] ?? '')) !== $email
    ));
    $store['pendingSignups'][] = $pending;

    write_store($store);
    send_mail_smtp($email, 'Verify Your Account: OTP Code', "Your OTP is: {$otp}. It expires in 5 minutes.");
    json_response(200, ['message' => 'OTP sent to your email.']);
}

if ($path === '/verify-otp' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = normalize_email((string) ($body['email'] ?? ''));
    $otp = trim((string) ($body['otp'] ?? ''));
    $purpose = (string) ($body['purpose'] ?? 'signup');

    if (!is_valid_email($email) || !preg_match('/^\d{6}$/', $otp)) {
        json_response(400, ['message' => 'Invalid email or OTP format.']);
    }

    if ($purpose === 'signup') {
        $idx = -1;
        foreach ($store['pendingSignups'] as $i => $p) {
            if (normalize_email((string) ($p['email'] ?? '')) === $email) {
                $idx = $i;
                break;
            }
        }
        if ($idx < 0) {
            json_response(404, ['message' => 'No pending signup found.']);
        }

        $pending = $store['pendingSignups'][$idx];
        if (strtotime((string) ($pending['otpExpiresAt'] ?? '1970-01-01')) < time()) {
            json_response(400, ['message' => 'OTP expired. Please request a new code.']);
        }

        if (!password_verify($otp, (string) ($pending['otpHash'] ?? ''))) {
            json_response(400, ['message' => 'Invalid OTP.']);
        }

        $user = [
            'id' => bin2hex(random_bytes(16)),
            'username' => $pending['username'],
            'email' => $email,
            'passwordHash' => $pending['passwordHash'],
            'authMethod' => 'email',
            'verifiedAt' => now_iso(),
            'createdAt' => now_iso(),
            'updatedAt' => now_iso(),
        ];

        $store['users'] = array_values(array_filter(
            $store['users'],
            fn($u) => normalize_email((string) ($u['email'] ?? '')) !== $email
        ));
        $store['users'][] = $user;
        array_splice($store['pendingSignups'], $idx, 1);

        write_store($store);
        json_response(200, ['message' => 'Email verified successfully.']);
    }

    if ($purpose === 'reset_password') {
        $idx = -1;
        foreach ($store['passwordResets'] as $i => $r) {
            if (normalize_email((string) ($r['email'] ?? '')) === $email) {
                $idx = $i;
                break;
            }
        }

        if ($idx < 0) {
            json_response(404, ['message' => 'No reset request found.']);
        }

        $reset = $store['passwordResets'][$idx];
        if (strtotime((string) ($reset['otpExpiresAt'] ?? '1970-01-01')) < time()) {
            json_response(400, ['message' => 'OTP expired. Please request a new code.']);
        }

        if (!password_verify($otp, (string) ($reset['otpHash'] ?? ''))) {
            json_response(400, ['message' => 'Invalid OTP.']);
        }

        $ttl = parse_duration_seconds((string) envv('RESET_TOKEN_EXPIRES_IN', '10m'));
        $token = bin2hex(random_bytes(24));
        $store['passwordResets'][$idx]['resetToken'] = $token;
        $store['passwordResets'][$idx]['resetTokenExpiresAt'] = gmdate('c', time() + $ttl);
        write_store($store);

        json_response(200, ['message' => 'OTP verified.', 'resetToken' => $token]);
    }

    json_response(400, ['message' => 'Unknown OTP purpose.']);
}

if ($path === '/login' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = normalize_email((string) ($body['email'] ?? ''));
    $password = (string) ($body['password'] ?? '');

    $user = null;
    foreach ($store['users'] as $u) {
        if (normalize_email((string) ($u['email'] ?? '')) === $email) {
            $user = $u;
            break;
        }
    }

    if (!$user || !password_verify($password, (string) ($user['passwordHash'] ?? ''))) {
        json_response(401, ['message' => 'Invalid email or password.']);
    }

    $token = bin2hex(random_bytes(24));
    json_response(200, [
        'token' => $token,
        'user' => [
            'id' => $user['id'],
            'username' => $user['username'],
            'email' => $user['email'],
            'authMethod' => 'email',
        ],
    ]);
}

if ($path === '/forgot-password' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = normalize_email((string) ($body['email'] ?? ''));
    if (!is_valid_email($email)) {
        json_response(400, ['message' => 'Enter a valid email.']);
    }

    $exists = false;
    foreach ($store['users'] as $u) {
        if (normalize_email((string) ($u['email'] ?? '')) === $email) {
            $exists = true;
            break;
        }
    }

    if (!$exists) {
        json_response(200, ['message' => 'If this email exists, OTP has been sent.']);
    }

    $otp = generate_otp();
    $reset = [
        'id' => bin2hex(random_bytes(16)),
        'email' => $email,
        'otpHash' => password_hash($otp, PASSWORD_BCRYPT),
        'otpExpiresAt' => gmdate('c', time() + 5 * 60),
        'otpSentAt' => now_iso(),
        'updatedAt' => now_iso(),
    ];

    $store['passwordResets'] = array_values(array_filter(
        $store['passwordResets'],
        fn($r) => normalize_email((string) ($r['email'] ?? '')) !== $email
    ));
    $store['passwordResets'][] = $reset;

    write_store($store);
    send_mail_smtp($email, 'Reset Your Password: OTP Code', "Your password reset OTP is: {$otp}. It expires in 5 minutes.");
    json_response(200, ['message' => 'If this email exists, OTP has been sent.']);
}

if ($path === '/reset-password' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = normalize_email((string) ($body['email'] ?? ''));
    $resetToken = (string) ($body['resetToken'] ?? '');
    $password = (string) ($body['password'] ?? '');
    $confirmPassword = (string) ($body['confirmPassword'] ?? '');

    if (!is_strong_password($password)) {
        json_response(400, ['message' => 'Password must include upper, lower, number, symbol and be 8+ chars.']);
    }

    if ($password !== $confirmPassword) {
        json_response(400, ['message' => 'Passwords do not match.']);
    }

    $resetIdx = -1;
    foreach ($store['passwordResets'] as $i => $r) {
        if (normalize_email((string) ($r['email'] ?? '')) === $email) {
            $resetIdx = $i;
            break;
        }
    }

    if ($resetIdx < 0) {
        json_response(404, ['message' => 'No reset request found.']);
    }

    $reset = $store['passwordResets'][$resetIdx];
    if (($reset['resetToken'] ?? '') !== $resetToken) {
        json_response(401, ['message' => 'Invalid reset session.']);
    }

    if (strtotime((string) ($reset['resetTokenExpiresAt'] ?? '1970-01-01')) < time()) {
        json_response(401, ['message' => 'Invalid or expired reset session.']);
    }

    $userIdx = -1;
    foreach ($store['users'] as $i => $u) {
        if (normalize_email((string) ($u['email'] ?? '')) === $email) {
            $userIdx = $i;
            break;
        }
    }

    if ($userIdx < 0) {
        json_response(404, ['message' => 'User not found.']);
    }

    $store['users'][$userIdx]['passwordHash'] = password_hash($password, PASSWORD_BCRYPT);
    $store['users'][$userIdx]['updatedAt'] = now_iso();
    array_splice($store['passwordResets'], $resetIdx, 1);

    write_store($store);
    json_response(200, ['message' => 'Password reset successful.']);
}

json_response(404, ['message' => 'Not found']);
