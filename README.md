# hum-to-notes

Web app that transcribes hummed or sung melodies into musical notation and piano roll visualization.

## Features

- **Real-time pitch detection** - Uses YIN algorithm to detect your voice
- **Piano roll visualization** - See your melody as colored bars, easy for beginners
- **Staff notation** - Traditional sheet music output via ABC notation
- **Tempo detection** - Automatically detects BPM and quantizes notes to a grid
- **Playback** - Listen to the transcribed melody with MIDI synthesis

## How It Works

1. Click **Record** and hum or sing a melody
2. Click **Stop** when finished
3. View your melody as a piano roll and staff notation
4. Adjust BPM or toggle quantization as needed
5. Click **Play** to hear the transcribed result

## Tech Stack

- [SvelteKit](https://svelte.dev/) with Svelte 5
- [pitchfinder](https://github.com/peterkhayes/pitchfinder) - YIN pitch detection
- [abcjs](https://www.abcjs.net/) - ABC notation rendering and MIDI synthesis
- WebAudio API for microphone capture

## Development

```bash
npm install
npm run dev
```

Requires Node 20.19+ or 22.12+.

## License

MIT
