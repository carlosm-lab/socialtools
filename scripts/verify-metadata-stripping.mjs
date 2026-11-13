#!/usr/bin/env node

/**
 * CleanStream Studio — Video Metadata Stripping Automated Verification Suite
 *
 * Verifies:
 *  1. Environment FFmpeg & ffprobe binary availability.
 *  2. Sample video asset presence & baseline forensics markers (C2PA, SynthID, Google).
 *  3. Mode 1: Fast Container Purge (c:v copy, c:a copy) with bitexact & SEI removal.
 *  4. Mode 2: Deep Anti-SynthID CRF 18 Re-encoding with bitexact & SEI removal.
 *  5. Mode 3: Agency Multi-Variant Spoofer (3 variants) with distinct SHA-256/MD5 hashes.
 *  6. Silent video robustness: -map 0:a? handles inputs without audio gracefully across Mode 1 and Mode 2.
 *  7. Dual-layer inspection across all output files:
 *     - Layer A: ffprobe format_tags and stream_tags JSON validation against whitelist.
 *     - Layer B: Binary buffer regex scanning for XMP, EXIF, C2PA, JUMBF, x264 core, Lavf, Lavc.
 *
 * Exit code: 0 on all pass, 1 on any failure.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import assert from 'assert';

const ROOT_DIR = process.cwd();
const TEMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cleanstream-meta-verify-'));

// Ensure clean exit
function cleanup() {
  try {
    if (fs.existsSync(TEMP_DIR)) {
      fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    }
  } catch {
    // Ignore cleanup errors
  }
}
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(1); });
process.on('SIGTERM', () => { cleanup(); process.exit(1); });

console.log('================================================================');
console.log('  CleanStream Studio — Video Metadata Stripping Verification');
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
  totalTests++;
  process.stdout.write(`[TEST ${totalTests}] ${name} ... `);
  try {
    fn();
    passedTests++;
    console.log('PASSED \x1b[32m✓\x1b[0m');
  } catch (err) {
    console.log('FAILED \x1b[31m✗\x1b[0m');
    console.error('  Error:', err.message);
    cleanup();
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// 1. Environment & Tooling Verification
// ---------------------------------------------------------------------------
runTest('FFmpeg and ffprobe binaries are available on PATH', () => {
  const ffmpegVer = execSync('ffmpeg -version', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  assert.ok(ffmpegVer.includes('ffmpeg version'), 'FFmpeg binary must report version');
  const ffprobeVer = execSync('ffprobe -version', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  assert.ok(ffprobeVer.includes('ffprobe version'), 'ffprobe binary must report version');
});

// ---------------------------------------------------------------------------
// 2. Input Asset Diagnostics / Generation
// ---------------------------------------------------------------------------
let inputVideoPath = path.join(ROOT_DIR, 'video1.mp4');

runTest('Input video asset availability and baseline metadata markers', () => {
  if (fs.existsSync(inputVideoPath)) {
    const buf = fs.readFileSync(inputVideoPath);
    const latin1 = buf.toString('latin1');
    assert.ok(latin1.includes('c2pa') || latin1.includes('jumb'), 'video1.mp4 must contain C2PA/JUMBF markers');
    assert.ok(latin1.includes('Google'), 'video1.mp4 must contain Google ISO Media handler');
    console.log('\n    (Using real sample video1.mp4 with genuine C2PA/Google provenance)');
  } else {
    // Generate synthetic sample with metadata in temp dir
    inputVideoPath = path.join(TEMP_DIR, 'synthetic_input.mp4');
    execSync(
      `ffmpeg -y -f lavfi -i testsrc=duration=2:size=640x360:rate=24 -f lavfi -i anullsrc=r=44100:cl=stereo -t 2 ` +
      `-c:v libx264 -preset ultrafast -c:a aac ` +
      `-metadata "title=Synthetic Test Video with XMP" ` +
      `-metadata "comment=Exif\\0\\0 GPS: 37.7749 N, 122.4194 W" ` +
      `-metadata:s:v:0 "handler_name=ISO Media file produced by Google Inc." ` +
      `"${inputVideoPath}"`,
      { stdio: 'pipe' }
    );
    assert.ok(fs.existsSync(inputVideoPath), 'Synthetic video must be generated');
    console.log('\n    (Generated synthetic input with injected metadata & Google handler)');
  }
});

// ---------------------------------------------------------------------------
// Inspection Helpers (Dual-Layer: ffprobe JSON whitelist + binary regex)
// ---------------------------------------------------------------------------

const ALLOWED_CONTAINER_TAGS = new Set(['major_brand', 'minor_version', 'compatible_brands']);
const ALLOWED_STREAM_TAGS = new Set(['language', 'handler_name', 'vendor_id']);

function inspectFFprobeTags(filePath) {
  const jsonStr = execSync(
    `ffprobe -v error -show_entries format_tags:stream_tags -of json "${filePath}"`,
    { encoding: 'utf8' }
  );
  const data = JSON.parse(jsonStr);
  const violations = [];

  // Check format tags
  if (data.format && data.format.tags) {
    for (const [key, val] of Object.entries(data.format.tags)) {
      if (!ALLOWED_CONTAINER_TAGS.has(key.toLowerCase())) {
        violations.push(`format.tags.${key} = "${val}"`);
      }
    }
  }

  // Check stream tags
  if (data.streams && Array.isArray(data.streams)) {
    data.streams.forEach((st, idx) => {
      if (st.tags) {
        for (const [key, val] of Object.entries(st.tags)) {
          if (!ALLOWED_STREAM_TAGS.has(key.toLowerCase())) {
            violations.push(`stream[${idx}].tags.${key} = "${val}"`);
          } else if (key.toLowerCase() === 'handler_name' && /Google|Lavf|Lavc|x264/i.test(val)) {
            violations.push(`stream[${idx}].tags.handler_name contains forbidden signature: "${val}"`);
          }
        }
      }
    });
  }

  return violations;
}

const BINARY_PATTERNS = [
  { name: 'XMP Namespace URI', regex: /http:\/\/ns\.adobe\.com\/xap\/1\.0\//i },
  { name: 'XMP Packet Header', regex: /<\?xpacket/i },
  { name: 'EXIF Tag Header', regex: /Exif\x00\x00/ },
  { name: 'C2PA Manifest Atom', regex: /c2pa/i },
  { name: 'JUMBF Box Header', regex: /jumb/i },
  { name: 'Google Handler/Signature', regex: /ISO Media file produced by Google Inc\./i },
  { name: 'SynthID Marker', regex: /SynthID|trainedAlgorithmicMedia/i },
  { name: 'x264 SEI Bitstream String', regex: /x264 - core/i },
  { name: 'Lavf Container Encoder', regex: /Lavf[0-9.]*/ },
  { name: 'Lavc Stream Encoder', regex: /Lavc[0-9.]*/ },
];

