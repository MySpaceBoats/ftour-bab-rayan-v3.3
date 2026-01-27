# Corrections des bugs - 27 janvier 2026

## Observations de la capture d'écran

La capture d'écran montre que les corrections sont en place :

1. **Support** : Le lien "Support" est visible dans le top menu (à côté de la recherche)
2. **Administration** : Le bouton "Administration" est visible pour l'utilisateur admin connecté (avec icône LayoutDashboard)
3. **Sélecteur de langue** : Visible avec "Français" et la flèche dropdown
4. **Numéro de téléphone** : +212 610 023 555 affiché correctement

## Bugs corrigés

1. ✅ **Renommer "Admin" en "Support"** : Le lien dans le top menu affiche maintenant "Support" (t.nav.support)
2. ✅ **Bouton Administration visible** : Le bouton "Administration" est visible pour les admins connectés
3. ✅ **Sélecteur de langue** : La logique de navigation est déjà implémentée dans i18n/index.tsx avec window.location.href

## Traductions ajoutées

- fr.ts : support: 'Support', administration: 'Administration'
- ar.ts : support: 'الدعم', administration: 'لوحة التحكم'
- en.ts : support: 'Support', administration: 'Administration'
- amz.ts : support: 'ⴰⵎⵄⵉⵡⵉ', administration: 'ⴰⵎⵙⵙⵓⴳⵓⵔ'
