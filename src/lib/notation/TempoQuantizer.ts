import type { DetectedNote } from '$lib/types';

export interface QuantizationSettings {
	bpm: number;
	subdivision: number; // 4 = quarter notes, 8 = eighth notes, 16 = sixteenth notes
	swingAmount: number; // 0 = no swing, 0.5 = full swing
}

const DEFAULT_SETTINGS: QuantizationSettings = {
	bpm: 120,
	subdivision: 8, // Quantize to eighth notes
	swingAmount: 0
};

export class TempoQuantizer {
	private settings: QuantizationSettings;

	constructor(settings: Partial<QuantizationSettings> = {}) {
		this.settings = { ...DEFAULT_SETTINGS, ...settings };
	}

	/**
	 * Detect tempo from note durations
	 */
	detectTempo(notes: DetectedNote[]): number {
		if (notes.length < 2) return DEFAULT_SETTINGS.bpm;

		// Collect all note durations
		const durations = notes.map(n => n.duration);

		// Find the most common short duration (likely the beat unit)
		const shortDurations = durations.filter(d => d > 0.1 && d < 2);
		if (shortDurations.length === 0) return DEFAULT_SETTINGS.bpm;

		// Cluster durations and find the most common cluster
		const clusters = this.clusterDurations(shortDurations);
		const dominantDuration = clusters[0]?.center || 0.5;

		// Assume this duration is a quarter note and calculate BPM
		// But clamp to reasonable range
		let bpm = 60 / dominantDuration;

		// If BPM is too fast, it might be eighth notes
		if (bpm > 180) bpm /= 2;
		// If too slow, might be half notes
		if (bpm < 60) bpm *= 2;

		// Clamp to reasonable range
		return Math.max(60, Math.min(180, Math.round(bpm)));
	}

	private clusterDurations(durations: number[]): { center: number; count: number }[] {
		const sorted = [...durations].sort((a, b) => a - b);
		const clusters: { center: number; count: number; sum: number }[] = [];
		const tolerance = 0.15; // 150ms tolerance for clustering

		for (const duration of sorted) {
			const existingCluster = clusters.find(
				c => Math.abs(c.center - duration) < tolerance
			);

			if (existingCluster) {
				existingCluster.count++;
				existingCluster.sum += duration;
				existingCluster.center = existingCluster.sum / existingCluster.count;
			} else {
				clusters.push({ center: duration, count: 1, sum: duration });
			}
		}

		// Sort by count descending
		return clusters.sort((a, b) => b.count - a.count);
	}

	/**
	 * Quantize notes to the tempo grid
	 * Note: Start times are normalized so the first note starts at 0
	 */
	quantize(notes: DetectedNote[], autoDetectTempo = true): DetectedNote[] {
		if (notes.length === 0) return [];

		// Auto-detect tempo if requested
		if (autoDetectTempo) {
			this.settings.bpm = this.detectTempo(notes);
		}

		const beatDuration = 60 / this.settings.bpm; // Duration of one quarter note in seconds
		const gridSize = beatDuration / (this.settings.subdivision / 4); // Duration of one grid unit

		// Get the first note's start time as reference
		const firstNoteStart = notes[0].startTime;

		return notes.map((note, index) => {
			// Quantize start time relative to first note, normalized to start at 0
			const relativeStart = note.startTime - firstNoteStart;
			const quantizedStart = Math.round(relativeStart / gridSize) * gridSize;

			// Quantize duration to nearest grid unit (minimum 1 grid unit)
			const gridUnits = Math.max(1, Math.round(note.duration / gridSize));
			const quantizedDuration = gridUnits * gridSize;

			// Prevent overlap with next note
			let finalDuration = quantizedDuration;
			if (index < notes.length - 1) {
				const nextNote = notes[index + 1];
				const nextRelativeStart = nextNote.startTime - firstNoteStart;
				const nextQuantizedStart = Math.round(nextRelativeStart / gridSize) * gridSize;
				const maxDuration = nextQuantizedStart - quantizedStart - 0.01;
				if (maxDuration > 0 && finalDuration > maxDuration) {
					finalDuration = Math.max(gridSize, Math.floor(maxDuration / gridSize) * gridSize);
				}
			}

			return {
				...note,
				startTime: quantizedStart,
				duration: finalDuration
			};
		});
	}

	/**
	 * Get the current BPM setting
	 */
	getBpm(): number {
		return this.settings.bpm;
	}

	/**
	 * Set BPM manually
	 */
	setBpm(bpm: number): void {
		this.settings.bpm = Math.max(40, Math.min(240, bpm));
	}

	/**
	 * Set subdivision
	 */
	setSubdivision(subdivision: number): void {
		this.settings.subdivision = subdivision;
	}
}
