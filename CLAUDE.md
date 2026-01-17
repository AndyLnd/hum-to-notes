# Scale Transcript - Project Context

> **IMPORTANT**: Always update this file when making significant changes to the project. Add new components, modify architecture decisions, document new quirks discovered, or update technical details as the codebase evolves. This file should remain the authoritative reference for future sessions.

## What This App Does

A web app that records vocal melodies (humming/singing/lalala) and generates musical notation. Designed for beginners who want to transcribe melodies they can sing but can't write down.

## Tech Stack

- **Framework**: SvelteKit with Svelte 5 (runes: `$state`, `$derived`, `$effect`)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Audio**: WebAudio API (MediaStream, AnalyserNode)
- **Pitch Detection**: pitchfinder library (YIN algorithm)
- **Notation**: abcjs library (ABC notation format, SVG rendering, MIDI synthesis)

## Architecture

```
Audio Recording → Pitch Detection → Note Quantization → Tempo Quantization → ABC Notation → Staff/Piano Roll
(WebAudio API)    (YIN algorithm)   (Hz→MIDI→Note)      (grid snapping)      (AbcGenerator)   (abcjs + custom)
```

## Directory Structure

```
src/lib/
├── audio/
│   └── AudioRecorder.ts      # WebAudio microphone capture
├── pitch/
│   ├── PitchDetector.ts      # YIN algorithm + smoothing/hysteresis
│   └── NoteQuantizer.ts      # Pitch frames → discrete notes
├── notation/
│   ├── AbcGenerator.ts       # DetectedNote[] → ABC string
│   └── TempoQuantizer.ts     # BPM detection + grid quantization
├── stores/
│   └── audioState.svelte.ts  # Svelte 5 runes state management
├── types/
│   └── index.ts              # TypeScript interfaces
└── components/
    ├── RecordingControls.svelte  # Start/Stop/Reset buttons
    ├── PitchIndicator.svelte     # Real-time pitch display
    ├── PianoRoll.svelte          # Visual note display + playback
    └── NotationDisplay.svelte    # Staff notation via abcjs
```

## Key Technical Details

### Pitch Detection Stability
The pitch detector has extensive smoothing for untrained singers:
- 12-frame history buffer
- Note-based locking (stays on note until 2+ semitones away)
- Confirmation frames before accepting new notes
- 1 semitone tolerance for wobbly pitch

### Note Timing
All note start times are normalized to 0:
- TempoQuantizer normalizes quantized notes to start at 0
- Raw notes are also normalized when quantization is disabled
- This ensures playback position (elapsed time) matches piano roll visualization

### ABC Notation
- Middle C (C4) = 'C', C5 = 'c', C3 = 'C,'
- Sharps use caret: C# = '^C'
- Duration suffixes: '' = 1/8, '2' = 1/4, '4' = 1/2, '8' = whole

### Known Quirks
- Node 20.19+ or 22.12+ required (`.npmrc` has `engine-strict=true`). Using nvm with `default` alias set to 22.
- SVG staff notation needs explicit CSS for colors (was white-on-white)
- abcjs synth starts at first note (no leading silence)

## Running the Project

```bash
npm run dev
```

## Core Interfaces

```typescript
interface DetectedNote {
  note: string;        // 'C', 'C#', 'D', etc.
  octave: number;      // 4 = middle C octave
  midiNumber: number;  // 60 = middle C
  startTime: number;   // seconds from start (normalized to 0)
  duration: number;    // seconds
  frequency: number;   // Hz (average during note)
}

interface PitchData {
  frequency: number | null;
  clarity: number;     // 0-1, signal confidence
  timestamp: number;   // seconds
}
```

## State Flow

1. User clicks Record → AudioRecorder captures mic → AnalyserNode provides samples
2. PitchDetector runs YIN on each frame → returns frequency + clarity
3. NoteQuantizer tracks stable pitches → emits DetectedNote when note ends
4. On Stop → TempoQuantizer detects BPM and snaps to grid
5. AbcGenerator converts notes to ABC string
6. abcjs renders staff notation + provides synth playback
7. PianoRoll visualizes notes with colored bars + playhead
