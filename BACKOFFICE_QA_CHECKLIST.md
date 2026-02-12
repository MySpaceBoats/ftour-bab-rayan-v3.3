# ✅ Back Office QA Checklist

**Date** : 2026-02-12  
**Statut** : À tester

---

## 🧪 Tests Fonctionnels

### 1️⃣ AdminReservationsPage

#### Table & Filtres
- [ ] Table affiche toutes les réservations (mock data)
- [ ] Tri par colonne fonctionne (Type, Date, Places, Contact, Statut, Paiement)
- [ ] Filtre Type (Particulier, Entreprise, Groupe) fonctionne
- [ ] Filtre Statut (En attente, Confirmée, Refusée, Annulée) fonctionne
- [ ] Filtre Paiement (Payé, Non payé) fonctionne
- [ ] Filtre Date (plage) fonctionne
- [ ] Bouton "Réinitialiser filtres" réinitialise tous les filtres
- [ ] URL params se mettent à jour lors du filtrage

#### Actions & Sélection
- [ ] Sélection checkbox fonctionne (une ligne)
- [ ] Sélection "Tous" fonctionne (toutes les lignes)
- [ ] Bulk actions apparaissent quand des lignes sont sélectionnées
- [ ] Boutons bulk actions sont cliquables (Confirmer, Refuser, Marquer payé, Envoyer email)

#### Stats
- [ ] Stat "Total" affiche le nombre correct
- [ ] Stat "En attente" affiche le nombre correct
- [ ] Stat "Confirmées" affiche le nombre correct
- [ ] Stat "Payées" affiche le nombre correct

#### Design & UX
- [ ] Header avec gradient amber/orange est visible
- [ ] Icône UtensilsCrossed est affichée
- [ ] Titre "Réservations" est visible
- [ ] Sous-titre est visible
- [ ] Bouton "Nouvelle réservation" est visible
- [ ] Responsive design (mobile, tablet, desktop)

---

### 2️⃣ AdminCommercePage

#### Onglets
- [ ] Onglet "Produits" est actif par défaut
- [ ] Onglet "Commandes" peut être cliqué
- [ ] Contenu change au clic sur les onglets

#### Produits Tab
- [ ] Table affiche tous les produits
- [ ] Tri par colonne fonctionne
- [ ] Filtre Type (Goodies, Terroir, Pâtisserie) fonctionne
- [ ] Filtre Statut (Actif, Inactif, Discontinué) fonctionne
- [ ] Filtre Stock (En stock, Rupture) fonctionne
- [ ] Stats affichent les bonnes valeurs (Total, Actifs, En rupture, Stock total)
- [ ] Sélection checkbox fonctionne
- [ ] Bulk actions (Activer/Désactiver, Gérer stock, Supprimer) sont visibles

#### Commandes Tab
- [ ] Table affiche toutes les commandes
- [ ] Tri par colonne fonctionne
- [ ] Stats affichent les bonnes valeurs (Total, En attente, Montant total, Livrées)
- [ ] Colonnes affichent les bonnes données

#### Design & UX
- [ ] Header avec gradient blue/cyan est visible
- [ ] Icône ShoppingBag est affichée
- [ ] Titre "Commerce" est visible
- [ ] Bouton "Nouveau produit" apparaît dans l'onglet Produits
- [ ] Responsive design

---

### 3️⃣ AdminDonsPage

#### Table & Filtres
- [ ] Table affiche tous les dons
- [ ] Tri par colonne fonctionne
- [ ] Filtre "Statut paiement" fonctionne
- [ ] Filtre "Reçu" fonctionne
- [ ] Montants affichent le format "XXX DH"
- [ ] Statuts ont les bonnes couleurs (jaune=attente, vert=payé, rouge=échoué)
- [ ] Reçu affiche "✓ Généré" ou "✗ Non généré"

#### Stats
- [ ] Stat "Total dons" affiche le nombre correct
- [ ] Stat "Montant total" affiche la somme correcte
- [ ] Stat "Montant reçu" affiche la somme des dons payés
- [ ] Stat "Reçus générés" affiche le nombre correct

#### Actions
- [ ] Sélection checkbox fonctionne
- [ ] Bulk actions (Envoyer reçu, Supprimer) sont visibles

#### Design & UX
- [ ] Header avec gradient pink/red est visible
- [ ] Icône Heart est affichée
- [ ] Titre "Dons" est visible

---

### 4️⃣ AdminBenevolePage

#### Onglets
- [ ] Onglet "Bénévoles" est actif par défaut
- [ ] Onglet "Créneaux" peut être cliqué
- [ ] Contenu change au clic

#### Bénévoles Tab
- [ ] Table affiche tous les bénévoles
- [ ] Tri par colonne fonctionne
- [ ] Filtre "Statut" fonctionne
- [ ] Stats affichent les bonnes valeurs
- [ ] Sélection checkbox fonctionne
- [ ] Bulk actions (Envoyer email, Supprimer) sont visibles

