import type { NoteInfo, PitchData, DetectedNote } from '$lib/types';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const A4_FREQUENCY = 440;
const A4_MIDI = 69;

export class NoteQuantizer {
	// Tuned for untrained singers - very forgiving
	private readonly minStableDuration = 0.18; // 180ms minimum note duration
	private readonly minClarity = 0.01; // minimum signal clarity - very sensitive for mobile
	private readonly confirmationFrames = 5; // frames needed to confirm note change

	private currentNoteStart: number | null = null;
	private currentMidi: number | null = null;
	private frequencySum: number = 0;
	private frequencyCount: number = 0;

	// For hysteresis - track pending note changes
	private pendingMidi: number | null = null;
	private pendingCount: number = 0;
	private silenceCount: number = 0;
	private readonly silenceThreshold = 8; // frames of silence before ending note

	frequencyToNoteInfo(frequency: number): NoteInfo {
		// Convert frequency to MIDI number
		const midiFloat = 12 * Math.log2(frequency / A4_FREQUENCY) + A4_MIDI;
		const midiNumber = Math.round(midiFloat);

		// Calculate cents deviation from nearest note
		const cents = Math.round((midiFloat - midiNumber) * 100);

		// Get note name and octave
		const noteIndex = ((midiNumber % 12) + 12) % 12;
		const octave = Math.floor(midiNumber / 12) - 1;

		return {
			note: NOTE_NAMES[noteIndex],
			octave,
			midiNumber,
			cents
		};
	}

	processFrame(pitchData: PitchData): DetectedNote | null {
		const { frequency, clarity, timestamp } = pitchData;

		// No valid pitch detected or too quiet
		if (frequency === null || clarity < this.minClarity) {
			this.silenceCount++;
			this.pendingMidi = null;
			this.pendingCount = 0;

			// End current note after enough silence
			if (this.silenceCount >= this.silenceThreshold && this.currentMidi !== null) {
				return this.finishCurrentNote(timestamp);
			}
			return null;
		}

		// Reset silence counter when we have a pitch
		this.silenceCount = 0;

		const noteInfo = this.frequencyToNoteInfo(frequency);

		// Check if this is the same note as current (allow 1 semitone tolerance for wobbly singing)
		if (this.currentMidi !== null) {
			const distance = Math.abs(noteInfo.midiNumber - this.currentMidi);
			if (distance <= 1) {
				// Same note or adjacent - keep tracking current note
				// Only add to average if it's exactly the same note
				if (distance === 0) {
					this.frequencySum += frequency;
					this.frequencyCount++;
				}
				// Reset any pending note change
				this.pendingMidi = null;
				this.pendingCount = 0;
				return null;
			}
		}

		// Different note detected (2+ semitones away) - use hysteresis
		if (noteInfo.midiNumber === this.pendingMidi) {
			// Same as pending - increment confirmation counter
			this.pendingCount++;

			if (this.pendingCount >= this.confirmationFrames) {
				// Confirmed new note - finish previous and start new
				const finishedNote = this.finishCurrentNote(timestamp);

				// Start tracking new note
				this.currentNoteStart = timestamp;
				this.currentMidi = noteInfo.midiNumber;
				this.frequencySum = frequency;
				this.frequencyCount = 1;
				this.pendingMidi = null;
				this.pendingCount = 0;

				return finishedNote;
			}
		} else {
			// Different from pending - start new pending
			this.pendingMidi = noteInfo.midiNumber;
			this.pendingCount = 1;
		}

		// If no current note yet, start one after confirmation
		if (this.currentMidi === null && this.pendingCount >= this.confirmationFrames) {
			this.currentNoteStart = timestamp;
			this.currentMidi = noteInfo.midiNumber;
			this.frequencySum = frequency;
			this.frequencyCount = 1;
			this.pendingMidi = null;
			this.pendingCount = 0;
		} else if (this.currentMidi === null) {
			// Track pending for first note
			if (this.pendingMidi === null) {
				this.pendingMidi = noteInfo.midiNumber;
				this.pendingCount = 1;
			}
		}

		return null;
	}

	private finishCurrentNote(endTime: number): DetectedNote | null {
		if (this.currentNoteStart === null || this.currentMidi === null) {
			this.resetTracking();
			return null;
		}

		const duration = endTime - this.currentNoteStart;

		// Note too short - discard
		if (duration < this.minStableDuration) {
			this.resetTracking();
			return null;
		}

		const avgFrequency = this.frequencyCount > 0
			? this.frequencySum / this.frequencyCount
			: 440 * Math.pow(2, (this.currentMidi - 69) / 12); // fallback to MIDI frequency
		const noteInfo = this.frequencyToNoteInfo(avgFrequency);

		const note: DetectedNote = {
			note: noteInfo.note,
			octave: noteInfo.octave,
			midiNumber: noteInfo.midiNumber,
			startTime: this.currentNoteStart,
			duration,
			frequency: avgFrequency
		};

		this.resetTracking();
		return note;
	}

	private resetTracking(): void {
		this.currentNoteStart = null;
		this.currentMidi = null;
		this.frequencySum = 0;
		this.frequencyCount = 0;
	}

	// Call this when recording stops to get any remaining note
	flush(endTime: number): DetectedNote | null {
		return this.finishCurrentNote(endTime);
	}

	reset(): void {
		this.resetTracking();
		this.pendingMidi = null;
		this.pendingCount = 0;
		this.silenceCount = 0;
	}
}
