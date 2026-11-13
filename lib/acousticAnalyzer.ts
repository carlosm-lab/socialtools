/**
 * Physical Acoustic Analyzer for CleanStream Studio.
 *
 * Implements pure mathematical Radix-2 Cooley-Tukey Fast Fourier Transform (FFT)
 * with Hann windowing for physical spectrum analysis and ultrasonic energy
 * detection (>19.5 kHz) using the Web Audio API (or pure Float32Array PCM buffers).
 */

export interface AcousticAnalysisResult {
  hasAudio: boolean;
  sampleRate: number;
  durationSec: number;
  hasUltrasonicEnergy: boolean;
  peakFrequencyHz: number;
  peakUltrasonicDb: number;
  ultrasonicEnergyRatio: number;
  details: string;
}

export interface SyntheticAudioOptions {
  sampleRate: number;
  durationSec: number;
  frequencies: number[];
  amplitudes?: number[];
}

/**
 * Computes in-place Radix-2 Cooley-Tukey FFT for a real input array whose length is a power of 2.
 * Returns complex components { re, im }.
 */
export function computeRadix2FFT(input: Float32Array): { re: Float32Array; im: Float32Array } {
  const N = input.length;
  if ((N & (N - 1)) !== 0) {
    throw new Error(`FFT size must be a power of 2, received ${N}`);
  }

  const re = new Float32Array(input);
  const im = new Float32Array(N);

  // Bit-reversal permutation
  let j = 0;
  for (let i = 0; i < N - 1; i++) {
    if (i < j) {
      const tempRe = re[i];
      re[i] = re[j];
      re[j] = tempRe;
      const tempIm = im[i];
      im[i] = im[j];
      im[j] = tempIm;
    }
    let k = N >> 1;
    while (k <= j) {
      j -= k;
      k >>= 1;
    }
    j += k;
  }

  // Cooley-Tukey decimation-in-time butterflies
  for (let len = 2; len <= N; len <<= 1) {
    const halfLen = len >> 1;
    const angle = (-2 * Math.PI) / len;
    const wStepRe = Math.cos(angle);
    const wStepIm = Math.sin(angle);

    for (let i = 0; i < N; i += len) {
      let wRe = 1;
      let wIm = 0;
      for (let k = 0; k < halfLen; k++) {
        const uRe = re[i + k];
        const uIm = im[i + k];
        const vRe = re[i + k + halfLen] * wRe - im[i + k + halfLen] * wIm;
        const vIm = re[i + k + halfLen] * wIm + im[i + k + halfLen] * wRe;

        re[i + k] = uRe + vRe;
        im[i + k] = uIm + vIm;
        re[i + k + halfLen] = uRe - vRe;
        im[i + k + halfLen] = uIm - vIm;

        const nextWRe = wRe * wStepRe - wIm * wStepIm;
        const nextWIm = wRe * wStepIm + wIm * wStepRe;
        wRe = nextWRe;
        wIm = nextWIm;
      }
    }
  }

  return { re, im };
}

/**
 * Generates synthetic PCM audio data for automated testing and verification
 * without requiring browser GUI or external media files.
 */
export function generateSyntheticAudioBuffer(options: {
  sampleRate: number;
  durationSec: number;
  frequencies: number[];
  amplitudes?: number[];
}): Float32Array {
  const { sampleRate, durationSec, frequencies, amplitudes } = options;
  const numSamples = Math.floor(sampleRate * durationSec);
  const buffer = new Float32Array(numSamples);
  const amps =
    amplitudes && amplitudes.length === frequencies.length
      ? amplitudes
      : frequencies.map(() => 1.0 / Math.max(1, frequencies.length));

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let sample = 0;
    for (let f = 0; f < frequencies.length; f++) {
      sample += amps[f] * Math.sin(2 * Math.PI * frequencies[f] * t);
    }
    buffer[i] = sample;
  }

  return buffer;
}

/**
 * Analyzes audio spectrum directly from PCM Float32Array samples using Radix-2 FFT and Hann windowing.
 * Decoupled from browser DOM for testing and headless execution.
 */
