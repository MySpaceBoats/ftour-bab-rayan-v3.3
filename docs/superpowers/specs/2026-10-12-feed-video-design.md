# Vidéo dans les fils d'actualité (Fil et Pro) — design

## Objectif
Permettre de publier une vidéo dans le Fil d'actualité et dans le fil Pro de l'espace bénévole.

## Hors périmètre
Transcodage, image d'aperçu (poster), limite de durée, barre de progression d'envoi, vidéo dans les commentaires, la Marketplace, l'Hébergement et le Meetup.

## 1. Envoi (Worker)
- `POST /hub/media` accepte `video/mp4`, `video/webm`, `video/quicktime` (extensions `mp4`, `webm`, `mov`) en plus des images. Même quota (`recordUpload`, 20 envois par heure).
- `PUT /media-upload/<key>` : images inchangées (8 Mo, corps lu en mémoire). Vidéos : 50 Mo maximum, `Content-Length` obligatoire et ≤ 50 Mo, corps passé en flux à R2 (pas de `arrayBuffer`). Type déduit de l'extension de la clé ; le `Content-Type` de la requête doit correspondre à un type autorisé.
- Aucune migration : le type d'un média se déduit de l'extension de `r2_key`.

## 2. Règle de publication
Une publication (Fil et Pro) contient soit 0 à 4 images, soit exactement 1 vidéo et aucune image. Toute autre combinaison, ou un chemin qui n'appartient pas au membre : 400 `invalid`. Règle partagée dans `hub-d1` (`checkMedia`), utilisée par `createPost` du Fil et du Pro.

## 3. Lecture
`GET /media-signed/<key>` répond aux requêtes `Range: bytes=a-b` (206, `Content-Range`, `Accept-Ranges: bytes`), indispensable à Safari/iOS. Sans en-tête `Range`, réponse complète comme avant. Plage invalide : 416.

## 4. Interface
- Les compositeurs du Fil et du Pro acceptent `video/mp4,video/webm,video/quicktime`. Choisir une vidéo remplace les photos déjà sélectionnées ; choisir une photo retire la vidéo. Aperçu `<video>` avec bouton « Retirer ». Refus côté client au-delà de 50 Mo.
- Les cartes de publication affichent un `<video controls playsInline preload="metadata">` quand l'URL est une vidéo (extension `.mp4/.webm/.mov` dans le chemin de l'URL signée).
- « Mes photos » (`memberPhotos`) ne liste pas les vidéos, et `proposeToGallery` les refuse.

## 5. Tests
Envoi vidéo accepté / trop lourd / sans `Content-Length` / type interdit ; lecture par plages (206, 416, complet) ; règle photos/vidéo (Fil et Pro) ; vidéo absente de « Mes photos » ; rendu des cartes avec lecteur.

## 6. Déploiement
Aucun SQL. Déployer le Worker (`wrangler deploy`) puis le front.
