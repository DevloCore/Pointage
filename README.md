# Pointage

Application de suivi du temps de travail — Vue.js 3 + Tailwind CSS + Capacitor + Supabase.

## Fonctionnalités

- **Accueil** : vue d'ensemble du temps travaillé (jour, semaine, progression)
- **Pointage** : interface simple avec bouton, ajustement de l'heure et animation de confirmation
- **Historique** : consultation par jour, semaine ou tout l'historique, avec modification et ajout de pointages
- **Paramètres** : thème (système / clair / sombre), taux horaire hebdomadaire contractuel
- **☁️ Synchronisation cloud** : sauvegarde automatique avec Supabase (optionnel)

## Stack technique

- [Vue.js 3](https://vuejs.org/) avec `<script setup>`
- [Tailwind CSS 4](https://tailwindcss.com/)
- [Vite](https://vite.dev/)
- Cache local persistant (LocalStorage + helper de cache)
- [Supabase](https://supabase.com/) — Synchronisation cloud (optionnel)
- [Capacitor](https://capacitorjs.com/) pour le portage mobile

## Développement

```bash
npm install
npm run dev
```

## Synchronisation cloud (optionnel)

L'application fonctionne **100% hors ligne** par défaut avec le cache local persistant.

Pour activer la synchronisation cloud avec Supabase :

1. Suivez le guide complet : [SETUP_SUPABASE.md](./SETUP_SUPABASE.md)
2. Créez un compte gratuit sur [Supabase](https://supabase.com)
3. Ouvrez l'onglet **Paramètres**
4. Saisissez l'URL Supabase et la clé anon dans la section cloud
5. Vos données seront automatiquement synchronisées !

## Build

```bash
npm run build
```

