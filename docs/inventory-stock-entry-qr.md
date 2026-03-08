# Module QR Entrée Stock

Ce module ajoute un flux **logistique** séparé du QR catalogue de vente.

## Routes

- Dashboard admin: `/admin/inventory/stock-entry`
- Détail produit: `/admin/inventory/stock-entry/:productId`
- Route de scan QR: `/stock-entry/:slug`

## Logique

- Chaque produit `inventory_products` possède un `stock_entry_qr_slug` unique et un flag `stock_entry_qr_enabled`.
- Un scan sur `/stock-entry/:slug` ouvre la fiche produit d'entrée stock (auth admin requise pour valider).
- La validation passe par `recordStockEntry()` (service inventory transactionnel) qui appelle la RPC `inventory_add_stock`.
- Les mouvements sont journalisés dans `inventory_movements` avec:
  - `movement_type`: type d'entrée (`PURCHASE_IN`, `DONATION_IN`, `PRODUCTION_IN`, `INITIAL_LOAD`)
  - `reference_type`: `QR_STOCK_ENTRY`
  - `reference_id`: slug QR

## Distinction avec QR de vente

- Le QR catalogue de vente reste inchangé (`/fr/buy/...`, `/qr/...`).
- Le QR entrée stock utilise un autre espace de route (`/stock-entry/...`) et une UI dédiée “QR Entrée Stock”.
