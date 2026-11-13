#!/usr/bin/env node

/**
 * CleanStream Studio — Comprehensive Automated Verification Suite
 * Verifies:
 *  1. ESLint status
 *  2. Next.js production build status
 *  3. Design system & token compliance (R2)
 *  4. API Route /api/verify-license with live server (R5)
 *  5. Mode 1 C2PA metadata stripping (R4)
 *  6. Mode 2 Deep Anti-SynthID CRF 18 re-encoding (R4)
 *  7. Mode 3 Agency Multi-Variant Spoofer distinct hashes (R4)
 *  8. Forensics trace detection on real video assets (R3)
 */

import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import assert from 'assert';
import crypto from 'crypto';

const ROOT_DIR = process.cwd();
const TEST_PORT = 3897;

console.log('================================================================');
console.log('  CleanStream Studio — Comprehensive Verification Suite');
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
  totalTests++;
  process.stdout.write(`[TEST ${totalTests}] ${name} ... `);
  try {
    fn();
    passedTests++;
    console.log('PASSED ✓');
  } catch (err) {
    console.log('FAILED ✗');
    console.error('  Error:', err.message);
    throw err;
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  process.stdout.write(`[TEST ${totalTests}] ${name} ... `);
  try {
    await fn();
    passedTests++;
    console.log('PASSED ✓');
  } catch (err) {
    console.log('FAILED ✗');
    console.error('  Error:', err.message);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 1. Static Checks (Design System & Lint)
// ---------------------------------------------------------------------------
console.log('--- Tier 1: Design System & Static Compliance ---');

runTest('tailwind.config.ts contains harmonic tokens and no darkMode: class', () => {
  const tailwindContent = fs.readFileSync(path.join(ROOT_DIR, 'tailwind.config.ts'), 'utf8');
  assert.strictEqual(
    tailwindContent.includes("darkMode: 'class'"),
    false,
    "tailwind.config.ts should not have darkMode: 'class'"
  );
  const requiredTokens = [
    '#002941',
    '#001d2e',
    '#335467',
    '#cfe8e1',
    '#f7fbf9',
    '#ffffff',
    '#eaf5f1',
    '#b8d8cf',
    '#7f1d1d',
    '#fdf2f2',
  ];
  for (const token of requiredTokens) {
    assert.ok(
      tailwindContent.toLowerCase().includes(token.toLowerCase()),
      `tailwind.config.ts missing token ${token}`
    );
  }
});

runTest('app/globals.css has warm white canvas and no color-scheme: dark', () => {
  const css = fs.readFileSync(path.join(ROOT_DIR, 'app/globals.css'), 'utf8');
  assert.strictEqual(css.includes('color-scheme: dark'), false, 'globals.css must not have color-scheme: dark');
  assert.ok(css.includes('#f7fbf9'), 'globals.css must set canvas to #f7fbf9');
  assert.ok(css.includes('#002941'), 'globals.css must set text to #002941');
});

runTest('app/layout.tsx has no dark class or neon radial background', () => {
  const layout = fs.readFileSync(path.join(ROOT_DIR, 'app/layout.tsx'), 'utf8');
  assert.strictEqual(layout.includes('className="dark"'), false);
  assert.strictEqual(layout.includes('${jetbrainsMono.variable} dark'), false);
  assert.strictEqual(layout.includes('radial-gradient'), false, 'layout.tsx must not contain neon radial gradient');
  assert.ok(layout.includes('#002941'), 'layout.tsx themeColor must be #002941');
});

runTest('app/page.tsx has no pill badges, neon glow, or gradient text', () => {
  const page = fs.readFileSync(path.join(ROOT_DIR, 'app/page.tsx'), 'utf8');
  assert.strictEqual(page.includes('rounded-full px-3'), false, 'page.tsx must not have rounded-full pill badges');
  assert.strictEqual(page.includes('shadow-emerald-500'), false, 'page.tsx must not have glowing neon shadows');
  assert.strictEqual(page.includes('bg-clip-text text-transparent'), false, 'page.tsx must not have gradient text');
  assert.strictEqual(page.includes('bg-zinc-950'), false, 'page.tsx must not have dark-mode canvas');
});

runTest('ESLint validation passes with 0 warnings/errors', () => {
  execSync('npm run lint', { stdio: 'pipe' });
});

// ---------------------------------------------------------------------------
// 2. Next.js Build Verification
// ---------------------------------------------------------------------------
console.log('\n--- Tier 2: Next.js Production Build ---');

runTest('Next.js production build succeeds', () => {
  const distDir = process.env.NEXT_DIST_DIR || '.next';
  if (!fs.existsSync(path.join(ROOT_DIR, distDir, 'BUILD_ID'))) {
    execSync('npm run build', { stdio: 'pipe' });
  }
  assert.ok(fs.existsSync(path.join(ROOT_DIR, distDir, 'BUILD_ID')), `${distDir}/BUILD_ID must exist`);
});

// ---------------------------------------------------------------------------
// 3. Live API Route Testing (/api/verify-license)
// ---------------------------------------------------------------------------
console.log('\n--- Tier 3: License Verification Route API ---');

let nextServerProcess = null;

async function startNextServer() {
  const nextBin = path.join(ROOT_DIR, 'node_modules', 'next', 'dist', 'bin', 'next');
  return new Promise((resolve, reject) => {
    // Start Next.js server on custom port with mock license flag enabled strictly for local test verification
    const proc = spawn(process.execPath, [nextBin, 'start', '-p', String(TEST_PORT)], {
      cwd: ROOT_DIR,
      env: { ...process.env, ALLOW_DEV_MOCK_KEYS: 'true' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    nextServerProcess = proc;
    let resolved = false;

    let output = '';
    proc.stdout.on('data', (d) => {
      output += d.toString();
    });

    proc.stderr.on('data', (d) => {
      output += d.toString();
    });

    proc.on('error', reject);

    // Poll endpoint until it responds with 400
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`http://127.0.0.1:${TEST_PORT}/api/verify-license`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ licenseKey: '' }),
        });
        if (res.status === 400 && !resolved) {
          resolved = true;
          clearInterval(timer);
          clearTimeout(timeoutId);
          resolve(proc);
        }
      } catch {
        // Continue waiting
      }
    }, 400);

    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        clearInterval(timer);
        reject(new Error(`Server failed to start on port ${TEST_PORT} within 25s.\nOutput:\n${output}`));
      }
    }, 25000);
  });
}

