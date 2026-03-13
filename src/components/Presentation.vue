<script setup>
import { useRouter } from 'vue-router'
import { CloudIcon, Cog6ToothIcon, ChartBarIcon, ClockIcon } from '@heroicons/vue/24/outline'

const router = useRouter()
function openSettings() {
	router.push('/settings')
}
</script>

<template v-if="!isConfigured">
	<div class="relative overflow-hidden rounded-[28px] bg-slate-950 text-white p-6 mb-5 shadow-2xl">
		<div
			class="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(34,197,94,0.22),_transparent_35%),radial-gradient(circle_at_bottom_left,_rgba(59,130,246,0.22),_transparent_40%)]" />
		<div class="relative">
			<p class="text-xs uppercase tracking-[0.3em] text-slate-300 mb-3">Pointage Cloud</p>
			<h2 class="text-3xl font-black leading-tight mb-3">Suivez vos heures sans perdre votre historique.
			</h2>
			<p class="text-sm text-slate-300 mb-5">
				Connectez Supabase pour récupérer vos paramètres, synchroniser vos pointages et garder un cache
				local en secours.
			</p>

			<div class="grid grid-cols-1 gap-3 mb-5">
				<div class="rounded-2xl bg-white/8 border border-white/10 p-4">
					<div class="flex items-center gap-3 mb-2">
						<ClockIcon class="w-5 h-5 text-cyan-300" />
						<span class="font-semibold">Pointage instantané</span>
					</div>
					<p class="text-sm text-slate-300">Vos entrées restent visibles même si le réseau tombe.</p>
				</div>
				<div class="rounded-2xl bg-white/8 border border-white/10 p-4">
					<div class="flex items-center gap-3 mb-2">
						<ChartBarIcon class="w-5 h-5 text-emerald-300" />
						<span class="font-semibold">Récupération des réglages cloud</span>
					</div>
					<p class="text-sm text-slate-300">Contrat horaire, jours travaillés et autres paramètres
						sont rechargés à la connexion.</p>
				</div>
				<div class="rounded-2xl bg-white/8 border border-white/10 p-4">
					<div class="flex items-center gap-3 mb-2">
						<CloudIcon class="w-5 h-5 text-indigo-300" />
						<span class="font-semibold">Cloud testé avant sauvegarde</span>
					</div>
					<p class="text-sm text-slate-300">La configuration est validée avant d’être enregistrée dans
						l’application.</p>
				</div>
			</div>

			<button @click="openSettings"
				class="w-full flex items-center justify-center gap-2 rounded-2xl bg-white text-slate-950 font-semibold py-3 px-4 hover:bg-slate-100 transition-colors">
				<Cog6ToothIcon class="w-5 h-5" />
				Configurer Supabase
			</button>
		</div>
	</div>
</template>