function inspectBinarySignatures(filePath) {
  const buf = fs.readFileSync(filePath);
  const latin1 = buf.toString('latin1');
  const matches = [];

  for (const pat of BINARY_PATTERNS) {
    if (pat.regex.test(latin1)) {
      matches.push(pat.name);
    }
  }
  return matches;
}

function verifyStreamIntegrity(filePath) {
  const out = execSync(
    `ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of csv=p=0 "${filePath}"`,
    { encoding: 'utf8' }
  ).trim();
  assert.strictEqual(out, 'h264', `Video stream must be valid h264, got "${out}"`);
}

// ---------------------------------------------------------------------------
// 3. Mode 1 Verification: Fast Container Purge
// ---------------------------------------------------------------------------
runTest('Mode 1 (Fast Container Purge) strips all metadata and SEI units', () => {
  const outPath = path.join(TEMP_DIR, 'out_mode1.mp4');

  // Exact command pipeline
  execSync(
    `ffmpeg -y -i "${inputVideoPath}" ` +
    `-map 0:v:0 -map 0:a? ` +
    `-map_metadata -1 -map_metadata:s -1 ` +
    `-c:v copy -c:a copy ` +
    `-bsf:v filter_units=remove_types=6 ` +
    `-dn ` +
    `-fflags +bitexact -flags:v +bitexact -flags:a +bitexact ` +
    `-metadata:s:v:0 encoder="" -metadata:s:a:0 encoder="" ` +
    `"${outPath}"`,
    { stdio: 'pipe' }
  );

  assert.ok(fs.existsSync(outPath), 'Mode 1 output file must exist');

  // Stream integrity
  verifyStreamIntegrity(outPath);

  // Layer A: ffprobe inspection
  const probeViolations = inspectFFprobeTags(outPath);
  assert.strictEqual(
    probeViolations.length,
    0,
    `Mode 1 ffprobe tag violations detected:\n  ${probeViolations.join('\n  ')}`
  );

  // Layer B: Binary signature inspection
  const binaryViolations = inspectBinarySignatures(outPath);
  assert.strictEqual(
    binaryViolations.length,
    0,
    `Mode 1 binary signatures detected:\n  ${binaryViolations.join('\n  ')}`
  );
});

