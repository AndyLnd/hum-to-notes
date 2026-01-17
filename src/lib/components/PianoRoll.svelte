<script lang="ts">
	import { audioState } from '$lib/stores/audioState.svelte';
	import { onMount, onDestroy } from 'svelte';

	let abcjs: typeof import('abcjs') | null = $state(null);
	let synthControl: any = $state(null);

	onMount(async () => {
		abcjs = await import('abcjs');
	});

	onDestroy(() => {
		if (synthControl) {
			synthControl.stop();
		}
		audioState.stopPlayback();
	});

	async function playMelody() {
		if (!abcjs || !audioState.abcNotation) return;

		if (audioState.isPlaying) {
			synthControl?.stop();
			audioState.stopPlayback();
			return;
		}

		try {
			// Create a temporary visual object for the synth
			const visualObj = abcjs.renderAbc('*', audioState.abcNotation)[0];

			const synth = new abcjs.synth.CreateSynth();
			await synth.init({
				visualObj,
				options: {
					soundFontUrl: 'https://paulrosen.github.io/midi-js-soundfonts/FluidR3_GM/',
					program: 73 // Flute sound
				}
			});
			await synth.prime();

			synthControl = synth;
			audioState.startPlayback();

			synth.start();

			// Stop synth when playback ends
			const lastNote = audioState.detectedNotes[audioState.detectedNotes.length - 1];
			const firstNote = audioState.detectedNotes[0];
			const totalDuration = (lastNote.startTime + lastNote.duration) - firstNote.startTime;
			setTimeout(() => {
				synthControl = null;
			}, totalDuration * 1000 + 500);
		} catch (err) {
			console.error('Playback error:', err);
			audioState.stopPlayback();
		}
	}

	const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
	const KEY_HEIGHT = 24;
	const PIXELS_PER_SECOND = 100;

	// Calculate the range of notes to display
	let noteRange = $derived.by(() => {
		if (audioState.detectedNotes.length === 0) {
			return { min: 60, max: 72 }; // Default C4 to C5
		}
		const midiNumbers = audioState.detectedNotes.map((n) => n.midiNumber);
		const min = Math.min(...midiNumbers);
		const max = Math.max(...midiNumbers);
		// Add padding of 2 notes on each side
		return { min: min - 2, max: max + 2 };
	});

	// Generate piano keys for the range
	let pianoKeys = $derived.by(() => {
		const keys = [];
		for (let midi = noteRange.max; midi >= noteRange.min; midi--) {
			const noteIndex = ((midi % 12) + 12) % 12;
			const octave = Math.floor(midi / 12) - 1;
			const noteName = NOTE_NAMES[noteIndex];
			const isBlack = noteName.includes('#');
			keys.push({
				midi,
				name: `${noteName}${octave}`,
				displayName: noteName.replace('#', '♯'),
				octave,
				isBlack
			});
		}
		return keys;
	});

	// Calculate total duration for the roll width
	let totalDuration = $derived.by(() => {
		if (audioState.detectedNotes.length === 0) return 5;
		const lastNote = audioState.detectedNotes[audioState.detectedNotes.length - 1];
		return lastNote.startTime + lastNote.duration + 0.5;
	});

	let rollWidth = $derived(totalDuration * PIXELS_PER_SECOND);

	// Playback position in pixels
	let playheadPosition = $derived(audioState.playbackPosition * PIXELS_PER_SECOND);

	function getNoteStyle(note: typeof audioState.detectedNotes[0]) {
		const top = (noteRange.max - note.midiNumber) * KEY_HEIGHT;
		const left = note.startTime * PIXELS_PER_SECOND;
		const width = Math.max(note.duration * PIXELS_PER_SECOND, 10);
		return `top: ${top}px; left: ${left}px; width: ${width}px; height: ${KEY_HEIGHT - 2}px;`;
	}

	function getNoteColor(note: typeof audioState.detectedNotes[0]) {
		// Color based on note name for easy recognition
		const colors: Record<string, string> = {
			'C': 'bg-red-500',
			'C#': 'bg-red-700',
			'D': 'bg-orange-500',
			'D#': 'bg-orange-700',
			'E': 'bg-yellow-500',
			'F': 'bg-green-500',
			'F#': 'bg-green-700',
			'G': 'bg-cyan-500',
			'G#': 'bg-cyan-700',
			'A': 'bg-blue-500',
			'A#': 'bg-blue-700',
			'B': 'bg-purple-500'
		};
		return colors[note.note] || 'bg-blue-500';
	}
</script>

