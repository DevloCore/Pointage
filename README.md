# Pointage

Application de suivi du temps de travail — Vue.js 3 + Tailwind CSS + Capacitor.

## Fonctionnalités

- **Accueil** : vue d'ensemble du temps travaillé (jour, semaine, progression)
- **Pointage** : interface simple avec bouton, ajustement de l'heure et animation de confirmation
- **Historique** : consultation par jour, semaine ou tout l'historique, avec modification et ajout de pointages
- **Paramètres** : thème (système / clair / sombre), taux horaire hebdomadaire contractuel

## Stack technique

- [Vue.js 3](https://vuejs.org/) avec `<script setup>`
- [Tailwind CSS 4](https://tailwindcss.com/)
- [Vite](https://vite.dev/)
- [Dexie.js](https://dexie.org/) (IndexedDB)
- [Capacitor](https://capacitorjs.com/) pour le portage mobile

## Développement

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

