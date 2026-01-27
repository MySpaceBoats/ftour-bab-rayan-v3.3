# Documentation CMS Decap - Ftour Bab Rayan

## Table des matières

1. [Architecture](#architecture)
2. [Installation](#installation)
3. [Configuration des secrets Cloudflare](#configuration-des-secrets-cloudflare)
4. [Gestion des administrateurs](#gestion-des-administrateurs)
5. [Guide utilisateur](#guide-utilisateur)
6. [Dépannage](#dépannage)

---

## Architecture

Le CMS Decap de Ftour Bab Rayan utilise une architecture sécurisée et moderne, sans aucune dépendance à Netlify.

### Composants principaux

| Composant | Technologie | Rôle |
|-----------|-------------|------|
| **Frontend CMS** | Decap CMS 3.x | Interface d'édition de contenu |
| **Authentification** | Supabase Auth | Gestion des sessions utilisateurs |
| **Git Gateway** | Cloudflare Workers | Proxy sécurisé vers GitHub API |
| **Stockage contenu** | GitHub Repository | Versioning et persistance du contenu |
| **Tokens GitHub** | GitHub App | Génération de tokens temporaires (1h) |

### Flux d'authentification

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Éditeur   │────▶│  Supabase Auth  │────▶│  Worker /api/   │
│   (Admin)   │     │   (Session)     │     │  cms/session    │
└─────────────┘     └─────────────────┘     └────────┬────────┘
                                                      │
                    ┌─────────────────┐               │
                    │  Table users    │◀──────────────┘
                    │  (role check)   │   Vérifie role = admin
                    └─────────────────┘
```

### Flux d'édition de contenu

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Decap CMS  │────▶│  Worker /api/   │────▶│   GitHub API    │
│  (Frontend) │     │  cms/github/*   │     │   (via App)     │
└─────────────┘     └─────────────────┘     └────────┬────────┘
                           │                         │
                    ┌──────▼──────┐                  │
                    │ GitHub App  │                  │
                    │ Token (1h)  │──────────────────┘
                    └─────────────┘
```

### Sécurité

L'architecture implémente plusieurs couches de sécurité conformes aux bonnes pratiques de production.

**Tokens GitHub temporaires** : La GitHub App génère des tokens d'installation valides 1 heure maximum, éliminant le risque de tokens long-lived compromis.

**Vérification du rôle** : Chaque requête vers le CMS vérifie que l'utilisateur possède le rôle `admin` ou `super_admin` dans la table `users`.

**CORS strict** : Seuls les domaines autorisés (`ftourbabrayan.ma`, `www.ftourbabrayan.ma`) peuvent accéder aux endpoints CMS.

**Aucun token côté client** : Les credentials GitHub ne sont jamais exposés au navigateur ; toutes les opérations Git passent par le Worker.

---

## Installation

### Prérequis

Avant de déployer le CMS, assurez-vous d'avoir :

1. Un compte **Cloudflare** avec accès aux Workers
2. Un compte **GitHub** avec accès au repository `MySpaceBoats/ftour-bab-rayan-v2`
3. Une **GitHub App** configurée (voir section suivante)
4. Une base de données **Supabase** avec la table `users`

### Création de la GitHub App

Si la GitHub App n'existe pas encore, suivez ces étapes :

1. Accédez à **GitHub.com** → **Settings** → **Developer settings** → **GitHub Apps**
2. Cliquez sur **New GitHub App**
3. Configurez les champs suivants :

| Champ | Valeur |
|-------|--------|
| GitHub App name | `ftour-bab-rayan-cms` |
| Homepage URL | `https://www.ftourbabrayan.ma` |
| Callback URL | `https://api.ftourbabrayan.ma/api/cms/callback` |
| Webhook | Désactivé |

4. Dans **Repository permissions**, activez uniquement :
   - **Contents** : Read and write
   - **Metadata** : Read-only

5. Sélectionnez **Only on this account** pour l'installation
6. Cliquez sur **Create GitHub App**
7. Notez l'**App ID** affiché
8. Générez une **Private key** (fichier .pem)
9. Installez l'App sur le repository `ftour-bab-rayan-v2`
10. Notez l'**Installation ID** depuis l'URL (`/settings/installations/XXXXXX`)

---

## Configuration des secrets Cloudflare

Les secrets suivants doivent être configurés dans Cloudflare Workers :

### Via le dashboard Cloudflare

1. Accédez à **Workers & Pages** → **ftour-bab-rayan-api** → **Settings** → **Variables**
2. Ajoutez les secrets suivants :

| Variable | Description | Exemple |
|----------|-------------|---------|
| `GITHUB_APP_ID` | ID de la GitHub App | `2739151` |
| `GITHUB_APP_INSTALLATION_ID` | ID d'installation | `106408860` |
| `GITHUB_APP_PRIVATE_KEY` | Clé privée PEM complète | `-----BEGIN RSA PRIVATE KEY-----...` |

### Via Wrangler CLI

```bash
# Depuis le dossier du projet
cd /home/ubuntu/ftour-bab-rayan-v2

# Ajouter les secrets
wrangler secret put GITHUB_APP_ID
# Entrez: 2739151

wrangler secret put GITHUB_APP_INSTALLATION_ID
# Entrez: 106408860

wrangler secret put GITHUB_APP_PRIVATE_KEY
# Collez le contenu complet du fichier .pem
```

### Vérification

Après configuration, testez l'endpoint de session :

```bash
curl -X GET https://api.ftourbabrayan.ma/api/cms/session \
  -H "Authorization: Bearer <SUPABASE_ACCESS_TOKEN>"
```

Une réponse `401 Unauthorized` est normale sans token valide. Une erreur `500` indique un problème de configuration.

---

## Gestion des administrateurs

### Ajouter un administrateur

Pour donner accès au CMS à un utilisateur :

1. L'utilisateur doit d'abord se connecter au site (créer un compte via Supabase Auth)
2. Dans Supabase Dashboard, accédez à **Table Editor** → **users**
3. Trouvez l'utilisateur par email
4. Modifiez le champ `role` de `user` à `admin`

**SQL alternatif :**

```sql
UPDATE public.users 
SET role = 'admin' 
WHERE email = 'nouvel.admin@example.com';
```

### Rôles disponibles

| Rôle | Accès CMS | Description |
|------|-----------|-------------|
| `user` | ❌ Non | Utilisateur standard (bénévole) |
| `admin` | ✅ Oui | Administrateur avec accès CMS |
| `super_admin` | ✅ Oui | Super administrateur (propriétaire) |

### Retirer un administrateur

```sql
UPDATE public.users 
SET role = 'user' 
WHERE email = 'ancien.admin@example.com';
```

---

## Guide utilisateur

### Accès au CMS

1. Rendez-vous sur **https://www.ftourbabrayan.ma/admin/**
2. Si vous n'êtes pas connecté, vous serez redirigé vers la page de connexion
3. Connectez-vous avec votre compte administrateur
4. Le CMS se charge automatiquement

### Interface du CMS

L'interface Decap CMS se compose de trois zones principales :

**Barre latérale gauche** : Liste des collections (Pages, Articles, FAQ, etc.)

**Zone centrale** : Liste des entrées de la collection sélectionnée

**Panneau d'édition** : Formulaire d'édition du contenu sélectionné

### Créer un nouvel article

1. Cliquez sur **Articles** dans la barre latérale
2. Cliquez sur **Nouvel article**
3. Remplissez les champs :
   - **Titre** : Titre de l'article
   - **Date** : Date de publication
   - **Auteur** : Votre nom
   - **Image principale** : Téléchargez une image (optionnel)
   - **Extrait** : Résumé pour les listes
   - **Publié** : Cochez pour publier
   - **Contenu** : Rédigez votre article en Markdown
4. Cliquez sur **Publier** pour sauvegarder

### Modifier du contenu existant

1. Sélectionnez la collection concernée
2. Cliquez sur l'entrée à modifier
3. Effectuez vos modifications
4. Cliquez sur **Publier** pour sauvegarder

### Ajouter des traductions

Chaque entrée dispose d'une section **Traductions** (repliée par défaut) :

1. Dépliez la section **Traductions**
2. Sélectionnez la langue (Arabe, Anglais, Amazigh)
3. Remplissez les champs traduits
4. Les champs non remplis utiliseront la version française par défaut

### Télécharger des médias

1. Dans un champ image, cliquez sur **Choisir une image**
2. Sélectionnez un fichier depuis votre ordinateur
3. L'image sera automatiquement uploadée vers le repository Git
4. Le chemin de l'image sera inséré dans le champ

### Workflow de publication

Lorsque vous cliquez sur **Publier** :

1. Le contenu est converti en fichier Markdown/JSON
2. Un commit est créé sur la branche `main` du repository
3. Le commit inclut votre nom et email comme auteur
4. Cloudflare Pages détecte le changement et redéploie le site

**Note** : Le déploiement prend généralement 1-2 minutes après la publication.

---

## Dépannage

### Erreur "Accès refusé"

**Cause** : Votre compte n'a pas le rôle `admin` ou `super_admin`.

**Solution** : Demandez à un super administrateur de modifier votre rôle dans Supabase.

### Erreur "Session expirée"

**Cause** : Votre session Supabase a expiré.

**Solution** : Rafraîchissez la page et reconnectez-vous.

### Erreur lors de la publication

**Cause possible 1** : Token GitHub App expiré ou invalide.

**Solution** : Vérifiez que les secrets Cloudflare sont correctement configurés.

**Cause possible 2** : Permissions insuffisantes sur le repository.

**Solution** : Vérifiez que la GitHub App est installée sur le repository avec les permissions `Contents: Read and write`.

### Le contenu ne s'affiche pas sur le site

**Cause** : Le déploiement Cloudflare Pages n'est pas terminé.

**Solution** : Attendez 1-2 minutes et rafraîchissez la page. Vérifiez le statut du déploiement dans le dashboard Cloudflare.

### Logs et debugging

Pour diagnostiquer les problèmes, consultez les logs du Worker :

1. Accédez au dashboard Cloudflare
2. Allez dans **Workers & Pages** → **ftour-bab-rayan-api**
3. Cliquez sur **Logs** → **Real-time Logs**
4. Reproduisez l'erreur et observez les logs

---

## Support

Pour toute question ou problème :

- **Email** : contact@ftourbabrayan.ma
- **Téléphone** : +212 610 023 555

---

*Documentation générée le 27 janvier 2026*
*Version CMS : Decap 3.x avec backend custom-github*
