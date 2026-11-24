<?php
// POST /api/send on Hostinger (obelum.ae): the browser posts JSON, this emails
// it to INBOX and answers {"success": bool, "message": string}. .htaccess
// routes /api/send here. Sent with PHP mail().

const INBOX = 'obelumgroup@gmail.com';
const FROM  = 'no-reply@obelum.ae';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

// The preview (GitHub Pages) is static, so its forms post here. Allow only those origins to call this endpoint.
$ALLOWED_ORIGINS = ['https://obelum-website.github.io', 'https://obelum.ae', 'https://www.obelum.ae'];
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
if (in_array($origin, $ALLOWED_ORIGINS, true)) {
  header('Access-Control-Allow-Origin: ' . $origin);
  header('Vary: Origin');
  header('Access-Control-Allow-Methods: POST, OPTIONS');
  header('Access-Control-Allow-Headers: Content-Type, Accept');
  header('Access-Control-Max-Age: 86400');
}
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

function reply($ok, $message, $code = 200) {
  http_response_code($code);
  echo json_encode(['success' => $ok, 'message' => $message]);
  exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  header('Allow: POST');
  reply(false, 'Use POST.', 405);
}

// Only our own pages may send (browsers always add Origin to a POST); scripts calling this directly are refused.
if (!in_array($origin, $ALLOWED_ORIGINS, true)) reply(false, 'Not allowed.', 403);

// Per visitor: 5 messages per 10 minutes and 15 per day, so nobody can flood the inbox.
$dir = dirname(__DIR__, 2) . '/obelum-form-usage';
if (!is_dir($dir) && !@mkdir($dir, 0700, true)) $dir = sys_get_temp_dir();
$ip = $_SERVER['REMOTE_ADDR'] ?? 'x';
foreach ([[600, 5], [86400, 15]] as [$win, $max]) {
  $bucket = $dir . '/ip-' . md5($ip . '|' . $win . '|' . floor(time() / $win)) . '.txt';
  $n = (int)@file_get_contents($bucket);
  if ($n >= $max) reply(false, 'Too many messages, please try again later or WhatsApp us.', 429);
  @file_put_contents($bucket, $n + 1);
}
if (mt_rand(1, 100) === 1) foreach ((array)glob($dir . '/ip-*.txt') as $old) if (filemtime($old) < time() - 2 * 86400) @unlink($old);

// Body size limit (forms are a few hundred bytes).
if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 20000) reply(false, 'Too large.', 413);

$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body)) $body = $_POST;

$FIELDS = [
  'contact' => ['name', 'email', 'phone', 'about', 'message'],
  'brief'   => ['Looking to', 'name', 'email', 'phone', 'community'],
  'signup'  => ['email'],
];
$kind = isset($body['_form']) ? $body['_form'] : '';
if (!isset($FIELDS[$kind])) reply(false, 'Unknown form.', 400);

// Honeypot: people never see this field, bots fill it. Pretend it worked.
if (!empty($body['_honey'])) reply(true, 'Sent.');

$clean = function ($v, $key) {
  $v = trim(str_replace(["\r", "\0"], '', (string)($v ?? '')));
  return mb_substr($v, 0, $key === 'message' ? 2000 : 200);
};

$fields = [];
foreach ($FIELDS[$kind] as $k) $fields[$k] = $clean(isset($body[$k]) ? $body[$k] : '', $k);
if (!filter_var($fields['email'], FILTER_VALIDATE_EMAIL)) reply(false, 'Please enter a valid email.', 400);

$subject = $clean(isset($body['_subject']) ? $body['_subject'] : '', '_subject');
if ($subject === '') $subject = 'Website form';
$subject = preg_replace('/[\r\n]+/', ' ', $subject);

$lines = [];
foreach ($fields as $k => $v) $lines[] = ucfirst($k) . ': ' . $v;
$lines[] = '';
$lines[] = 'Sent from ' . mb_substr(preg_replace('/[\r\n]+/', ' ', isset($_SERVER['HTTP_REFERER']) ? $_SERVER['HTTP_REFERER'] : 'obelum.ae'), 0, 300);

$headers  = 'From: Obelum Website <' . FROM . ">\r\n";
$headers .= 'Reply-To: ' . $fields['email'] . "\r\n";
$headers .= "Content-Type: text/plain; charset=UTF-8\r\n";

$ok = @mail(INBOX, '=?UTF-8?B?' . base64_encode($subject) . '?=', implode("\n", $lines), $headers, '-f' . FROM);
if (!$ok) error_log('Obelum form: mail() failed for ' . $kind);
reply($ok, $ok ? 'Sent.' : 'The email service did not accept it.', $ok ? 200 : 502);
