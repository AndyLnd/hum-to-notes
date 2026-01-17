import { AudioRecorder } from '$lib/audio/AudioRecorder';
import { PitchDetector } from '$lib/pitch/PitchDetector';
import { NoteQuantizer } from '$lib/pitch/NoteQuantizer';
import { AbcGenerator } from '$lib/notation/AbcGenerator';
import { TempoQuantizer } from '$lib/notation/TempoQuantizer';
import type { PitchData, DetectedNote, RecordingStatus } from '$lib/types';

class AudioState {
	status = $state<RecordingStatus>('idle');
	currentPitch = $state<PitchData | null>(null);
	detectedNotes = $state<DetectedNote[]>([]);
	rawNotes = $state<DetectedNote[]>([]); // Unquantized notes
	abcNotation = $state<string>('');
	error = $state<string | null>(null);
	detectedBpm = $state<number>(120);
	quantizeEnabled = $state<boolean>(false);

	// Playback state
	isPlaying = $state(false);
	playbackPosition = $state(0); // in seconds

	private recorder: AudioRecorder | null = null;
	private pitchDetector: PitchDetector | null = null;
	private noteQuantizer: NoteQuantizer | null = null;
	private abcGenerator: AbcGenerator;
	private tempoQuantizer: TempoQuantizer;
	private animationFrameId: number | null = null;
	private recordingStartTime: number = 0;
	private playbackAnimationId: number | null = null;
	private playbackStartTime: number = 0;
	private playbackScaleFactor: number = 1;

	constructor() {
		this.abcGenerator = new AbcGenerator();
		this.tempoQuantizer = new TempoQuantizer();
	}

	async startRecording(): Promise<void> {
		if (this.status === 'recording') return;

		try {
			this.error = null;
			this.detectedNotes = [];
			this.rawNotes = [];
			this.abcNotation = '';
			this.currentPitch = null;

			this.recorder = new AudioRecorder();
			await this.recorder.start();

			this.pitchDetector = new PitchDetector(this.recorder.getSampleRate());
			this.noteQuantizer = new NoteQuantizer();

			this.status = 'recording';
			this.recordingStartTime = performance.now() / 1000;
			this.processAudio();
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Failed to start recording';
			this.status = 'idle';
		}
	}

	stopRecording(): void {
		if (this.status !== 'recording') return;

		this.status = 'processing';

		if (this.animationFrameId !== null) {
			cancelAnimationFrame(this.animationFrameId);
			this.animationFrameId = null;
		}

		// Flush any remaining note
		if (this.noteQuantizer) {
			const currentTime = (performance.now() / 1000) - this.recordingStartTime;
			const finalNote = this.noteQuantizer.flush(currentTime);
			if (finalNote) {
				this.rawNotes = [...this.rawNotes, finalNote];
			}
		}

		this.recorder?.stop();
		this.recorder = null;
		this.pitchDetector = null;
		this.currentPitch = null;

		// Apply tempo quantization or normalize raw notes
		if (this.quantizeEnabled && this.rawNotes.length > 0) {
			this.detectedNotes = this.tempoQuantizer.quantize(this.rawNotes, true);
			this.detectedBpm = this.tempoQuantizer.getBpm();
		} else {
			this.detectedNotes = this.normalizeNoteTimes(this.rawNotes);
		}

		// Generate ABC notation with detected BPM
		this.abcGenerator.setBpm(this.detectedBpm);
		this.abcNotation = this.abcGenerator.generate(this.detectedNotes);
		this.status = 'complete';
	}

	private processAudio(): void {
		if (this.status !== 'recording' || !this.recorder || !this.pitchDetector || !this.noteQuantizer) {
			return;
		}

		const audioData = this.recorder.getTimeDomainData();
		if (audioData) {
			const currentTime = (performance.now() / 1000) - this.recordingStartTime;
			const pitchData = this.pitchDetector.detect(audioData, currentTime);
			this.currentPitch = pitchData;

			const detectedNote = this.noteQuantizer.processFrame(pitchData);
			if (detectedNote) {
				this.rawNotes = [...this.rawNotes, detectedNote];
			}
		}

		this.animationFrameId = requestAnimationFrame(() => this.processAudio());
	}

	reset(): void {
		this.stopRecording();
		this.stopPlayback();
		this.status = 'idle';
		this.currentPitch = null;
		this.detectedNotes = [];
		this.rawNotes = [];
		this.abcNotation = '';
		this.error = null;
	}

	setBpm(bpm: number): void {
		this.detectedBpm = bpm;
		this.tempoQuantizer.setBpm(bpm);

		// Re-quantize if we have notes
		if (this.rawNotes.length > 0 && this.quantizeEnabled) {
			this.detectedNotes = this.tempoQuantizer.quantize(this.rawNotes, false);
			this.abcGenerator.setBpm(this.detectedBpm);
			this.abcNotation = this.abcGenerator.generate(this.detectedNotes);
		}
	}

	toggleQuantize(): void {
		this.quantizeEnabled = !this.quantizeEnabled;

		if (this.rawNotes.length > 0) {
			if (this.quantizeEnabled) {
				this.detectedNotes = this.tempoQuantizer.quantize(this.rawNotes, false);
			} else {
				this.detectedNotes = this.normalizeNoteTimes(this.rawNotes);
			}
			this.abcGenerator.setBpm(this.detectedBpm);
			this.abcNotation = this.abcGenerator.generate(this.detectedNotes);
		}
	}

	/**
	 * Normalize note start times so the first note starts at 0
	 */
	private normalizeNoteTimes(notes: DetectedNote[]): DetectedNote[] {
		if (notes.length === 0) return [];
		const firstStart = notes[0].startTime;
		return notes.map(note => ({
			...note,
			startTime: note.startTime - firstStart
		}));
	}

	startPlayback(): void {
		this.startPlaybackWithScale(1);
	}

	startPlaybackWithScale(scaleFactor: number): void {
		if (this.isPlaying || this.detectedNotes.length === 0) return;

		this.isPlaying = true;
		this.playbackScaleFactor = scaleFactor;
		// Notes are normalized to start at 0, so playback starts at 0
		this.playbackPosition = 0;
		this.playbackStartTime = performance.now();
		this.updatePlaybackPosition();
	}

	stopPlayback(): void {
		this.isPlaying = false;
		this.playbackPosition = 0;
		if (this.playbackAnimationId !== null) {
			cancelAnimationFrame(this.playbackAnimationId);
			this.playbackAnimationId = null;
		}
	}

	private updatePlaybackPosition(): void {
		if (!this.isPlaying || this.detectedNotes.length === 0) return;

		const elapsed = (performance.now() - this.playbackStartTime) / 1000;
		// Scale elapsed time to match piano roll duration
		this.playbackPosition = elapsed * this.playbackScaleFactor;

		// Calculate total duration
		const lastNote = this.detectedNotes[this.detectedNotes.length - 1];
		const totalDuration = lastNote.startTime + lastNote.duration;

		if (this.playbackPosition >= totalDuration) {
			this.stopPlayback();
			return;
		}

		this.playbackAnimationId = requestAnimationFrame(() => this.updatePlaybackPosition());
	}
}

export const audioState = new AudioState();
