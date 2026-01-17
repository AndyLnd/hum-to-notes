import type { DetectedNote } from '$lib/types';

// ABC note names for each semitone (C=0)
const ABC_NOTES: Record<string, string> = {
	'C': 'C',
	'C#': '^C',
	'D': 'D',
	'D#': '^D',
	'E': 'E',
	'F': 'F',
	'F#': '^F',
	'G': 'G',
	'G#': '^G',
	'A': 'A',
	'A#': '^A',
	'B': 'B'
};

export class AbcGenerator {
	private bpm = 120;
	private readonly defaultNoteLength = 8; // 1/8 note as base

	setBpm(bpm: number): void {
		this.bpm = bpm;
	}

	getBpm(): number {
		return this.bpm;
	}

	generate(notes: DetectedNote[]): string {
		if (notes.length === 0) {
			return '';
		}

		const header = this.generateHeader();
		const body = this.generateBody(notes);

		return `${header}${body}`;
	}

	private generateHeader(): string {
		return `X:1
T:Recorded Melody
M:4/4
L:1/${this.defaultNoteLength}
Q:1/4=${this.bpm}
K:C
`;
	}

	private generateBody(notes: DetectedNote[]): string {
		const abcNotes: string[] = [];
		let currentMeasureDuration = 0;
		const measureDuration = this.defaultNoteLength; // 8 eighth notes per measure in 4/4

		for (const note of notes) {
			const abcNote = this.noteToAbc(note);
			abcNotes.push(abcNote);

			// Calculate duration in eighth notes
			const durationInEighths = this.durationToEighths(note.duration);
			currentMeasureDuration += durationInEighths;

			// Add bar line every measure
			if (currentMeasureDuration >= measureDuration) {
				abcNotes.push('|');
				currentMeasureDuration = currentMeasureDuration % measureDuration;
			}
		}

		// Add final bar line if not already there
		const body = abcNotes.join(' ');
		return body.endsWith('|') ? body + '|' : body + ' |]';
	}

	private noteToAbc(note: DetectedNote): string {
		const baseNote = ABC_NOTES[note.note] || note.note;
		let noteStr = baseNote;

		// ABC notation: middle C (C4) is written as 'C'
		// C5 is 'c', C6 is 'c'', C3 is 'C,', C2 is 'C,,'
		if (note.octave >= 5) {
			// Make the note letter lowercase (handle sharps: ^C -> ^c)
			noteStr = baseNote.replace(/([A-G])/, (match) => match.toLowerCase());
			if (note.octave > 5) {
				noteStr += "'".repeat(note.octave - 5);
			}
		} else if (note.octave < 4) {
			// Octave 3 and below add commas
			noteStr += ','.repeat(4 - note.octave);
		}

		const durationSuffix = this.getDurationSuffix(note.duration);
		return `${noteStr}${durationSuffix}`;
	}

	private getDurationSuffix(duration: number): string {
		// Convert duration in seconds to note length relative to 1/8 note
		// At 120 BPM, one beat (quarter note) = 0.5 seconds
		// An eighth note = 0.25 seconds
		const eighthNoteDuration = 60 / this.bpm / 2;
		const relativeLength = duration / eighthNoteDuration;

		// Round to nearest standard note length
		if (relativeLength <= 0.75) return ''; // eighth note (default)
		if (relativeLength <= 1.5) return ''; // still counts as eighth
		if (relativeLength <= 3) return '2'; // quarter note
		if (relativeLength <= 6) return '4'; // half note
		return '8'; // whole note
	}

	private durationToEighths(duration: number): number {
		const eighthNoteDuration = 60 / this.bpm / 2;
		const relativeLength = duration / eighthNoteDuration;

		if (relativeLength <= 1.5) return 1;
		if (relativeLength <= 3) return 2;
		if (relativeLength <= 6) return 4;
		return 8;
	}
}