{#if audioState.status === 'complete' && audioState.detectedNotes.length > 0}
	<div class="bg-gray-800 rounded-lg p-6">
		<div class="flex items-center justify-between mb-4 flex-wrap gap-4">
			<h2 class="text-lg font-semibold text-white">Piano Roll</h2>

			<div class="flex items-center gap-4">
				<!-- Tempo controls -->
				<div class="flex items-center gap-2">
					<button
						onclick={() => audioState.setBpm(audioState.detectedBpm - 5)}
						class="w-8 h-8 bg-gray-700 hover:bg-gray-600 text-white rounded flex items-center justify-center"
					>-</button>
					<span class="text-white font-mono w-20 text-center">
						{audioState.detectedBpm} BPM
					</span>
					<button
						onclick={() => audioState.setBpm(audioState.detectedBpm + 5)}
						class="w-8 h-8 bg-gray-700 hover:bg-gray-600 text-white rounded flex items-center justify-center"
					>+</button>
				</div>

				<!-- Quantize toggle -->
				<button
					onclick={() => audioState.toggleQuantize()}
					class="px-3 py-1.5 rounded text-sm transition-colors"
					class:bg-green-600={audioState.quantizeEnabled}
					class:hover:bg-green-700={audioState.quantizeEnabled}
					class:bg-gray-600={!audioState.quantizeEnabled}
					class:hover:bg-gray-500={!audioState.quantizeEnabled}
					class:text-white={true}
				>
					Quantize {audioState.quantizeEnabled ? 'ON' : 'OFF'}
				</button>

				<!-- Play button -->
				<button
					onclick={playMelody}
					class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded font-medium transition-colors flex items-center gap-2"
				>
					{#if audioState.isPlaying}
						<span class="w-3 h-3 bg-white"></span>
						Stop
					{:else}
						<span class="w-0 h-0 border-t-[6px] border-t-transparent border-l-[10px] border-l-white border-b-[6px] border-b-transparent"></span>
						Play
					{/if}
				</button>
			</div>
		</div>

		<div class="flex overflow-x-auto">
			<!-- Piano keys -->
			<div class="flex-shrink-0 border-r border-gray-600">
				{#each pianoKeys as key}
					<div
						class="flex items-center justify-end pr-2 text-xs font-mono border-b border-gray-700"
						class:bg-gray-900={key.isBlack}
						class:text-gray-400={key.isBlack}
						class:bg-gray-700={!key.isBlack}
						class:text-white={!key.isBlack}
						style="height: {KEY_HEIGHT}px; width: 60px;"
					>
						{key.displayName}{key.octave}
					</div>
				{/each}
			</div>

			<!-- Note grid and notes -->
			<div class="relative flex-grow overflow-x-auto">
				<!-- Grid lines -->
				<div class="absolute inset-0" style="width: {rollWidth}px;">
					{#each pianoKeys as key, i}
						<div
							class="absolute w-full border-b"
							class:border-gray-700={!key.isBlack}
							class:border-gray-600={key.isBlack}
							class:bg-gray-800={!key.isBlack}
							class:bg-gray-850={key.isBlack}
							style="top: {i * KEY_HEIGHT}px; height: {KEY_HEIGHT}px;"
						></div>
					{/each}

					<!-- Time markers -->
					{#each Array(Math.ceil(totalDuration)) as _, second}
						<div
							class="absolute top-0 bottom-0 border-l border-gray-600"
							style="left: {second * PIXELS_PER_SECOND}px;"
						>
							<span class="absolute -top-5 left-1 text-xs text-gray-500">{second}s</span>
						</div>
					{/each}
				</div>

				<!-- Notes -->
				<div class="relative" style="width: {rollWidth}px; height: {pianoKeys.length * KEY_HEIGHT}px;">
					{#each audioState.detectedNotes as note, i}
						<div
							class="absolute rounded {getNoteColor(note)} opacity-90 flex items-center justify-center text-xs text-white font-bold shadow-lg"
							style={getNoteStyle(note)}
						>
							{note.note}{note.octave}
						</div>
					{/each}

					<!-- Playhead indicator -->
					{#if audioState.isPlaying}
						<div
							class="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 shadow-lg playhead"
							style="left: {playheadPosition}px;"
						>
							<div class="absolute -top-1 -left-1.5 w-3 h-3 bg-red-500 rounded-full"></div>
						</div>
					{/if}
				</div>
			</div>
		</div>

		<!-- Legend -->
		<div class="mt-4 flex flex-wrap gap-2 text-xs">
			<span class="text-gray-400">Notes:</span>
			{#each audioState.detectedNotes as note, i}
				<span class="px-2 py-1 rounded {getNoteColor(note)} text-white">
					{i + 1}. {note.note}{note.octave}
				</span>
			{/each}
		</div>
	</div>
{/if}

<style>
	.bg-gray-850 {
		background-color: rgb(30, 32, 38);
	}
	.playhead {
		box-shadow: 0 0 8px 2px rgba(239, 68, 68, 0.6);
	}
</style>
