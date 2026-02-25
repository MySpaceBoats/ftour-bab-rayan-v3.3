import { mkdirSync, writeFileSync } from "node:fs";
import { generateRestaurantReservationRejectedEmail } from "../server/email";

const outDir = "previews/restaurant";
mkdirSync(outDir, { recursive: true });

const withReason = generateRestaurantReservationRejectedEmail({
  firstName: "Sara",
  brandName: "La Table du Jardin",
  reference: "RES-P-AB12CD",
  reservationDateLong: "mardi 18 mars 2026",
  reservationTime: "20:15",
  partySize: 4,
  rejectionReason: "capacité atteinte",
  rescheduleUrl: "https://ftourbabrayan.ma/restaurant/reservation",
  contactEmail: "contact@ftourbabrayan.ma",
  contactPhone: "+212 (0) 666-690534",
  footerLines: [
    "Association Bab Rayan",
    "4 rue Bayt Lahm, quartier Palmier, Casablanca",
    "Tél: +212 (0) 666-690534 | contact@ftourbabrayan.ma",
  ],
});

const withoutReason = generateRestaurantReservationRejectedEmail({
  firstName: "Youssef",
  brandName: "La Table du Jardin",
  reservationDateLong: "vendredi 21 mars 2026",
  partySize: 2,
  contactEmail: "contact@ftourbabrayan.ma",
  contactPhone: "+212 (0) 666-690534",
  footerLines: [
    "Association Bab Rayan",
    "4 rue Bayt Lahm, quartier Palmier, Casablanca",
    "Tél: +212 (0) 666-690534 | contact@ftourbabrayan.ma",
  ],
});

writeFileSync(`${outDir}/reservation-rejected.with-reason.html`, withReason.html, "utf8");
writeFileSync(`${outDir}/reservation-rejected.with-reason.txt`, withReason.text, "utf8");

writeFileSync(`${outDir}/reservation-rejected.no-reason.html`, withoutReason.html, "utf8");
writeFileSync(`${outDir}/reservation-rejected.no-reason.txt`, withoutReason.text, "utf8");

console.log("Preview files generated in", outDir);
