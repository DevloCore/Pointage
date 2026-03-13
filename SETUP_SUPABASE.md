# Configuration Supabase pour Pointage

Ce guide vous explique comment configurer Supabase pour synchroniser vos données de pointage dans le cloud.

## 🚀 Étape 1 : Créer un compte Supabase (gratuit)

1. Allez sur [https://supabase.com](https://supabase.com)
2. Créez un compte gratuit
3. Créez un nouveau projet
   - Choisissez un nom (ex: "pointage-app")
   - Créez un mot de passe de base de données (notez-le !)
   - Choisissez une région proche de vous

## 📊 Étape 2 : Créer les tables

Dans le dashboard Supabase, allez dans **SQL Editor** et exécutez ce script :

```sql
-- Table des pointages
CREATE TABLE pointages (
  id BIGSERIAL PRIMARY KEY,
  timestamp BIGINT NOT NULL,
  date TEXT NOT NULL,
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour les performances
CREATE INDEX idx_pointages_date ON pointages(date);
CREATE INDEX idx_pointages_timestamp ON pointages(timestamp);

-- Table des paramètres
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS (Row Level Security) - Pour l'instant en mode public
-- TODO: Ajouter l'authentification et restreindre l'accès
ALTER TABLE pointages ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Policies temporaires (accès public pour le développement)
CREATE POLICY "Accès public pointages" ON pointages FOR ALL USING (true);
CREATE POLICY "Accès public settings" ON settings FOR ALL USING (true);

-- IMPORTANT: Activer la réplication pour le real-time
ALTER PUBLICATION supabase_realtime ADD TABLE pointages;
ALTER PUBLICATION supabase_realtime ADD TABLE settings;
```

**⚠️ IMPORTANT pour le real-time :**
- Les commandes `ALTER PUBLICATION` activent la réplication nécessaire pour Supabase Realtime
- Sans cela, les événements INSERT/UPDATE/DELETE ne seront pas propagés aux clients

## 🔑 Étape 3 : Récupérer les clés API

1. Dans votre projet Supabase, allez dans **Settings** → **API**
2. Copiez :
   - **Project URL** (ex: `https://xxxxx.supabase.co`)
   - **anon public key** (la clé publique)

## ⚙️ Étape 4 : Configurer l'application

1. Copiez le fichier `.env.example` en `.env` :
   ```bash
   cp .env.example .env
   ```

2. Modifiez le fichier `.env` avec vos vraies valeurs :
   ```
   VITE_SUPABASE_URL=https://votre-projet.supabase.co
   VITE_SUPABASE_ANON_KEY=votre-cle-anon-ici
   ```

3. **IMPORTANT** : Ne committez jamais le fichier `.env` ! Il est déjà dans `.gitignore`.

## 🔄 Étape 5 : Utiliser la synchronisation

La synchronisation est **automatique et en temps réel** ! 

### Synchronisation automatique

Chaque fois que vous :
- Ajoutez un pointage
- Modifiez un pointage
- Supprimez un pointage
- Modifiez un paramètre

Les données sont automatiquement synchronisées vers Supabase en arrière-plan.

### Synchronisation en temps réel entre onglets/appareils

Si vous modifiez vos données :
- Dans un autre onglet
- Sur un autre appareil
- Directement dans Supabase

**Vos données se mettent à jour automatiquement** dans tous les onglets ouverts grâce à la technologie real-time de Supabase !

### Synchronisation au démarrage

À chaque ouverture de l'application, vos données cloud sont automatiquement fusionnées avec vos données locales.

### Synchronisation manuelle

Vous pouvez aussi forcer une synchronisation complète dans l'onglet **Paramètres** :

```javascript
import { useSync } from '@/composables/useSync'

const { fullSync, syncToCloud, syncFromCloud } = useSync()

// Sync complète (bidirectionnelle)
await fullSync()

// Sync locale → cloud uniquement
await syncToCloud()

// Sync cloud → locale uniquement
await syncFromCloud()
```

## 📱 Mode hors ligne

L'application fonctionne **toujours en mode hors ligne** grâce au cache local persistant.

- Sans Supabase configuré : tout fonctionne localement
- Avec Supabase : sync automatique quand vous êtes en ligne

## 🔒 Sécurité (TODO)

Pour l'instant, les données sont accessibles publiquement. Pour sécuriser :

1. Ajoutez l'authentification Supabase
2. Modifiez les policies RLS pour restreindre l'accès
3. Associez chaque pointage à un `user_id`

Exemple de policy sécurisée :
```sql
CREATE POLICY "Utilisateurs voient leurs propres pointages" 
ON pointages FOR ALL 
USING (auth.uid() = user_id);
```

## 🐛 Dépannage

### "Supabase non configuré"
→ Vérifiez que l'URL et la clé anon sont bien renseignées dans l'onglet **Paramètres**

### Erreurs de synchronisation
→ Vérifiez dans la console du navigateur (F12) les messages d'erreur détaillés

### Les données ne se synchronisent pas
→ Vérifiez que les tables sont bien créées dans Supabase
→ Vérifiez les policies RLS

### ⚠️ PROBLÈME: Les suppressions ne se synchronisent pas entre onglets

**Symptômes :** 
- A crée un pointage, B le voit ✅
- B supprime le pointage, mais A le voit encore ❌
- C (nouveau) ne voit pas le pointage ✅

**Cause :** La réplication real-time n'est pas activée

**Solution :**
1. Allez dans **SQL Editor** de Supabase
2. Exécutez ces commandes :
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE pointages;
ALTER PUBLICATION supabase_realtime ADD TABLE settings;
```
3. Rechargez tous les onglets de votre application

**Vérification :**
Ouvrez la console du navigateur (F12) et cherchez :
- `📡 [SUPABASE] Statut subscription pointages: SUBSCRIBED` ✅
- Si vous voyez `CHANNEL_ERROR` ou `TIMED_OUT`, la réplication n'est pas activée ❌

### Les logs de débogage

Avec les logs détaillés ajoutés, vous verrez dans la console :
- `🗑️ [LOCAL] Début suppression pointage: X` - Quand B supprime
- `☁️ [LOCAL] Envoi suppression à Supabase...` - Envoi vers le cloud
- `✅ [LOCAL] Suppression Supabase réussie` - Confirmation cloud
- `📡 [SUPABASE] Événement reçu sur canal pointages:` - A reçoit l'événement
- `🗑️ [REALTIME] Suppression pointage: X` - A traite la suppression
- `✅ [REALTIME] Suppression locale terminée` - Confirmé dans A

Si vous ne voyez pas `📡 [SUPABASE] Événement reçu`, c'est que la réplication n'est pas activée.

## 📚 Ressources

- [Documentation Supabase](https://supabase.com/docs)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