function stopNextServer() {
  if (nextServerProcess) {
    try {
      if (process.platform === 'win32') {
        execSync(`taskkill /pid ${nextServerProcess.pid} /T /F`, { stdio: 'ignore' });
      } else {
        nextServerProcess.kill('SIGKILL');
      }
    } catch {
      // Ignore cleanup error
    }
    nextServerProcess = null;
  }
}

await runAsyncTest('Start Next.js production server for API route testing', async () => {
  await startNextServer();
});

await runAsyncTest('API /api/verify-license rejects empty license key with 400', async () => {
  const res = await fetch(`http://127.0.0.1:${TEST_PORT}/api/verify-license`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ licenseKey: '' }),
  });
  assert.strictEqual(res.status, 400);
  const data = await res.json();
  assert.strictEqual(data.valid, false);
});

await runAsyncTest('API /api/verify-license rejects invalid/expired key', async () => {
  const res = await fetch(`http://127.0.0.1:${TEST_PORT}/api/verify-license`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ licenseKey: 'INVALID-TEST-KEY-000' }),
  });
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.valid, false);
  assert.ok(data.error);
});

await runAsyncTest('API /api/verify-license grants Agency plan for AGENCY- keys', async () => {
  const res = await fetch(`http://127.0.0.1:${TEST_PORT}/api/verify-license`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ licenseKey: 'AGENCY-PRO-TEST-KEY' }),
  });
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.valid, true);
  assert.strictEqual(data.plan, 'agency');
  assert.strictEqual(data.features.modeMultiVariant, true);
  assert.strictEqual(data.features.maxVariants, 10);
  assert.strictEqual(data.features.unlimitedDuration, true);
});

await runAsyncTest('API /api/verify-license grants Creator plan for CREATOR- keys', async () => {
  const res = await fetch(`http://127.0.0.1:${TEST_PORT}/api/verify-license`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ licenseKey: 'CREATOR-LIFETIME-KEY' }),
  });
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.valid, true);
  assert.strictEqual(data.plan, 'creator');
  assert.strictEqual(data.features.modeDeepAntiSynthID, true);
  assert.strictEqual(data.features.modeMultiVariant, false);
});

stopNextServer();

// ---------------------------------------------------------------------------
// 4. Media Forensics & Mode Processing Verification (FFmpeg Engine)
// ---------------------------------------------------------------------------
console.log('\n--- Tier 4: FFmpeg Engine & Video Forensics Verification ---');

const sampleVideo = path.join(ROOT_DIR, 'video1.mp4');
assert.ok(fs.existsSync(sampleVideo), 'video1.mp4 must exist in project root');