export function analyzeAudioSpectrum(
  channelData: Float32Array,
  sampleRate: number
): AcousticAnalysisResult {
  if (!channelData || channelData.length === 0 || sampleRate <= 0) {
    return {
      hasAudio: false,
      sampleRate: sampleRate || 0,
      durationSec: 0,
      hasUltrasonicEnergy: false,
      peakFrequencyHz: 0,
      peakUltrasonicDb: -100,
      ultrasonicEnergyRatio: 0,
      details: 'Sin pista de audio (Inmune a rastreo acústico)',
    };
  }

  const durationSec = channelData.length / sampleRate;
  const fftSize = 2048;

  let samples = channelData;
  if (samples.length < fftSize) {
    const padded = new Float32Array(fftSize);
    padded.set(samples);
    samples = padded;
  }

  // Pick up to 8 windows across the sample data
  const numWindows = Math.min(8, Math.max(1, Math.floor(samples.length / fftSize)));
  const step =
    numWindows > 1
      ? Math.floor((samples.length - fftSize) / (numWindows - 1))
      : fftSize;

  let globalPeakDb = -120;
  let globalPeakFreq = 0;
  let peakUltrasonicDb = -120;
  let totalEnergy = 0;
  let totalUltrasonicEnergy = 0;

  const nyquist = sampleRate / 2;
  const ultrasonicThresholdHz = 19500;

  // Hann window to eliminate spectral leakage
  const hann = new Float32Array(fftSize);
  for (let n = 0; n < fftSize; n++) {
    hann[n] = 0.5 * (1 - Math.cos((2 * Math.PI * n) / (fftSize - 1)));
  }

  const windowSlice = new Float32Array(fftSize);

  for (let w = 0; w < numWindows; w++) {
    const offset = Math.min(samples.length - fftSize, w * step);
    for (let n = 0; n < fftSize; n++) {
      windowSlice[n] = samples[offset + n] * hann[n];
    }

    const { re, im } = computeRadix2FFT(windowSlice);
    const halfSize = fftSize / 2;

    for (let k = 1; k < halfSize; k++) {
      const freq = (k * sampleRate) / fftSize;
      // Normalization by (fftSize / 2) accounts for Hann window loss (~2x)
      const mag = (Math.sqrt(re[k] * re[k] + im[k] * im[k]) * 2) / (fftSize / 2);
      const energy = mag * mag;
      totalEnergy += energy;

      const db = 20 * Math.log10(Math.max(mag, 1e-6));

      if (db > globalPeakDb) {
        globalPeakDb = db;
        globalPeakFreq = Math.round(freq);
      }

      if (freq >= ultrasonicThresholdHz) {
        totalUltrasonicEnergy += energy;
        if (db > peakUltrasonicDb) {
          peakUltrasonicDb = db;
        }
      }
    }
  }

  const ultrasonicRatio = totalEnergy > 0 ? totalUltrasonicEnergy / totalEnergy : 0;
  const canHaveUltrasonic = nyquist > ultrasonicThresholdHz;

  // Active ultrasonic tracking carriers register peaks > -50 dBFS and significant energy ratio.
  // Ambient noise floor registers < -70 dBFS.
  const hasUltrasonicEnergy =
    canHaveUltrasonic && peakUltrasonicDb > -50 && ultrasonicRatio > 0.001;

  let details = '';
  if (!canHaveUltrasonic) {
    details = `Frecuencia de muestreo (${sampleRate} Hz, Nyquist ${Math.round(
      nyquist
    )} Hz): incapaz de albergar portadoras >19.5 kHz.`;
  } else if (hasUltrasonicEnergy) {
    details = `Portadora ultrasónica activa detectada a ${peakUltrasonicDb.toFixed(
      1
    )} dBFS (${(ultrasonicRatio * 100).toFixed(2)}% de energía en >19.5 kHz).`;
  } else {
    details = `Espectro ultrasónico limpio (${peakUltrasonicDb.toFixed(
      1
    )} dBFS, nivel de ruido ambiente en banda >19.5 kHz).`;
  }

  return {
    hasAudio: true,
    sampleRate,
    durationSec,
    hasUltrasonicEnergy,
    peakFrequencyHz: globalPeakFreq,
    peakUltrasonicDb: Number(peakUltrasonicDb.toFixed(1)),
    ultrasonicEnergyRatio: Number(ultrasonicRatio.toFixed(6)),
    details,
  };
}

/**
 * Decodes audio from video/audio file via browser Web Audio API AudioContext
 * and analyzes physical frequency spectrum.
 */
export async function analyzeBrowserAudio(file: File): Promise<AcousticAnalysisResult> {
  if (typeof window === 'undefined') {
    return {
      hasAudio: false,
      sampleRate: 0,
      durationSec: 0,
      hasUltrasonicEnergy: false,
      peakFrequencyHz: 0,
      peakUltrasonicDb: -100,
      ultrasonicEnergyRatio: 0,
      details: 'Entorno no interactivo (AudioContext no disponible en SSR/Node)',
    };
  }

  const AudioCtxClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

  if (!AudioCtxClass) {
    return {
      hasAudio: false,
      sampleRate: 0,
      durationSec: 0,
      hasUltrasonicEnergy: false,
      peakFrequencyHz: 0,
      peakUltrasonicDb: -100,
      ultrasonicEnergyRatio: 0,
      details: 'Web Audio API no soportado en este navegador',
    };
  }

  try {
    // Read up to 32MB sample slice to prevent OOM on very large files
    const sampleSize = Math.min(file.size, 32 * 1024 * 1024);
    const slice = file.slice(0, sampleSize);
    const arrayBuffer = await slice.arrayBuffer();

    const audioCtx = new AudioCtxClass();
    let audioBuffer: AudioBuffer;
    try {
      // Pass copy of arrayBuffer because decodeAudioData can detach the buffer
      audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
    } finally {
      try {
        await audioCtx.close();
      } catch {
        // ignore
      }
    }

    if (!audioBuffer || audioBuffer.numberOfChannels === 0 || audioBuffer.length === 0) {
      return {
        hasAudio: false,
        sampleRate: 0,
        durationSec: 0,
        hasUltrasonicEnergy: false,
        peakFrequencyHz: 0,
        peakUltrasonicDb: -100,
        ultrasonicEnergyRatio: 0,
        details: 'Sin pista de audio decodificable (Inmune a rastreo acústico)',
      };
    }

    const channelData = audioBuffer.getChannelData(0);
    return analyzeAudioSpectrum(channelData, audioBuffer.sampleRate);
  } catch {
    // Files without audio tracks or unsupported codecs gracefully return hasAudio: false
    return {
      hasAudio: false,
      sampleRate: 0,
      durationSec: 0,
      hasUltrasonicEnergy: false,
      peakFrequencyHz: 0,
      peakUltrasonicDb: -100,
      ultrasonicEnergyRatio: 0,
      details: 'Sin pista de audio decodificable (Inmune a rastreo acústico)',
    };
  }
}
