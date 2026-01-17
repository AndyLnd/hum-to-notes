export class AudioRecorder {
	private audioContext: AudioContext | null = null;
	private analyser: AnalyserNode | null = null;
	private mediaStream: MediaStream | null = null;
	private sourceNode: MediaStreamAudioSourceNode | null = null;
	private dataArray: Float32Array<ArrayBuffer> | null = null;
	private isRecording = false;

	readonly sampleRate = 44100;
	readonly fftSize = 2048;

	async start(): Promise<void> {
		if (this.isRecording) return;

		try {
			this.mediaStream = await navigator.mediaDevices.getUserMedia({
				audio: {
					echoCancellation: false,
					noiseSuppression: false,
					autoGainControl: false
				}
			});

			this.audioContext = new AudioContext({ sampleRate: this.sampleRate });
			this.analyser = this.audioContext.createAnalyser();
			this.analyser.fftSize = this.fftSize;
			this.analyser.smoothingTimeConstant = 0;

			this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
			this.sourceNode.connect(this.analyser);

			this.dataArray = new Float32Array(this.analyser.fftSize);
			this.isRecording = true;
		} catch (error) {
			this.cleanup();
			throw error;
		}
	}

	stop(): void {
		this.isRecording = false;
		this.cleanup();
	}

	private cleanup(): void {
		if (this.sourceNode) {
			this.sourceNode.disconnect();
			this.sourceNode = null;
		}
		if (this.mediaStream) {
			this.mediaStream.getTracks().forEach((track) => track.stop());
			this.mediaStream = null;
		}
		if (this.audioContext) {
			this.audioContext.close();
			this.audioContext = null;
		}
		this.analyser = null;
		this.dataArray = null;
	}

	getTimeDomainData(): Float32Array | null {
		if (!this.analyser || !this.dataArray || !this.isRecording) {
			return null;
		}
		this.analyser.getFloatTimeDomainData(this.dataArray);
		return this.dataArray;
	}

	getCurrentTime(): number {
		return this.audioContext?.currentTime ?? 0;
	}

	getIsRecording(): boolean {
		return this.isRecording;
	}

	getSampleRate(): number {
		return this.audioContext?.sampleRate ?? this.sampleRate;
	}
}
