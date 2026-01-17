export interface PitchData {
	frequency: number | null;
	clarity: number;
	timestamp: number;
}

export interface DetectedNote {
	note: string;
	octave: number;
	midiNumber: number;
	startTime: number;
	duration: number;
	frequency: number;
}

export interface RecordingState {
	isRecording: boolean;
	currentPitch: PitchData | null;
	detectedNotes: DetectedNote[];
	abcNotation: string;
	error: string | null;
}

export interface NoteInfo {
	note: string;
	octave: number;
	midiNumber: number;
	cents: number;
}

export type RecordingStatus = 'idle' | 'recording' | 'processing' | 'complete';
