<script lang="ts">
	import RecordingControls from '$lib/components/RecordingControls.svelte';
	import PitchIndicator from '$lib/components/PitchIndicator.svelte';
	import NotationDisplay from '$lib/components/NotationDisplay.svelte';
	import PianoRoll from '$lib/components/PianoRoll.svelte';
	import '../app.css';
</script>

<div class="min-h-screen bg-gray-900 text-white p-4 sm:p-6 md:p-8">
	<div class="max-w-4xl mx-auto">
		<header class="text-center mb-6 sm:mb-8">
			<h1 class="text-2xl sm:text-3xl font-bold mb-2">Melody to Notation</h1>
			<p class="text-gray-400 text-sm sm:text-base">Hum, sing, or la-la-la a melody and see it transcribed</p>
		</header>

		<main class="space-y-4 sm:space-y-6">
			<section class="flex justify-center">
				<RecordingControls />
			</section>

			<section>
				<PitchIndicator />
			</section>

			<section>
				<PianoRoll />
			</section>

			<section>
				<NotationDisplay />
			</section>
		</main>

		<footer class="mt-8 sm:mt-12 text-center text-xs sm:text-sm text-gray-600">
			<p>Uses WebAudio API + YIN pitch detection + ABC notation</p>
		</footer>
	</div>
</div>
