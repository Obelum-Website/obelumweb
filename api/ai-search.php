<?php
// POST /api/ai-search on Hostinger: {"q": "2 bed off-plan in Business Bay under 2.5M"}
// answers {"filters": {...}, "note": "..."} using Claude to read the sentence.
// The browser falls back to its own parser if this fails, so a missing key
// only switches the AI off; search keeps working.
//
// API key: put it OUTSIDE public_html so it is never served, in a file named
// obelum-secrets.php next to public_html:
//   <?php define('ANTHROPIC_API_KEY', 'sk-ant-...');
// (or set the ANTHROPIC_API_KEY environment variable).

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$ALLOWED_ORIGINS = ['https://obelum-website.github.io', 'https://obelum.ae', 'https://www.obelum.ae'];
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
if (in_array($origin, $ALLOWED_ORIGINS, true)) {
  header('Access-Control-Allow-Origin: ' . $origin);
  header('Vary: Origin');
  header('Access-Control-Allow-Methods: POST, OPTIONS');
  header('Access-Control-Allow-Headers: Content-Type');
  header('Access-Control-Max-Age: 86400');
}
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

function out($data, $code = 200) { http_response_code($code); echo json_encode($data); exit; }

if ($_SERVER['REQUEST_METHOD'] !== 'POST') out(['error' => 'Use POST.'], 405);

$secrets = dirname(__DIR__, 2) . '/obelum-secrets.php';
if (is_file($secrets)) require_once $secrets;
$key = defined('ANTHROPIC_API_KEY') ? ANTHROPIC_API_KEY : getenv('ANTHROPIC_API_KEY');
if (!$key) out(['error' => 'AI search is not configured.'], 503);

$body = json_decode(file_get_contents('php://input'), true);
$q = trim(mb_substr((string)($body['q'] ?? ''), 0, 300));
if ($q === '') out(['error' => 'Empty query.'], 400);

// Where counters and remembered answers live: outside the public website.
$dir = dirname(__DIR__, 2) . '/obelum-ai-usage';
if (!is_dir($dir) && !@mkdir($dir, 0700, true)) $dir = sys_get_temp_dir();

// Remembered answers: the same sentence gets the saved filters (30 days), costs nothing and counts for nothing.
$norm = preg_replace('/\s+/', ' ', mb_strtolower($q));
$cacheFile = $dir . '/answer-' . md5($norm) . '.json';
if (is_file($cacheFile) && filemtime($cacheFile) > time() - 30 * 86400) {
  $hit = json_decode((string)@file_get_contents($cacheFile), true);
  if (is_array($hit)) out($hit + ['cached' => true]);
}

// Per visitor: 10 AI searches per 10 minutes and 40 per day. Past that the page uses its built-in reader.
$ip = $_SERVER['REMOTE_ADDR'] ?? 'x';
foreach ([[600, 10], [86400, 40]] as [$win, $max]) {
  $bucket = $dir . '/ip-' . md5($ip . '|' . $win . '|' . floor(time() / $win)) . '.txt';
  $n = (int)@file_get_contents($bucket);
  if ($n >= $max) out(['error' => 'Too many searches, try again later.'], 429);
  @file_put_contents($bucket, $n + 1);
}
if (mt_rand(1, 200) === 1) foreach ((array)glob($dir . '/ip-*.txt') as $old) if (filemtime($old) < time() - 2 * 86400) @unlink($old);

// Daily cap for the whole site: past it, the AI is skipped until midnight (Dubai time) and the
// page quietly uses its built-in reader instead. Default 2,000 a day; to change it, add
//   define('AI_DAILY_CAP', 3000);
// to obelum-secrets.php.
$cap = defined('AI_DAILY_CAP') ? (int)AI_DAILY_CAP : 2000;
$day = (new DateTime('now', new DateTimeZone('Asia/Dubai')))->format('Y-m-d');
$fh = @fopen($dir . '/ai-searches-' . $day . '.txt', 'c+');
if ($fh) {
  flock($fh, LOCK_EX);
  $used = (int)stream_get_contents($fh);
  if ($used >= $cap) { flock($fh, LOCK_UN); fclose($fh); out(['error' => 'Daily AI limit reached.'], 429); }
  ftruncate($fh, 0); rewind($fh); fwrite($fh, (string)($used + 1)); fflush($fh);
  flock($fh, LOCK_UN); fclose($fh);
}

