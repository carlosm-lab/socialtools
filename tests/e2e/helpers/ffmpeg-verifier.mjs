/**
 * FFmpeg Verifier Helper for E2E Tests
 * Scans video binaries for metadata signatures (C2PA, SynthID, XMP, EXIF)
 * and validates FFmpeg bitexact argument pipelines.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export const METADATA_SIGNATURES = [
  'c2pa',
  'jumb',
  'SynthID',
  'http://ns.adobe.com/xap/1.0/',
  '<x:xmpmeta',
  'photoshop',
  'udta.ilst',
  'x264 - core',
];

export const REQUIRED_BITEXACT_FLAGS = [
  '-map 0:v:0',
  '-map 0:a?',
  '-map_metadata -1',
  '-map_metadata:s -1',
  '-bsf:v filter_units=remove_types=6',
  '-dn',
  '-fflags +bitexact',
  '-flags:v +bitexact',
  '-flags:a +bitexact',
  '-metadata:s:v:0 encoder=""',
  '-metadata:s:a:0 encoder=""',
];

/**
 * Scans a binary Buffer or file path for metadata markers using 1-to-1 latin1 byte interpretation.
 * @param {Buffer|string} bufferOrPath
 * @param {string[]} [signatures=METADATA_SIGNATURES]
 * @returns {{ clean: boolean, foundMarkers: string[], totalBytes: number }}
 */
export function scanBinaryForMarkers(bufferOrPath, signatures = METADATA_SIGNATURES) {
  let buf;
  if (typeof bufferOrPath === 'string') {
    buf = fs.readFileSync(path.resolve(process.cwd(), bufferOrPath));
  } else if (Buffer.isBuffer(bufferOrPath)) {
    buf = bufferOrPath;
  } else if (bufferOrPath instanceof Uint8Array) {
    buf = Buffer.from(bufferOrPath);
  } else {
    throw new Error('Expected Buffer, Uint8Array, or file path string');
  }

  const str = buf.toString('latin1');
  const foundMarkers = [];

  for (const sig of signatures) {
    if (str.includes(sig)) {
      foundMarkers.push(sig);
    }
  }

  return {
    clean: foundMarkers.length === 0,
    foundMarkers,
    totalBytes: buf.length,
  };
}

/**
 * Verifies that an array of FFmpeg arguments (or joined string) contains the required bitexact flags.
 * @param {string[]|string} args
 * @returns {{ valid: boolean, missingFlags: string[], checkedFlags: string[] }}
 */
export function verifyBitexactPipeline(args) {
  const argString = Array.isArray(args) ? args.join(' ') : args;
  const missingFlags = [];

  for (const flag of REQUIRED_BITEXACT_FLAGS) {
    // Normalizing whitespace and checking
    const normalizedFlag = flag.trim();
    if (!argString.includes(normalizedFlag)) {
      // Check individual components if multi-part
      const parts = normalizedFlag.split(' ');
      const hasAllParts = parts.every((p) => argString.includes(p));
      if (!hasAllParts) {
        missingFlags.push(flag);
      }
    }
  }

  return {
    valid: missingFlags.length === 0,
    missingFlags,
    checkedFlags: REQUIRED_BITEXACT_FLAGS,
  };
}

/**
 * Executes ffprobe on a video file to retrieve detailed stream and format metadata.
 * Returns null if ffprobe is not installed in the environment.
 * @param {string} videoFilePath
 * @returns {object|null}
 */
export function probeVideoMetadata(videoFilePath) {
  const fullPath = path.resolve(process.cwd(), videoFilePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Video file not found: ${fullPath}`);
  }

  try {
    const stdout = execFileSync(
      'ffprobe',
      [
        '-v',
        'quiet',
        '-print_format',
        'json',
        '-show_format',
        '-show_streams',
        fullPath,
      ],
      { encoding: 'utf8' }
    );
    return JSON.parse(stdout);
  } catch (err) {
    return null;
  }
}

/**
 * Executes native ffmpeg command line to process a test video using the bitexact pipeline.
 * Useful for end-to-end output verification.
 * @param {string} inputPath
 * @param {string} outputPath
 * @param {string[]} extraArgs
 * @returns {string} Path to generated clean video
 */
export function runFFmpegBitexactClean(inputPath, outputPath, extraArgs = []) {
  const fullInput = path.resolve(process.cwd(), inputPath);
  const fullOutput = path.resolve(process.cwd(), outputPath);

  const baseArgs = [
    '-y',
    '-i',
    fullInput,
    '-map',
    '0:v:0',
    '-map',
    '0:a?',
    '-map_metadata',
    '-1',
    '-map_metadata:s',
    '-1',
    '-bsf:v',
    'filter_units=remove_types=6',
    '-dn',
    '-fflags',
    '+bitexact',
    '-flags:v',
    '+bitexact',
    '-flags:a',
    '+bitexact',
    '-metadata:s:v:0',
    'encoder=',
    '-metadata:s:a:0',
    'encoder=',
    ...extraArgs,
    fullOutput,
  ];

  execFileSync('ffmpeg', baseArgs, { stdio: 'pipe' });
  return fullOutput;
}