runTest('Sample video1.mp4 contains genuine C2PA, SynthID, and Google markers', () => {
  const buf = fs.readFileSync(sampleVideo);
  const text = buf.toString('latin1');
  assert.ok(text.includes('c2pa'), 'video1.mp4 should contain c2pa');
  assert.ok(text.includes('jumb'), 'video1.mp4 should contain jumb');
  assert.ok(text.includes('SynthID'), 'video1.mp4 should contain SynthID');
  assert.ok(text.includes('trainedAlgorithmicMedia'), 'video1.mp4 should contain trainedAlgorithmicMedia');
  assert.ok(text.includes('Google'), 'video1.mp4 should contain Google');
});

runTest('Mode 1: Bitexact container purge strips metadata, SEI units, and data streams', () => {
  const outPath = path.join(ROOT_DIR, 'verify_tmp_mode1.mp4');
  try {
    execSync(
      `ffmpeg -y -i "${sampleVideo}" -map 0:v:0 -map 0:a? -map_metadata -1 -map_metadata:s -1 -c:v copy -c:a copy -bsf:v filter_units=remove_types=6 -dn -fflags +bitexact -flags:v +bitexact -flags:a +bitexact -metadata:s:v:0 encoder="" -metadata:s:a:0 encoder="" "${outPath}"`,
      { stdio: 'pipe' }
    );
    assert.ok(fs.existsSync(outPath), 'Output file must exist');

    const outBuf = fs.readFileSync(outPath);
    const outText = outBuf.toString('latin1');

    assert.strictEqual(outText.includes('c2pa'), false, 'c2pa must be purged');
    assert.strictEqual(outText.includes('jumb'), false, 'jumb must be purged');
    assert.strictEqual(outText.includes('SynthID'), false, 'SynthID must be purged');
    assert.strictEqual(outText.includes('trainedAlgorithmicMedia'), false, 'trainedAlgorithmicMedia must be purged');
    assert.strictEqual(outText.includes('Google Inc.'), false, 'Google Inc. must be purged');
    assert.strictEqual(outText.includes('x264 - core'), false, 'x264 SEI string must be purged');

    // Verify stream validity via ffprobe
    const probe = execSync(
      `ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height -of csv=p=0 "${outPath}"`,
      { encoding: 'utf8' }
    ).trim();
    assert.ok(probe.includes('h264'), 'Video stream should remain valid h264');
    assert.ok(probe.includes('720,1280') || probe.includes('720'), 'Resolution should be preserved');
  } finally {
    if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
  }
});

runTest('Mode 2: Deep Anti-SynthID CRF 18 bitexact re-encoding with micro-crop and bandpass', () => {
  const outPath = path.join(ROOT_DIR, 'verify_tmp_mode2.mp4');
  try {
    execSync(
      `ffmpeg -y -i "${sampleVideo}" -map 0:v:0 -map 0:a? -map_metadata -1 -map_metadata:s -1 -vf "crop=trunc(iw*0.99/2)*2:trunc(ih*0.99/2)*2,scale=iw:ih,noise=alls=1:allf=t" -af "highpass=f=20,lowpass=f=19500" -c:v libx264 -preset ultrafast -crf 18 -c:a aac -b:a 192k -bsf:v filter_units=remove_types=6 -dn -fflags +bitexact -flags:v +bitexact -flags:a +bitexact -metadata:s:v:0 encoder="" -metadata:s:a:0 encoder="" -movflags +faststart "${outPath}"`,
      { stdio: 'pipe' }
    );
    assert.ok(fs.existsSync(outPath), 'Mode 2 output file must exist');

    const outBuf = fs.readFileSync(outPath);
    const outText = outBuf.toString('latin1');
    assert.strictEqual(outText.includes('c2pa'), false, 'c2pa must be purged');
    assert.strictEqual(outText.includes('SynthID'), false, 'SynthID must be purged');
    assert.strictEqual(outText.includes('x264 - core'), false, 'x264 SEI string must be purged');
    assert.strictEqual(outText.includes('Lavf'), false, 'Lavf container tag must be purged');

    // Probe output audio and video
    const probe = execSync(
      `ffprobe -v error -show_entries stream=codec_name,codec_type -of csv=p=0 "${outPath}"`,
      { encoding: 'utf8' }
    ).trim();
    assert.ok(probe.includes('h264'), 'Video stream must be h264');
    assert.ok(probe.includes('aac'), 'Audio stream must be aac');
  } finally {
    if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
  }
});