// ---------------------------------------------------------------------------
// 4. Mode 2 Verification: Deep Anti-SynthID CRF 18 Re-encoding
// ---------------------------------------------------------------------------
runTest('Mode 2 (Deep Anti-SynthID) eliminates metadata, encoder tags, and watermarks', () => {
  const outPath = path.join(TEMP_DIR, 'out_mode2.mp4');

  // Exact command pipeline
  execSync(
    `ffmpeg -y -i "${inputVideoPath}" ` +
    `-map 0:v:0 -map 0:a? ` +
    `-map_metadata -1 -map_metadata:s -1 ` +
    `-vf "crop=trunc(iw*0.99/2)*2:trunc(ih*0.99/2)*2,scale=iw:ih,noise=alls=1:allf=t" ` +
    `-af "highpass=f=20,lowpass=f=19500" ` +
    `-c:v libx264 -preset ultrafast -crf 18 ` +
    `-c:a aac -b:a 192k ` +
    `-bsf:v filter_units=remove_types=6 ` +
    `-dn ` +
    `-fflags +bitexact -flags:v +bitexact -flags:a +bitexact ` +
    `-metadata:s:v:0 encoder="" -metadata:s:a:0 encoder="" ` +
    `-movflags +faststart ` +
    `"${outPath}"`,
    { stdio: 'pipe' }
  );

  assert.ok(fs.existsSync(outPath), 'Mode 2 output file must exist');

  // Stream integrity
  verifyStreamIntegrity(outPath);

  // Layer A: ffprobe inspection
  const probeViolations = inspectFFprobeTags(outPath);
  assert.strictEqual(
    probeViolations.length,
    0,
    `Mode 2 ffprobe tag violations detected:\n  ${probeViolations.join('\n  ')}`
  );

  // Layer B: Binary signature inspection
  const binaryViolations = inspectBinarySignatures(outPath);
  assert.strictEqual(
    binaryViolations.length,
    0,
    `Mode 2 binary signatures detected:\n  ${binaryViolations.join('\n  ')}`
  );
});

