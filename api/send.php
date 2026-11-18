<?php
// POST /api/send on Hostinger (obelum.ae). Same contract as api/send.js on
// Vercel: the browser posts JSON, this emails it to INBOX and answers
// {"success": bool, "message": string}. Hostinger cannot run the Node
// function, so .htaccess routes /api/send here. Sent with PHP mail(), so it
// does not depend on FormSubmit at all.

const INBOX = 'obelumgroup@gmail.com';
const FROM  = 'no-reply@obelum.ae';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

// The previews (GitHub Pages, Vercel) are static or separate sites, so their
// forms post here. Allow only those origins to call this endpoint.
$ALLOWED_ORIGINS = ['https://obelum-website.github.io', 'https://obelum.vercel.app'];
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
$lines[] = 'Sent from ' . (isset($_SERVER['HTTP_REFERER']) ? $_SERVER['HTTP_REFERER'] : 'obelum.ae');

$headers  = 'From: Obelum Website <' . FROM . ">\r\n";
$headers .= 'Reply-To: ' . $fields['email'] . "\r\n";
$headers .= "Content-Type: text/plain; charset=UTF-8\r\n";

$ok = @mail(INBOX, '=?UTF-8?B?' . base64_encode($subject) . '?=', implode("\n", $lines), $headers, '-f' . FROM);
if (!$ok) error_log('Obelum form: mail() failed for ' . $kind);
reply($ok, $ok ? 'Sent.' : 'The email service did not accept it.', $ok ? 200 : 502);
