<script lang="ts">
	import { audioState } from '$lib/stores/audioState.svelte';
	import { NoteQuantizer } from '$lib/pitch/NoteQuantizer';

	const quantizer = new NoteQuantizer();

	let noteDisplay = $derived.by(() => {
		const pitch = audioState.currentPitch;
		if (!pitch || pitch.frequency === null) {
			return { note: '-', frequency: '-', clarity: 0 };
		}

		const noteInfo = quantizer.frequencyToNoteInfo(pitch.frequency);
		const centsStr = noteInfo.cents >= 0 ? `+${noteInfo.cents}` : `${noteInfo.cents}`;

		return {
			note: `${noteInfo.note}${noteInfo.octave}`,
			frequency: `${pitch.frequency.toFixed(1)} Hz`,
			cents: centsStr,
			clarity: pitch.clarity
		};
	});
</script>

{#if audioState.status === 'recording'}
	<div class="bg-gray-800 rounded-lg p-4 sm:p-6 text-center">
		<div class="text-4xl sm:text-6xl font-bold text-white mb-1 sm:mb-2">
			{noteDisplay.note}
		</div>
		<div class="text-gray-400 text-base sm:text-lg">
			{noteDisplay.frequency}
		</div>
		{#if noteDisplay.cents}
			<div class="text-xs sm:text-sm text-gray-500 mt-1">
				{noteDisplay.cents} cents
			</div>
		{/if}
		<div class="mt-3 sm:mt-4">
			<div class="h-2 bg-gray-700 rounded-full overflow-hidden">
				<div
					class="h-full bg-green-500 transition-all duration-75"
					style="width: {noteDisplay.clarity * 100}%"
				></div>
			</div>
			<div class="text-xs text-gray-500 mt-1">Signal strength</div>
		</div>
	</div>
{/if}