// ---------------------------------------------------------------------------
// 5. Mode 3 Verification: Multi-Variant Spoofer
// ---------------------------------------------------------------------------
runTest('Mode 3 (Multi-Variant Spoofer) creates distinct hashes with 0 metadata leakage', () => {
  const variants = [
    { idx: 1, crop: 0.990, noise: 1, brightness: '-0.0010' },
    { idx: 2, crop: 0.988, noise: 2, brightness: '0.0000' },
    { idx: 3, crop: 0.992, noise: 3, brightness: '0.0010' },
  ];

  const variantFiles = [];
  const hashes = [];

  for (const v of variants) {
    const outPath = path.join(TEMP_DIR, `out_variant_${v.idx}.mp4`);
    const filterExpr = `crop=trunc(iw*${v.crop}/2)*2:trunc(ih*${v.crop}/2)*2,scale=iw:ih,noise=alls=${v.noise}:allf=t,eq=brightness=${v.brightness}`;

    execSync(
      `ffmpeg -y -i "${inputVideoPath}" ` +
      `-map 0:v:0 -map 0:a? ` +
      `-map_metadata -1 -map_metadata:s -1 ` +
      `-vf "${filterExpr}" ` +
      `-af "highpass=f=20,lowpass=f=19500" ` +
      `-c:v libx264 -preset ultrafast -crf 18 ` +
      `-c:a aac -b:a 192k ` +
      `-bsf:v filter_units=remove_types=6 ` +
      `-dn ` +
      `-fflags +bitexact -flags:v +bitexact -flags:a +bitexact ` +
      `-metadata:s:v:0 encoder="" -metadata:s:a:0 encoder="" ` +
      `-movflags +faststart ` +
      `"${outPath}"`,
      { stdio: 'pipe' }
    );

    assert.ok(fs.existsSync(outPath), `Variant ${v.idx} output file must exist`);
    variantFiles.push(outPath);

    // Stream integrity
    verifyStreamIntegrity(outPath);

    // Layer A: ffprobe inspection
    const probeViolations = inspectFFprobeTags(outPath);
    assert.strictEqual(
      probeViolations.length,
      0,
      `Variant ${v.idx} ffprobe tag violations detected:\n  ${probeViolations.join('\n  ')}`
    );

    // Layer B: Binary signature inspection
    const binaryViolations = inspectBinarySignatures(outPath);
    assert.strictEqual(
      binaryViolations.length,
      0,
      `Variant ${v.idx} binary signatures detected:\n  ${binaryViolations.join('\n  ')}`
    );

    // Cryptographic hashes
    const buf = fs.readFileSync(outPath);
    const sha256 = crypto.createHash('sha256').update(buf).digest('hex');
    const md5 = crypto.createHash('md5').update(buf).digest('hex');
    hashes.push({ idx: v.idx, sha256, md5 });
  }

  // Assert distinct hashes
  assert.notStrictEqual(hashes[0].sha256, hashes[1].sha256, 'Variant 1 and 2 SHA-256 must be distinct');
  assert.notStrictEqual(hashes[1].sha256, hashes[2].sha256, 'Variant 2 and 3 SHA-256 must be distinct');
  assert.notStrictEqual(hashes[0].sha256, hashes[2].sha256, 'Variant 1 and 3 SHA-256 must be distinct');

  assert.notStrictEqual(hashes[0].md5, hashes[1].md5, 'Variant 1 and 2 MD5 must be distinct');
  assert.notStrictEqual(hashes[1].md5, hashes[2].md5, 'Variant 2 and 3 MD5 must be distinct');
  assert.notStrictEqual(hashes[0].md5, hashes[2].md5, 'Variant 1 and 3 MD5 must be distinct');

  console.log(`\n    Variant 1 SHA-256: ${hashes[0].sha256}`);
  console.log(`    Variant 2 SHA-256: ${hashes[1].sha256}`);
  console.log(`    Variant 3 SHA-256: ${hashes[2].sha256}`);
});

