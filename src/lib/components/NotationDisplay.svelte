<script lang="ts">
	import { audioState } from '$lib/stores/audioState.svelte';
	import { onMount, tick } from 'svelte';

	let notationContainer: HTMLDivElement | undefined = $state();
	let abcjs: typeof import('abcjs') | null = $state(null);
	let containerWidth = $state(500);

	onMount(async () => {
		abcjs = await import('abcjs');
		// Update width on mount and resize
		const updateWidth = () => {
			if (notationContainer) {
				containerWidth = Math.min(notationContainer.clientWidth - 32, 500);
			}
		};
		updateWidth();
		window.addEventListener('resize', updateWidth);
		return () => window.removeEventListener('resize', updateWidth);
	});

	$effect(() => {
		const abc = audioState.abcNotation;
		const container = notationContainer;
		const lib = abcjs;
		const width = containerWidth;

		if (lib && container && abc) {
			// Use tick to ensure DOM is ready after conditional render
			tick().then(() => {
				lib.renderAbc(container, abc, {
					staffwidth: width,
					paddingtop: 20,
					paddingbottom: 40,
					paddingleft: 10,
					paddingright: 10,
					responsive: 'resize'
				});
			});
		}
	});
</script>

{#if audioState.status === 'complete' && audioState.detectedNotes.length > 0}
	<div class="bg-gray-800 rounded-lg p-4 sm:p-6">
		<h2 class="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">Staff Notation</h2>

		<!-- Staff notation -->
		<div bind:this={notationContainer} class="notation-container bg-white rounded p-2 sm:p-4 mb-4 sm:mb-6 overflow-x-auto"></div>

		<!-- ABC text notation -->
		<div class="mt-3 sm:mt-4">
			<h3 class="text-xs sm:text-sm font-medium text-gray-400 mb-2">ABC Notation</h3>
			<pre class="bg-gray-900 p-3 sm:p-4 rounded text-xs sm:text-sm text-gray-300 overflow-x-auto">{audioState.abcNotation}</pre>
		</div>

		<!-- Detected notes list -->
		<div class="mt-3 sm:mt-4">
			<h3 class="text-xs sm:text-sm font-medium text-gray-400 mb-2">
				Detected Notes ({audioState.detectedNotes.length})
			</h3>
			<div class="flex flex-wrap gap-1.5 sm:gap-2">
				{#each audioState.detectedNotes as note}
					<span class="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-gray-700 rounded text-xs sm:text-sm text-white">
						{note.note}{note.octave}
						<span class="text-gray-400 text-[10px] sm:text-xs ml-0.5 sm:ml-1">
							({note.duration.toFixed(2)}s)
						</span>
					</span>
				{/each}
			</div>
		</div>
	</div>
{:else if audioState.status === 'complete' && audioState.detectedNotes.length === 0}
	<div class="bg-gray-800 rounded-lg p-4 sm:p-6 text-center text-gray-400 text-sm sm:text-base">
		No notes detected. Try humming or singing louder, or check your microphone.
	</div>
{/if}

<style>
	.notation-container {
		overflow: visible !important;
	}
	.notation-container :global(svg) {
		color: black;
		display: block;
		max-width: 100%;
		height: auto !important;
		overflow: visible !important;
	}
	.notation-container :global(svg path),
	.notation-container :global(svg line),
	.notation-container :global(svg rect) {
		stroke: black;
		fill: black;
	}
	.notation-container :global(svg text) {
		fill: black;
	}
</style>
