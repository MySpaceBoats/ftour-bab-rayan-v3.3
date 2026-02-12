# Missing Translations for Back Office

## Required Keys for en.ts and ar.ts

### Home Page (en.ts line 46)
```
companyBookingCardTitle
companyBookingTitle
companyBookingDesc
bookForCompany
companyBookingSubtitle
companyBookingCTA
companyBookingFeatures
companyBookingFeature1
companyBookingFeature2
companyBookingFeature3
companyBookingFeature4
```

### Goodies Page (en.ts line 180)
```
backToPastries
expressCheckout
productNotFound
completeOrder
orderSummary
shippingAddress
paymentMethod
```

### Checkout Page (en.ts line 317)
```
total
subtotal
tax
shipping
discount
```

### Back Office - Reservations (NEW)
```
reservations
reservationsTitle
reservationsDesc
type
particulier
entreprise
groupe
status
pending
confirmed
rejected
cancelled
paymentStatus
unpaid
paid
refunded
dateFrom
dateTo
actions
view
confirm
reject
markPaid
delete
resendEmail
stats
totalReservations
pendingReservations
confirmedReservations
paidReservations
```

### Back Office - Commerce (NEW)
```
commerce
commerceTitle
commerceDesc
products
productsList
productsTitle
productsDesc
addProduct
editProduct
deleteProduct
disableProduct
manageStock
viewOrders
orders
ordersList
ordersTitle
ordersDesc
orderStatus
pending
confirmed
shipped
delivered
cancelled
totalOrders
pendingOrders
totalAmount
deliveredOrders
```

### Back Office - Dons (NEW)
```
dons
donsTitle
donsDesc
donationsList
donorName
donorEmail
donorPhone
amount
paymentMethod
transfer
onSite
message
isAnonymous
acceptsUpdates
receiptGenerated
generateReceipt
totalDons
totalAmount
paidAmount
receiptsGenerated
```

### Back Office - Bénévoles (NEW)
```
benevoles
benevolesTitle
benevolesDesc
volunteersList
volunteersTitle
volunteersDesc
shifts
shiftsTitle
shiftsDesc
confirmed
qrGenerated
present
confirmShift
generateQR
markPresent
totalVolunteers
confirmedVolunteers
qrGeneratedVolunteers
presentVolunteers
```

### Back Office - General (NEW)
```
backoffice
dashboard
administration
filter
resetFilters
search
sort
page
limit
loading
error
success
noData
noResults
actions
edit
delete
save
cancel
close
back
next
previous
```

## Implementation Steps

1. Add all keys to `client/src/i18n/en.ts` in the appropriate sections
2. Add corresponding Arabic translations to `client/src/i18n/ar.ts`
3. Ensure all keys are properly typed in the i18n interface
4. Test each page to verify translations are loaded correctly

## Notes

- Translations should be consistent with existing terminology
- Use professional French/Arabic for admin interface
- Maintain gender-neutral language where possible
- Keep translations concise for UI elements
