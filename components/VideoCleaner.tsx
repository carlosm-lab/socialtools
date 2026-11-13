'use client';

/**
 * CleanStream Studio — VideoCleaner Legacy Compatibility Wrapper
 * Strictly isolated per-session lifecycle via useFFmpegCleaner.
 * No module-level state, no global variables, no storage leaks.
 */

export { useFFmpegCleaner } from './useFFmpegCleaner';

export default function VideoCleaner() {
  return null;
}
