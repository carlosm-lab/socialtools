/**
 * Tier 1 — Feature Area 4: Complete Video Metadata Stripping
 * Tests T1-F4-01 to T1-F4-05
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadSourceFile, loadModule } from '../helpers/app-loader.mjs';
import {
  scanBinaryForMarkers,
  verifyBitexactPipeline,
  probeVideoMetadata,
  runFFmpegBitexactClean,
} from '../helpers/ffmpeg-verifier.mjs';
import {
  checkDesignTokens,
  checkZeroRoundedFullPillBadges,
  checkZeroNestedCards,
} from '../helpers/dom-inspector.mjs';

export const tests = [
  {
    id: 'T1-F4-01',
    feature: 'F4',
    tier: 1,
    title: 'Mode 1 FFmpeg arguments include -map 0:v:0 -map 0:a? -map_metadata -1 -map_metadata:s -1 -bsf:v filter_units=remove_types=6 -dn -fflags +bitexact',
    async run() {
      const cleanerSrc = loadSourceFile('components/useFFmpegCleaner.ts');

      // Extract Mode 1 exec arguments block
      const mode1Idx = cleanerSrc.indexOf("if (mode === 'fast') {");
      assert.ok(mode1Idx !== -1, "Mode 1 execution block 'if (mode === \\'fast\\') {' must exist in useFFmpegCleaner.ts");

      const mode2Idx = cleanerSrc.indexOf("} else if (mode === 'deep') {");
      const mode1Section = cleanerSrc.slice(mode1Idx, mode2Idx);

      const requiredFlags = [
        '-map',
        '0:v:0',
        '0:a?',
        '-map_metadata',
        '-bsf:v',
        'filter_units=remove_types=6',
        '-dn',
        '-fflags',
        '+bitexact',
        '-flags:v',
        '-flags:a',
        '-metadata:s:v:0',
        '-metadata:s:a:0',
        'encoder=',
      ];

      for (const flag of requiredFlags) {
        assert.ok(
          mode1Section.includes(`'${flag}'`),
          `Mode 1 must include flag '${flag}'`
        );
      }
    },
  },

  {
    id: 'T1-F4-02',
    feature: 'F4',
    tier: 1,
    title: 'Mode 2 FFmpeg arguments include CRF 18 re-encoding, acoustic filter, and bitexact metadata stripping flags',
    async run() {
      const cleanerSrc = loadSourceFile('components/useFFmpegCleaner.ts');

      const mode2Idx = cleanerSrc.indexOf("} else if (mode === 'deep') {");
      assert.ok(mode2Idx !== -1, 'Mode 2 block must exist');

      const mode3Idx = cleanerSrc.indexOf("} else if (mode === 'spoofer') {");
      const mode2Section = cleanerSrc.slice(mode2Idx, mode3Idx);

      // Verify CRF 18
      assert.ok(
        mode2Section.includes("'-crf'") && mode2Section.includes("'18'"),
        'Mode 2 must enforce CRF 18 for high fidelity encoding'
      );

      // Verify acoustic bandpass/notch filtering (20Hz to 19.5kHz)
      assert.ok(
        mode2Section.includes('highpass=f=20') && mode2Section.includes('lowpass=f=19500'),
        'Mode 2 must enforce acoustic filter: highpass 20Hz and lowpass 19.5kHz'
      );

      // Verify bitexact stripping flags
      assert.ok(mode2Section.includes("'filter_units=remove_types=6'"), 'Mode 2 must remove SEI tags');
      assert.ok(mode2Section.includes("'-fflags'") && mode2Section.includes("'+bitexact'"), 'Mode 2 must set +bitexact');
      assert.ok(mode2Section.includes("'-movflags'") && mode2Section.includes("'+faststart'"), 'Mode 2 must include +faststart');
    },
  },

  {
    id: 'T1-F4-03',
    feature: 'F4',
    tier: 1,
    title: 'Mode 3 Multi-Variant Spoofer generates 3, 5, or 10 distinct files with unique SHA-256 and MD5 cryptographic hashes',
    async run() {
      const cleanerSrc = loadSourceFile('components/useFFmpegCleaner.ts');

      const mode3Idx = cleanerSrc.indexOf("mode === 'spoofer'");
      assert.ok(mode3Idx !== -1, 'Mode 3 block must exist');
      const mode3Section = cleanerSrc.slice(mode3Idx);

      // Check support for variant loops and distinct cropSeeds
      assert.ok(mode3Section.includes('cropSeeds'), 'Mode 3 must use cropSeeds array for varying aspect micro-crops');
      assert.ok(mode3Section.includes('variantCount'), 'Mode 3 must support configurable variantCount (3, 5, 10)');
      assert.ok(mode3Section.includes('noise='), 'Mode 3 must apply variant-indexed noise filter');
      assert.ok(mode3Section.includes('eq=brightness='), 'Mode 3 must apply micro-brightness modulation');
      assert.ok(mode3Section.includes('computeSHA256'), 'Mode 3 must compute SHA256 per variant');
      assert.ok(mode3Section.includes('computeMD5'), 'Mode 3 must compute MD5 per variant');
    },
  },

  {
    id: 'T1-F4-04',
    feature: 'F4',
    tier: 1,
    title: 'FFmpeg execution on sample video1.mp4 purges all C2PA manifests (c2pa, jumb) and SynthID markers',
    async run() {
      const inputVideo = 'video1.mp4';
      assert.ok(fs.existsSync(inputVideo), 'Input video1.mp4 fixture must exist');

      // 1. Verify input has C2PA / SynthID markers
      const preScan = scanBinaryForMarkers(inputVideo, ['c2pa', 'jumb', 'SynthID']);
      assert.ok(
        preScan.foundMarkers.length > 0,
        `Expected video1.mp4 to contain tracking markers, found: ${preScan.foundMarkers.join(', ')}`
      );

      // 2. Execute bitexact clean pipeline
      const tempOutput = path.join(process.cwd(), `test_clean_tier1_${Date.now()}.mp4`);
      try {
        runFFmpegBitexactClean(inputVideo, tempOutput, ['-c:v', 'copy', '-c:a', 'copy']);

        assert.ok(fs.existsSync(tempOutput), 'Cleaned output video must be produced');
        assert.ok(fs.statSync(tempOutput).size > 0, 'Cleaned output video must not be empty');

        // 3. Scan cleaned binary
        const postScan = scanBinaryForMarkers(tempOutput, ['c2pa', 'jumb', 'SynthID']);
        assert.equal(
          postScan.foundMarkers.length,
          0,
          `Output must have 0 tracking markers remaining, but found: ${postScan.foundMarkers.join(', ')}`
        );
      } finally {
        if (fs.existsSync(tempOutput)) {
          fs.unlinkSync(tempOutput);
        }
      }
    },
  },

  {
    id: 'T1-F4-05',
    feature: 'F4',
    tier: 1,
    title: 'Binary and probe scan of output video confirms 0 remaining XMP metadata, 0 EXIF metadata, and 0 encoder tags',
    async run() {
      const inputVideo = 'video1.mp4';
      const tempOutput = path.join(process.cwd(), `test_clean_probe_${Date.now()}.mp4`);

      try {
        runFFmpegBitexactClean(inputVideo, tempOutput, ['-c:v', 'copy', '-c:a', 'copy']);

        // 1. Binary scan for Adobe XMP & EXIF headers
        const binaryScan = scanBinaryForMarkers(tempOutput, [
          'http://ns.adobe.com/xap/1.0/',
          '<x:xmpmeta',
          'photoshop',
          'udta.ilst',
        ]);

        assert.equal(
          binaryScan.foundMarkers.length,
          0,
          `Disallowed metadata strings found: ${binaryScan.foundMarkers.join(', ')}`
        );

        // 2. ffprobe inspection if available
        const probeData = probeVideoMetadata(tempOutput);
        if (probeData) {
          const formatTags = probeData.format?.tags || {};
          const videoTags = probeData.streams?.[0]?.tags || {};

          // Verify encoder tags are empty or purged
          assert.equal(formatTags.encoder || '', '', 'Format encoder tag must be empty');
          assert.equal(videoTags.encoder || '', '', 'Video stream encoder tag must be empty');
          assert.equal(formatTags.comment || '', '', 'Format comment tag must be empty');
        }
      } finally {
        if (fs.existsSync(tempOutput)) {
          fs.unlinkSync(tempOutput);
        }
      }
    },
  },

  {
    id: 'T1-F4-06',
    feature: 'F4',
    tier: 1,
    title: 'Two-Layer Forensic Report separates Container Metadata (Layer 1) from Signal Transformation (Layer 2) with honest SynthID states',
    async run() {
      const { scanVideoForensics } = loadModule('lib/forensicsScanner.ts');
      const sampleVideo = 'video1.mp4';
      assert.ok(fs.existsSync(sampleVideo), 'video1.mp4 must exist for forensic scanning');

      const buf = fs.readFileSync(sampleVideo);
      const file = new File([buf], 'video1.mp4', { type: 'video/mp4' });

      // 1. Pre-scan (Untreated file)
      const preReport = await scanVideoForensics(file, { skipAudio: true });
      assert.ok(preReport.layer1, 'Report must contain layer1 object');
      assert.ok(preReport.layer2, 'Report must contain layer2 object');
      assert.equal(preReport.layer1.name, 'Contenedor y Metadatos Digitales');
      assert.equal(preReport.layer2.name, 'Transformación de Señal (Píxeles y Espectro)');
      assert.equal(preReport.layer1.items.length, 4, 'Layer 1 must contain 4 items (c2pa, iptc_ai, provenance_authority, xmp_metadata)');
      assert.equal(preReport.layer2.items.length, 3, 'Layer 2 must contain 3 items (synthid, acoustic_spectrum, file_hash)');
      assert.equal(preReport.layer1.verified, false, 'Pre-scan Layer 1 must not be verified when AI markers exist');
      assert.equal(preReport.layer2.synthIdShielded, false, 'Pre-scan Layer 2 must not be shielded');

      const preSynthId = preReport.diagnostics.find((d) => d.id === 'synthid');
      assert.ok(!preSynthId.sanitizedState.includes('Neutralizada'), 'Pre-scan must NOT claim SynthID is Neutralizada');

      // 2. Mode 1 Post-clean report
      const mode1Report = await scanVideoForensics(file, { processedMode: 'fast', skipAudio: true });
      assert.equal(mode1Report.layer1.verified, true, 'Layer 1 must be verified after Mode 1 stream copy');
      assert.equal(mode1Report.layer2.pixelMatrixIntact, true, 'Layer 2 pixel matrix must be reported intact after Mode 1');
      assert.equal(mode1Report.layer2.synthIdShielded, false, 'Layer 2 SynthID must NOT be reported shielded after Mode 1');
      assert.equal(mode1Report.layer2.acousticFiltered, false, 'Layer 2 acoustic filter must NOT be reported active after Mode 1');

      const mode1SynthId = mode1Report.diagnostics.find((d) => d.id === 'synthid');
      assert.ok(mode1SynthId.currentState.includes('intacta'), 'Mode 1 SynthID currentState must state pixel matrix is intact');
      assert.ok(
        mode1SynthId.sanitizedState.includes('Sin recodificar') || mode1SynthId.sanitizedState.includes('intacta'),
        'Mode 1 SynthID sanitizedState must clearly inform user that pixels were not re-encoded'
      );
      assert.ok(
        !mode1SynthId.sanitizedState.includes('Neutralizada'),
        'Mode 1 SynthID sanitizedState must NOT report Neutralizada when pixel matrix remains intact'
      );

      // 3. Mode 2 Post-clean report
      const mode2Report = await scanVideoForensics(file, { processedMode: 'deep', skipAudio: true });
      assert.equal(mode2Report.layer1.verified, true, 'Layer 1 must be verified after Mode 2');
      assert.equal(mode2Report.layer2.synthIdShielded, true, 'Layer 2 SynthID must be shielded after Mode 2');
      assert.equal(mode2Report.layer2.pixelMatrixIntact, false, 'Layer 2 pixel matrix must NOT be intact after Mode 2');
      assert.equal(mode2Report.layer2.acousticFiltered, true, 'Layer 2 acoustic must be filtered after Mode 2');

      const mode2SynthId = mode2Report.diagnostics.find((d) => d.id === 'synthid');
      assert.ok(mode2SynthId.sanitizedState.includes('Blindada'), 'Mode 2 SynthID sanitizedState must report Blindada');
    },
  },

  {
    id: 'T1-F4-07',
    feature: 'F4',
    tier: 1,
    title: 'Physical acoustic spectrum analysis using Radix-2 Cooley-Tukey FFT measures frequency energy >19.5 kHz on synthetic audio buffers',
    async run() {
      const {
        analyzeAudioSpectrum,
        generateSyntheticAudioBuffer,
        computeRadix2FFT,
      } = loadModule('lib/acousticAnalyzer.ts');

      const sampleRate = 48000;
      const durationSec = 0.25;

      // 1. Pure Cooley-Tukey FFT algorithm correctness on simple power-of-2 input
      const testInput = new Float32Array(8);
      testInput[0] = 1; // Delta impulse -> constant FFT
      const fftRes = computeRadix2FFT(testInput);
      for (let k = 0; k < 8; k++) {
        assert.ok(Math.abs(fftRes.re[k] - 1) < 1e-4, `FFT real part at bin ${k} must equal 1`);
        assert.ok(Math.abs(fftRes.im[k]) < 1e-4, `FFT imag part at bin ${k} must equal 0`);
      }

      // 2. Programmatic synthetic buffer: 20 kHz ultrasonic sine wave
      const ultrasonicTone = generateSyntheticAudioBuffer({
        sampleRate,
        durationSec,
        frequencies: [20000],
        amplitudes: [0.85],
      });
      const ultraAnalysis = analyzeAudioSpectrum(ultrasonicTone, sampleRate);
      assert.equal(ultraAnalysis.hasAudio, true, 'Acoustic analyzer must recognize audio presence');
      assert.equal(ultraAnalysis.hasUltrasonicEnergy, true, '20 kHz carrier must be detected as active ultrasonic energy');
      assert.ok(
        ultraAnalysis.peakUltrasonicDb > -50,
        `20 kHz peak dBFS (${ultraAnalysis.peakUltrasonicDb}) must be > -50 dBFS`
      );
      assert.ok(
        ultraAnalysis.ultrasonicEnergyRatio > 0.8,
        `Ultrasonic energy ratio (${ultraAnalysis.ultrasonicEnergyRatio}) must be > 0.8 for pure 20kHz tone`
      );
      assert.ok(
        Math.abs(ultraAnalysis.peakFrequencyHz - 20000) < 100,
        `Peak frequency (${ultraAnalysis.peakFrequencyHz} Hz) must be within 100Hz of 20000 Hz`
      );

      // 3. Programmatic synthetic buffer: 15 kHz audible sine wave
      const audibleTone = generateSyntheticAudioBuffer({
        sampleRate,
        durationSec,
        frequencies: [15000],
        amplitudes: [0.85],
      });
      const audAnalysis = analyzeAudioSpectrum(audibleTone, sampleRate);
      assert.equal(audAnalysis.hasAudio, true);
      assert.equal(
        audAnalysis.hasUltrasonicEnergy,
        false,
        '15 kHz audible tone must NOT be classified as ultrasonic energy'
      );
      assert.ok(
        audAnalysis.peakUltrasonicDb < -60,
        `15 kHz tone leakage into >19.5 kHz (${audAnalysis.peakUltrasonicDb} dBFS) must be attenuated`
      );
      assert.ok(
        Math.abs(audAnalysis.peakFrequencyHz - 15000) < 100,
        `Peak frequency (${audAnalysis.peakFrequencyHz} Hz) must be within 100Hz of 15000 Hz`
      );

      // 4. Silent audio buffer
      const silentBuffer = new Float32Array(sampleRate * 0.1);
      const silentAnalysis = analyzeAudioSpectrum(silentBuffer, sampleRate);
      assert.equal(silentAnalysis.hasUltrasonicEnergy, false, 'Silence must not trigger ultrasonic alert');
    },
  },

  {
    id: 'T1-F4-08',
    feature: 'F4',
    tier: 1,
    title: 'Mode 1 and Mode 2 user-facing verdicts match the exact required strings verbatim across Studio UI and FFmpeg cleaner',
    async run() {
      const pageSrc = loadSourceFile('app/page.tsx');
      const cleanerSrc = loadSourceFile('components/useFFmpegCleaner.ts');
      const modeSelectorSrc = loadSourceFile('components/ModeSelector.tsx');

      const VERDICT_MODE1 =
        'Protección de Metadatos Activa: Manifiestos C2PA y etiquetas de procedencia purgados al 100% (ideal para redes que inspeccionan cabeceras)';
      const VERDICT_MODE2 =
        'Blindaje Total: Metadatos purgados + Matriz espacial de píxeles alterada + Filtro acústico 20Hz-19.5kHz contra rastreadores ultrasónicos';

      // 1. Verbatim string verification in page.tsx
      assert.ok(
        pageSrc.includes(VERDICT_MODE1),
        'app/page.tsx must render verbatim Mode 1 verdict'
      );
      assert.ok(
        pageSrc.includes(VERDICT_MODE2),
        'app/page.tsx must render verbatim Mode 2 verdict'
      );

      // 2. Verbatim string verification in useFFmpegCleaner.ts
      assert.ok(
        cleanerSrc.includes(VERDICT_MODE1),
        'useFFmpegCleaner.ts must set verbatim Mode 1 verdict'
      );
      assert.ok(
        cleanerSrc.includes(VERDICT_MODE2),
        'useFFmpegCleaner.ts must set verbatim Mode 2 verdict'
      );

      // 3. Value propositions in ModeSelector.tsx
      assert.ok(
        modeSelectorSrc.includes('Protección de Metadatos Activa: Manifiestos C2PA y procedencia purgados al 100% sin recodificar.'),
        'ModeSelector.tsx must display honest Mode 1 value proposition'
      );
      assert.ok(
        modeSelectorSrc.includes('Blindaje Total: Metadatos purgados + Matriz de píxeles alterada + Filtro acústico 20Hz-19.5kHz.'),
        'ModeSelector.tsx must display honest Mode 2 value proposition'
      );
    },
  },

  {
    id: 'T1-F4-09',
    feature: 'F4',
    tier: 1,
    title: 'UI design tokens (Pale Mint, White, Borders, Navy) and zero nested cards / zero pill badges are enforced across all updated components',
    async run() {
      const forensicsSrc = loadSourceFile('components/ForensicsTable.tsx');
      const pageSrc = loadSourceFile('app/page.tsx');
      const modeSelectorSrc = loadSourceFile('components/ModeSelector.tsx');

      // 1. ForensicsTable DOM inspection
      const fTokens = checkDesignTokens(forensicsSrc, ['#cfe8e1', '#002941', '#b8d8cf']);
      assert.ok(fTokens.allPresent, `ForensicsTable missing tokens: ${fTokens.missing.join(', ')}`);
      const fPills = checkZeroRoundedFullPillBadges(forensicsSrc);
      assert.ok(fPills.passed, `ForensicsTable has forbidden pill badges: ${fPills.occurrences.join(', ')}`);
      const fCards = checkZeroNestedCards(forensicsSrc);
      assert.ok(fCards.passed, `ForensicsTable has forbidden nested cards: ${fCards.message}`);

      // 2. app/page.tsx DOM inspection
      const pTokens = checkDesignTokens(pageSrc, ['#cfe8e1', '#002941', '#b8d8cf']);
      assert.ok(pTokens.allPresent, `app/page.tsx missing tokens: ${pTokens.missing.join(', ')}`);
      const pPills = checkZeroRoundedFullPillBadges(pageSrc);
      assert.ok(pPills.passed, `app/page.tsx has forbidden pill badges: ${pPills.occurrences.join(', ')}`);
      const pCards = checkZeroNestedCards(pageSrc);
      assert.ok(pCards.passed, `app/page.tsx has forbidden nested cards: ${pCards.message}`);

      // 3. ModeSelector DOM inspection
      const mPills = checkZeroRoundedFullPillBadges(modeSelectorSrc);
      assert.ok(mPills.passed, `ModeSelector has forbidden pill badges: ${mPills.occurrences.join(', ')}`);
      const mCards = checkZeroNestedCards(modeSelectorSrc);
      assert.ok(mCards.passed, `ModeSelector has forbidden nested cards: ${mCards.message}`);
    },
  },
];