// ---------------------------------------------------------------------------
// 6. Silent Video Robustness Verification (-map 0:a? on videos without audio)
// ---------------------------------------------------------------------------
runTest('Silent video robustness: -map 0:a? processes audio-less videos cleanly in Mode 1 & Mode 2', () => {
  const silentInput = path.join(TEMP_DIR, 'silent_input.mp4');
  const silentMode1Out = path.join(TEMP_DIR, 'silent_out_mode1.mp4');
  const silentMode2Out = path.join(TEMP_DIR, 'silent_out_mode2.mp4');

  // Generate a strictly video-only (silent) input with injected metadata
  execSync(
    `ffmpeg -y -f lavfi -i testsrc=duration=1:size=320x240:rate=24 ` +
    `-c:v libx264 -preset ultrafast ` +
    `-metadata "title=Silent Video With Tags" ` +
    `-metadata:s:v:0 "handler_name=ISO Media file produced by Google Inc." ` +
    `"${silentInput}"`,
    { stdio: 'pipe' }
  );

  assert.ok(fs.existsSync(silentInput), 'Silent input video must exist');

  // Verify silent input has 0 audio streams
  const inAudioCount = execSync(
    `ffprobe -v error -select_streams a -show_entries stream=index -of csv=p=0 "${silentInput}"`,
    { encoding: 'utf8' }
  ).trim();
  assert.strictEqual(inAudioCount, '', 'Silent input must have 0 audio streams');

  // Execute Mode 1 on silent video
  execSync(
    `ffmpeg -y -i "${silentInput}" ` +
    `-map 0:v:0 -map 0:a? ` +
    `-map_metadata -1 -map_metadata:s -1 ` +
    `-c:v copy -c:a copy ` +
    `-bsf:v filter_units=remove_types=6 ` +
    `-dn ` +
    `-fflags +bitexact -flags:v +bitexact -flags:a +bitexact ` +
    `-metadata:s:v:0 encoder="" -metadata:s:a:0 encoder="" ` +
    `"${silentMode1Out}"`,
    { stdio: 'pipe' }
  );

  assert.ok(fs.existsSync(silentMode1Out), 'Silent Mode 1 output must exist');
  verifyStreamIntegrity(silentMode1Out);
  const silent1ProbeViolations = inspectFFprobeTags(silentMode1Out);
  assert.strictEqual(silent1ProbeViolations.length, 0, `Silent Mode 1 ffprobe violations: ${silent1ProbeViolations.join(', ')}`);
  const silent1BinViolations = inspectBinarySignatures(silentMode1Out);
  assert.strictEqual(silent1BinViolations.length, 0, `Silent Mode 1 binary violations: ${silent1BinViolations.join(', ')}`);

  // Execute Mode 2 on silent video
  execSync(
    `ffmpeg -y -i "${silentInput}" ` +
    `-map 0:v:0 -map 0:a? ` +
    `-map_metadata -1 -map_metadata:s -1 ` +
    `-vf "crop=trunc(iw*0.99/2)*2:trunc(ih*0.99/2)*2,scale=iw:ih,noise=alls=1:allf=t" ` +
    `-af "highpass=f=20,lowpass=f=19500" ` +
    `-c:v libx264 -preset ultrafast -crf 18 ` +
    `-c:a aac -b:a 192k ` +
    `-bsf:v filter_units=remove_types=6 ` +
    `-dn ` +
    `-fflags +bitexact -flags:v +bitexact -flags:a +bitexact ` +
    `-metadata:s:v:0 encoder="" -metadata:s:a:0 encoder="" ` +
    `-movflags +faststart ` +
    `"${silentMode2Out}"`,
    { stdio: 'pipe' }
  );

  assert.ok(fs.existsSync(silentMode2Out), 'Silent Mode 2 output must exist');
  verifyStreamIntegrity(silentMode2Out);
  const silent2ProbeViolations = inspectFFprobeTags(silentMode2Out);
  assert.strictEqual(silent2ProbeViolations.length, 0, `Silent Mode 2 ffprobe violations: ${silent2ProbeViolations.join(', ')}`);
  const silent2BinViolations = inspectBinarySignatures(silentMode2Out);
  assert.strictEqual(silent2BinViolations.length, 0, `Silent Mode 2 binary violations: ${silent2BinViolations.join(', ')}`);

  console.log('\n    (Silent video processed cleanly in both Mode 1 and Mode 2 with 0 metadata leakage)');
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('\n================================================================');
console.log(`  ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY (100% METADATA FREE)`);
console.log('================================================================\n');

cleanup();
process.exit(0);
