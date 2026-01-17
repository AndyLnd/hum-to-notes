<script lang="ts">
	import { audioState } from '$lib/stores/audioState.svelte';

	function handleRecord() {
		audioState.startRecording();
	}

	function handleStop() {
		audioState.stopRecording();
	}

	function handleReset() {
		audioState.reset();
	}
</script>

<div class="flex flex-col sm:flex-row gap-3 sm:gap-4 items-center w-full sm:w-auto">
	{#if audioState.status === 'idle' || audioState.status === 'complete'}
		<button
			onclick={handleRecord}
			class="w-full sm:w-auto min-h-[48px] px-8 py-3 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white rounded-full font-semibold transition-colors flex items-center justify-center gap-2 text-lg"
		>
			<span class="w-3 h-3 bg-white rounded-full"></span>
			Record
		</button>
	{/if}

	{#if audioState.status === 'recording'}
		<button
			onclick={handleStop}
			class="w-full sm:w-auto min-h-[48px] px-8 py-3 bg-gray-700 hover:bg-gray-800 active:bg-gray-900 text-white rounded-full font-semibold transition-colors flex items-center justify-center gap-2 text-lg"
		>
			<span class="w-3 h-3 bg-white"></span>
			Stop
		</button>
		<span class="flex items-center gap-2 text-red-500">
			<span class="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
			Recording...
		</span>
	{/if}

	{#if audioState.status === 'processing'}
		<span class="text-gray-400">Processing...</span>
	{/if}

	{#if audioState.status === 'complete' && audioState.detectedNotes.length > 0}
		<button
			onclick={handleReset}
			class="w-full sm:w-auto min-h-[44px] px-6 py-2 bg-gray-600 hover:bg-gray-700 active:bg-gray-800 text-white rounded font-medium transition-colors"
		>
			Clear
		</button>
	{/if}
</div>

{#if audioState.error}
	<p class="mt-4 text-red-400 text-center">{audioState.error}</p>
{/if}