#### Créneaux Tab
- [ ] Table affiche tous les créneaux
- [ ] Tri par colonne fonctionne
- [ ] Filtre "Créneau" fonctionne
- [ ] Filtre "Confirmé" fonctionne
- [ ] Filtre "Présence" fonctionne
- [ ] Colonnes affichent les bonnes données
- [ ] Statuts ont les bonnes couleurs
- [ ] Stats affichent les bonnes valeurs
- [ ] Sélection checkbox fonctionne
- [ ] Bulk actions (Confirmer, Générer QR, Marquer présent) sont visibles

#### Design & UX
- [ ] Header avec gradient green/emerald est visible
- [ ] Icône Users est affichée
- [ ] Titre "Bénévoles" est visible
- [ ] Bouton "Nouveau bénévole" apparaît dans l'onglet Bénévoles

---

## 🏗️ Tests Architecture

### Composants Réutilisables
- [ ] DataTable.tsx fonctionne avec différents types de données
- [ ] DataTable.tsx supporte le tri (sortable)
- [ ] DataTable.tsx supporte la sélection (selectable)
- [ ] DataTable.tsx supporte les colonnes personnalisées (render)
- [ ] FilterPanel.tsx supporte les filtres text
- [ ] FilterPanel.tsx supporte les filtres select
- [ ] FilterPanel.tsx supporte les filtres date
- [ ] FilterPanel.tsx supporte les filtres daterange
- [ ] FilterPanel.tsx affiche le bouton "Réinitialiser" quand des filtres sont actifs

### Routes
- [ ] `/admin/reservations` charge AdminReservationsPage
- [ ] `/admin/commerce` charge AdminCommercePage
- [ ] `/admin/dons` charge AdminDonsPage
- [ ] `/admin/benevoles` charge AdminBenevolePage
- [ ] Routes legacy redirigent correctement (si implémenté)

### Permissions (À implémenter)
- [ ] Utilisateur sans permission ne voit pas la page
- [ ] Utilisateur avec permission `admin_reservations` voit la page
- [ ] Utilisateur avec permission `admin_restaurant_particuliers` voit les particuliers
- [ ] Utilisateur avec permission `admin_boutique` voit la page commerce
- [ ] Super admin voit tout

---

## 🎨 Tests Design

### Couleurs & Thème
- [ ] Headers ont les bons gradients
- [ ] Icônes sont visibles et appropriées
- [ ] Badges de statut ont les bonnes couleurs
- [ ] Texte est lisible sur tous les fonds

### Responsive
- [ ] Mobile (< 640px) : layout s'adapte
- [ ] Tablet (640px - 1024px) : layout s'adapte
- [ ] Desktop (> 1024px) : layout optimal

### Accessibilité
- [ ] Tous les inputs ont des labels
- [ ] Tous les boutons sont cliquables
- [ ] Tous les liens sont visibles
- [ ] Contraste suffisant

---

## 🔄 Tests Intégration

### Flux Complets
- [ ] Filtrer → Sélectionner → Bulk action (réservations)
- [ ] Changer d'onglet → Filtrer → Sélectionner (commerce)
- [ ] Filtrer → Voir stats mises à jour (dons)
- [ ] Changer d'onglet → Filtrer → Sélectionner (bénévoles)

### URL & Navigation
- [ ] Filtres se reflètent dans l'URL
- [ ] Recharger la page conserve les filtres
- [ ] Bouton "Retour" fonctionne
- [ ] Scroll to top au changement de page

---

## 📊 Tests Performance

- [ ] Page charge en < 2 secondes
- [ ] Table avec 100+ lignes reste fluide
- [ ] Tri fonctionne sans lag
- [ ] Filtrage fonctionne sans lag
- [ ] Sélection fonctionne sans lag

---

## 🐛 Tests Bugs Connus

### Traductions Manquantes
- [ ] 35+ clés manquantes dans en.ts et ar.ts bloquent le rendu
- **Action** : Compléter les traductions avant MVP

### Mock Data
- [ ] Données en dur (MOCK_*) doivent être remplacées par tRPC
- **Action** : Intégrer tRPC après validation architecture

### Actions Non Implémentées
- [ ] Boutons bulk actions ne font rien (UI only)
- **Action** : Implémenter logique métier après validation

---

## ✅ Checklist Avant Livraison

- [ ] Tous les tests fonctionnels passent
- [ ] Tous les tests design passent
- [ ] Tous les tests responsive passent
- [ ] Pas d'erreurs TypeScript (sauf traductions)
- [ ] Pas d'erreurs console
- [ ] Documentation BACKOFFICE_ARCHITECTURE.md à jour
- [ ] Code commenté et lisible
- [ ] Noms de variables cohérents
- [ ] Pas de code mort ou commenté

---

## 📝 Notes

- Architecture testée avec mock data
- Prêt pour intégration tRPC
- Prêt pour implémentation permissions
- Prêt pour implémentation actions métier
