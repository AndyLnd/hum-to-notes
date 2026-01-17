import { YIN } from 'pitchfinder';
import type { PitchData } from '$lib/types';

export class PitchDetector {
	private detectPitch: (buffer: Float32Array) => number | null;
	private readonly minFrequency = 80; // Hz - lower bound for human voice
	private readonly maxFrequency = 1000; // Hz - upper bound for typical singing

	// Smoothing and stability - tuned for untrained singers
	private readonly historySize = 12; // Larger window for more stability
	private pitchHistory: (number | null)[] = [];
	private smoothedFrequency: number | null = null;
	private readonly smoothingFactor = 0.15; // Very aggressive smoothing
	private currentMidiNote: number | null = null; // Track current quantized note

	constructor(sampleRate: number) {
		this.detectPitch = YIN({
			sampleRate,
			threshold: 0.1, // Very sensitive to quiet signals
			probabilityThreshold: 0.1 // Accept uncertain pitches
		});
	}

	detect(audioData: Float32Array, timestamp: number): PitchData {
		const rawFrequency = this.detectPitch(audioData);

		// Validate frequency is within expected vocal range
		const validFrequency =
			rawFrequency !== null && rawFrequency >= this.minFrequency && rawFrequency <= this.maxFrequency
				? rawFrequency
				: null;

		// Add to history
		this.pitchHistory.push(validFrequency);
		if (this.pitchHistory.length > this.historySize) {
			this.pitchHistory.shift();
		}

		// Apply median filter to remove outliers
		const medianFrequency = this.getMedianPitch();

		// Calculate clarity based on signal amplitude
		const clarity = this.calculateClarity(audioData);

		// Apply note-based stabilization
		if (medianFrequency !== null && clarity > 0.01) {
			const newMidiNote = this.frequencyToMidi(medianFrequency);

			if (this.currentMidiNote === null) {
				// First note - require strong confirmation
				if (this.countConfirmedPitches(newMidiNote) >= 5) {
					this.currentMidiNote = newMidiNote;
					this.smoothedFrequency = this.midiToFrequency(newMidiNote);
				}
			} else {
				// Check if we should switch notes
				const semitoneDistance = Math.abs(newMidiNote - this.currentMidiNote);

				if (semitoneDistance === 0) {
					// Same note - just smooth the frequency slightly
					this.smoothedFrequency =
						this.smoothingFactor * medianFrequency +
						(1 - this.smoothingFactor) * this.smoothedFrequency!;
				} else if (semitoneDistance >= 2) {
					// Significant jump (2+ semitones) - require strong confirmation
					const confirmed = this.countConfirmedPitches(newMidiNote);
					if (confirmed >= 6) {
						this.currentMidiNote = newMidiNote;
						this.smoothedFrequency = this.midiToFrequency(newMidiNote);
					}
					// Otherwise stick with current note
				} else {
					// Small change (1 semitone) - require very strong confirmation
					// This prevents wobbling between adjacent notes
					const confirmed = this.countConfirmedPitches(newMidiNote);
					if (confirmed >= 8) {
						this.currentMidiNote = newMidiNote;
						this.smoothedFrequency = this.midiToFrequency(newMidiNote);
					}
				}
			}
		} else {
			// No valid pitch or too quiet - check if we should reset
			const nullCount = this.pitchHistory.filter((p) => p === null).length;
			if (nullCount >= 6) {
				this.smoothedFrequency = null;
				this.currentMidiNote = null;
			}
		}

		return {
			frequency: this.smoothedFrequency,
			clarity,
			timestamp
		};
	}

	private frequencyToMidi(frequency: number): number {
		return Math.round(12 * Math.log2(frequency / 440) + 69);
	}

	private midiToFrequency(midi: number): number {
		return 440 * Math.pow(2, (midi - 69) / 12);
	}

	private countConfirmedPitches(targetMidi: number): number {
		return this.pitchHistory.filter((p) => {
			if (p === null) return false;
			const midi = this.frequencyToMidi(p);
			return midi === targetMidi;
		}).length;
	}

	private getMedianPitch(): number | null {
		const validPitches = this.pitchHistory.filter((p): p is number => p !== null);
		if (validPitches.length < 3) {
			return validPitches.length > 0 ? validPitches[validPitches.length - 1] : null;
		}

		// Sort and get median
		const sorted = [...validPitches].sort((a, b) => a - b);
		const mid = Math.floor(sorted.length / 2);
		return sorted.length % 2 === 0
			? (sorted[mid - 1] + sorted[mid]) / 2
			: sorted[mid];
	}

	private calculateClarity(audioData: Float32Array): number {
		// RMS amplitude as a proxy for signal clarity
		let sum = 0;
		for (let i = 0; i < audioData.length; i++) {
			sum += audioData[i] * audioData[i];
		}
		const rms = Math.sqrt(sum / audioData.length);
		// Normalize to 0-1 range - high multiplier for mobile sensitivity
		return Math.min(1, rms * 150);
	}

	reset(): void {
		this.pitchHistory = [];
		this.smoothedFrequency = null;
		this.currentMidiNote = null;
	}
}