$system = <<<TXT
You turn a property search sentence (any language) into filters for a UAE off-plan and ready project database. Reply with ONE JSON object only, no prose, using only these optional keys:
- "loc": area, community or emirate as people write it in English (e.g. "Business Bay", "Dubai Marina", "JVC", "Palm Jumeirah", "Dubai Hills", "Abu Dhabi", "Ras al-Khaimah"). Several areas: comma separated.
- "type": one of "Apartments","Villa","Townhouse","Penthouse","Duplex","Office","Retail"
- "beds": number of bedrooms as a string, "0" for studio, "5" for five or more
- "pmin", "pmax": price in AED as integers ("2.5M" = 2500000; convert USD at 3.67)
- "status": "offplan" or "ready"
- "dev": developer name (e.g. "Emaar", "Sobha", "Binghatti", "DAMAC", "Ellington")
- "year": latest acceptable handover year as a string (implies offplan)
- "note": a short phrase (max 12 words) for anything you could not express as a filter
Leave out anything not asked for. Do not invent constraints.
TXT;

$payload = [
  'model' => 'claude-haiku-5-5',
  'max_tokens' => 300,
  'system' => $system,
  'messages' => [['role' => 'user', 'content' => $q]],
];

$ch = curl_init('https://api.anthropic.com/v1/messages');
curl_setopt_array($ch, [
  CURLOPT_POST => true,
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_TIMEOUT => 8,
  CURLOPT_HTTPHEADER => [
    'content-type: application/json',
    'x-api-key: ' . $key,
    'anthropic-version: 2023-06-01',
  ],
  CURLOPT_POSTFIELDS => json_encode($payload),
]);
$res = curl_exec($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);
if ($res === false || $code !== 200) out(['error' => 'AI unavailable.'], 502);

$j = json_decode($res, true);
$text = $j['content'][0]['text'] ?? '';
if (!preg_match('/\{.*\}/s', $text, $m)) out(['error' => 'Could not read the answer.'], 502);
$raw = json_decode($m[0], true);
if (!is_array($raw)) out(['error' => 'Could not read the answer.'], 502);

// Keep only known keys with sane values.
$f = [];
$types = ['Apartments', 'Villa', 'Townhouse', 'Penthouse', 'Duplex', 'Office', 'Retail'];
if (!empty($raw['loc']))  $f['loc'] = mb_substr((string)$raw['loc'], 0, 80);
if (!empty($raw['type']) && in_array($raw['type'], $types, true)) $f['type'] = $raw['type'];
if (isset($raw['beds']) && preg_match('/^[0-5]$/', (string)$raw['beds'])) $f['beds'] = (string)$raw['beds'];
foreach (['pmin', 'pmax'] as $k) if (!empty($raw[$k]) && is_numeric($raw[$k]) && $raw[$k] > 0) $f[$k] = (int)$raw[$k];
if (!empty($raw['status']) && in_array($raw['status'], ['offplan', 'ready'], true)) $f['status'] = $raw['status'];
if (!empty($raw['dev']))  $f['dev'] = mb_substr((string)$raw['dev'], 0, 60);
if (!empty($raw['year']) && preg_match('/^20\d\d$/', (string)$raw['year'])) { $f['year'] = (string)$raw['year']; }

$answer = ['filters' => $f, 'note' => mb_substr((string)($raw['note'] ?? ''), 0, 120)];
@file_put_contents($cacheFile, json_encode($answer));
out($answer);
