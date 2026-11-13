/**
 * Tier 1 — Feature Area 5: Git, Environment Variables & Build Standards
 * Tests T1-F5-01 to T1-F5-05
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { loadSourceFile } from '../helpers/app-loader.mjs';

export const tests = [
  {
    id: 'T1-F5-01',
    feature: 'F5',
    tier: 1,
    title: '.gitignore contains explicit rules ignoring .env, .env.local, and .env*.local',
    async run() {
      assert.ok(fs.existsSync('.gitignore'), '.gitignore must exist in root directory');
      const gitignore = loadSourceFile('.gitignore');

      assert.ok(gitignore.includes('.env'), '.gitignore must ignore .env');
      assert.ok(
        gitignore.includes('.env*.local') || gitignore.includes('.env.local'),
        '.gitignore must ignore .env.local and local overrides'
      );
    },
  },

  {
    id: 'T1-F5-02',
    feature: 'F5',
    tier: 1,
    title: '.gitignore contains explicit rules ignoring all video files (*.mp4, clean_video_*.mp4, test_*.mp4)',
    async run() {
      const gitignore = loadSourceFile('.gitignore');

      assert.ok(gitignore.includes('*.mp4'), '.gitignore must contain wildcard *.mp4 rule');
      assert.ok(gitignore.includes('clean_video_*.mp4'), '.gitignore must contain clean_video_*.mp4');
      assert.ok(gitignore.includes('test_*.mp4'), '.gitignore must contain test_*.mp4');
    },
  },

  {
    id: 'T1-F5-03',
    feature: 'F5',
    tier: 1,
    title: '.gitignore contains explicit rules ignoring local database storage (data/, /data/, *.sqlite, *.tmp.*)',
    async run() {
      const gitignore = loadSourceFile('.gitignore');

      assert.ok(
        gitignore.includes('/data/') || gitignore.includes('data/'),
        '.gitignore must ignore data/ folder'
      );
      assert.ok(gitignore.includes('*.sqlite'), '.gitignore must ignore *.sqlite');
      assert.ok(gitignore.includes('*.tmp.*'), '.gitignore must ignore *.tmp.*');
    },
  },

  {
    id: 'T1-F5-04',
    feature: 'F5',
    tier: 1,
    title: 'Git tracked files audit confirms zero committed secrets, API keys, or video binaries',
    async run() {
      let trackedFiles = [];
      try {
        const stdout = execSync('git ls-files', { encoding: 'utf8' });
        trackedFiles = stdout.split('\n').map((f) => f.trim()).filter(Boolean);
      } catch (err) {
        throw new Error(`Failed to list tracked git files: ${err.message}`);
      }

      // Check for committed secrets or video binaries
      const forbiddenPatterns = [
        /\.env($|\.)/,
        /\.pem$/,
        /\.key$/,
        /\.mp4$/i,
        /^data\/.*\.json$/,
        /test_socialtools\.json$/,
      ];

      const leakedFiles = [];
      for (const file of trackedFiles) {
        for (const pattern of forbiddenPatterns) {
          if (pattern.test(file)) {
            leakedFiles.push(file);
          }
        }
      }

      assert.equal(
        leakedFiles.length,
        0,
        `Forbidden files found tracked in Git: ${leakedFiles.join(', ')}`
      );
    },
  },

  {
    id: 'T1-F5-05',
    feature: 'F5',
    tier: 1,
    title: 'Next.js project lint check passes with zero errors',
    async run() {
      try {
        execSync('npm run lint', { encoding: 'utf8', stdio: 'pipe' });
      } catch (err) {
        const output = err.stdout ? err.stdout.toString() : err.message;
        throw new Error(`Lint check failed: ${output}`);
      }
    },
  },
];