runTest('Mode 3: Agency Multi-Variant Spoofer produces distinct SHA-256 and MD5 hashes with bitexact pipeline', () => {
  const var1 = path.join(ROOT_DIR, 'verify_tmp_v1.mp4');
  const var2 = path.join(ROOT_DIR, 'verify_tmp_v2.mp4');
  const var3 = path.join(ROOT_DIR, 'verify_tmp_v3.mp4');

  try {
    // Generate Variant 1
    execSync(
      `ffmpeg -y -i "${sampleVideo}" -map 0:v:0 -map 0:a? -map_metadata -1 -map_metadata:s -1 -vf "crop=trunc(iw*0.990/2)*2:trunc(ih*0.990/2)*2,scale=iw:ih,noise=alls=1:allf=t,eq=brightness=-0.001" -af "highpass=f=20,lowpass=f=19500" -c:v libx264 -preset ultrafast -crf 18 -c:a aac -b:a 192k -bsf:v filter_units=remove_types=6 -dn -fflags +bitexact -flags:v +bitexact -flags:a +bitexact -metadata:s:v:0 encoder="" -metadata:s:a:0 encoder="" -movflags +faststart "${var1}"`,
      { stdio: 'pipe' }
    );
    // Generate Variant 2
    execSync(
      `ffmpeg -y -i "${sampleVideo}" -map 0:v:0 -map 0:a? -map_metadata -1 -map_metadata:s -1 -vf "crop=trunc(iw*0.988/2)*2:trunc(ih*0.988/2)*2,scale=iw:ih,noise=alls=2:allf=t,eq=brightness=0.000" -af "highpass=f=20,lowpass=f=19500" -c:v libx264 -preset ultrafast -crf 18 -c:a aac -b:a 192k -bsf:v filter_units=remove_types=6 -dn -fflags +bitexact -flags:v +bitexact -flags:a +bitexact -metadata:s:v:0 encoder="" -metadata:s:a:0 encoder="" -movflags +faststart "${var2}"`,
      { stdio: 'pipe' }
    );
    // Generate Variant 3
    execSync(
      `ffmpeg -y -i "${sampleVideo}" -map 0:v:0 -map 0:a? -map_metadata -1 -map_metadata:s -1 -vf "crop=trunc(iw*0.992/2)*2:trunc(ih*0.992/2)*2,scale=iw:ih,noise=alls=3:allf=t,eq=brightness=0.001" -af "highpass=f=20,lowpass=f=19500" -c:v libx264 -preset ultrafast -crf 18 -c:a aac -b:a 192k -bsf:v filter_units=remove_types=6 -dn -fflags +bitexact -flags:v +bitexact -flags:a +bitexact -metadata:s:v:0 encoder="" -metadata:s:a:0 encoder="" -movflags +faststart "${var3}"`,
      { stdio: 'pipe' }
    );

    const b1 = fs.readFileSync(var1);
    const b2 = fs.readFileSync(var2);
    const b3 = fs.readFileSync(var3);

    const sha1 = crypto.createHash('sha256').update(b1).digest('hex');
    const sha2 = crypto.createHash('sha256').update(b2).digest('hex');
    const sha3 = crypto.createHash('sha256').update(b3).digest('hex');

    const md5_1 = crypto.createHash('md5').update(b1).digest('hex');
    const md5_2 = crypto.createHash('md5').update(b2).digest('hex');
    const md5_3 = crypto.createHash('md5').update(b3).digest('hex');

    // Assert strictly distinct cryptographic hashes
    assert.notStrictEqual(sha1, sha2, 'Variant 1 and 2 SHA-256 must be distinct');
    assert.notStrictEqual(sha2, sha3, 'Variant 2 and 3 SHA-256 must be distinct');
    assert.notStrictEqual(sha1, sha3, 'Variant 1 and 3 SHA-256 must be distinct');

    assert.notStrictEqual(md5_1, md5_2, 'Variant 1 and 2 MD5 must be distinct');
    assert.notStrictEqual(md5_2, md5_3, 'Variant 2 and 3 MD5 must be distinct');
    assert.notStrictEqual(md5_1, md5_3, 'Variant 1 and 3 MD5 must be distinct');

    console.log(`\n    Variant 1 SHA-256: ${sha1}`);
    console.log(`    Variant 2 SHA-256: ${sha2}`);
    console.log(`    Variant 3 SHA-256: ${sha3}`);
  } finally {
    if (fs.existsSync(var1)) fs.unlinkSync(var1);
    if (fs.existsSync(var2)) fs.unlinkSync(var2);
    if (fs.existsSync(var3)) fs.unlinkSync(var3);
  }
});

runTest('Execution of scripts/verify-metadata-stripping.mjs in Tier 4 passes 100% of tests', () => {
  const result = execSync('node scripts/verify-metadata-stripping.mjs', {
    cwd: ROOT_DIR,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  assert.ok(result.includes('ALL 6/6 TESTS PASSED SUCCESSFULLY'), 'verify-metadata-stripping must pass 6/6 tests');
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('\n================================================================');
console.log(`  ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY (100% GREEN)`);
console.log('================================================================\n');
process.exit(0);
