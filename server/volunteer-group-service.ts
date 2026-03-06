/**
 * Service partagé pour la validation des groupes bénévoles.
 * Contient la logique d'analyse du fichier Excel et de traitement
 * des inscriptions, utilisée par le routeur tRPC et l'endpoint HTTP.
 */

import * as XLSX from "xlsx";
import * as supabaseServices from "./supabase-services";
import {
  sendEmail,
  generateVolunteerConfirmationEmail,
} from "./email";

// ============================================
// TYPES
// ============================================

export type ParsedGroupVolunteerRow = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city?: string;
};

export type GroupVolunteerForEmail = ParsedGroupVolunteerRow & {
  qrToken?: string;
  groupMembersCount?: number;
};

// ============================================
// HELPERS
// ============================================

const normalizeSpreadsheetValue = (value: unknown): string =>
  String(value ?? "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export const decodeBase64Payload = (payload: string): Buffer => {
  const cleanPayload = payload.includes(",")
    ? payload.split(",").pop() || ""
    : payload;
  return Buffer.from(cleanPayload, "base64");
};

export const chunkArray = <T>(items: T[], size: number): T[][] => {
  if (size <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

export const runWithConcurrencyLimit = async <T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number
): Promise<T[]> => {
  if (tasks.length === 0) return [];
  const limit = Math.max(1, concurrency);
  const results: T[] = new Array(tasks.length);
  let cursor = 0;

  const workers = Array.from(
    { length: Math.min(limit, tasks.length) },
    async () => {
      while (true) {
        const taskIndex = cursor;
        cursor += 1;
        if (taskIndex >= tasks.length) break;
        results[taskIndex] = await tasks[taskIndex]();
      }
    }
  );

  await Promise.all(workers);
  return results;
};

export const GROUP_MAIL_DISPATCH_CC = [
  "naylabennani@hotmail.com",
  "ratibhind3@gmail.com",
  "rsebbani@myspace.boats",
] as const;

// ============================================
// SPREADSHEET PARSING
// ============================================

const parseGroupVolunteersFromSheet = (
  sheet: XLSX.WorkSheet
): ParsedGroupVolunteerRow[] => {
  const rawRows = XLSX.utils.sheet_to_json<any[]>(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
  });

  const templateHeaderRowIndex = 6;
  let headerRowIndex =
    rawRows.length > templateHeaderRowIndex ? templateHeaderRowIndex : 0;
  let bestScore = -1;

  for (let i = 0; i < Math.min(rawRows.length, 30); i++) {
    const row = rawRows[i] || [];
    let hasEmailCol = false;
    let hasNameCol = false;
    let score = 0;

    for (const cell of row) {
      const normalized = normalizeSpreadsheetValue(cell);
      if (!normalized) continue;
      if (
        normalized.includes("email") ||
        normalized.includes("mail") ||
        normalized.includes("courriel")
      ) {
        hasEmailCol = true;
        score += 3;
      }
      if (
        normalized.includes("nom") ||
        normalized.includes("name") ||
        normalized.includes("prenom") ||
        normalized.includes("first") ||
        normalized.includes("last")
      ) {
        hasNameCol = true;
        score += 2;
      }
      if (
        normalized.includes("tel") ||
        normalized.includes("phone") ||
        normalized.includes("ville") ||
        normalized.includes("city")
      ) {
        score += 1;
      }
    }

    if (hasEmailCol && hasNameCol) {
      if (i === templateHeaderRowIndex) {
        headerRowIndex = i;
        bestScore = score;
        break;
      }

      if (score > bestScore) {
        bestScore = score;
        headerRowIndex = i;
      }
    }
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
    defval: "",
    range: headerRowIndex,
    blankrows: false,
  });

  if (!rows.length) return [];

  const findColumn = (
    candidateRows: Record<string, any>[],
    candidates: string[],
    exclude: string[] = []
  ): string => {
    for (const row of candidateRows) {
      for (const key of Object.keys(row)) {
        if (!key || exclude.includes(key)) continue;
        const normalizedKey = normalizeSpreadsheetValue(key);
        if (candidates.some(candidate => normalizedKey.includes(candidate))) {
          return key;
        }
      }
    }
    return "";
  };

  const sampleRows = rows.slice(0, 5);
  const colEmail = findColumn(sampleRows, ["email", "mail", "courriel"]);
  const colFirstName = findColumn(
    sampleRows,
    ["prenom", "first", "firstname"],
    [colEmail]
  );
  const colLastName = findColumn(
    sampleRows,
    ["nom", "last", "lastname", "family"],
    [colEmail, colFirstName].filter(Boolean)
  );
  const colFullName =
    !colFirstName || !colLastName
      ? findColumn(
          sampleRows,
          ["nom", "name", "prenom"],
          [colEmail].filter(Boolean)
        )
      : "";
  const usedCols = [colEmail, colFirstName, colLastName, colFullName].filter(
    Boolean
  );
  const colPhone = findColumn(
    sampleRows,
    ["telephone", "tel", "phone", "mobile", "gsm"],
    usedCols
  );
  const colCity = findColumn(
    sampleRows,
    ["ville", "city"],
    [...usedCols, colPhone].filter(Boolean)
  );

  const hasNames = (colFirstName && colLastName) || colFullName;
  if (!hasNames || !colEmail) return [];

  return rows
    .map((row): ParsedGroupVolunteerRow | null => {
      let firstName: string;
      let lastName: string;

      if (colFullName) {
        const fullName = String(row[colFullName] || "").trim();
        const parts = fullName.split(/\s+/).filter(Boolean);
        if (parts.length >= 2) {
          lastName = parts[0];
          firstName = parts.slice(1).join(" ");
        } else {
          firstName = fullName;
          lastName = fullName;
        }
      } else {
        firstName = String(row[colFirstName] || "").trim();
        lastName = String(row[colLastName] || "").trim();
      }

      const email = String(row[colEmail] || "")
        .toLowerCase()
        .trim();
      const phone = colPhone ? String(row[colPhone] || "").trim() : "";
      const city = colCity ? String(row[colCity] || "").trim() : undefined;

      if (
        !firstName ||
        !lastName ||
        !email ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      ) {
        return null;
      }

      return { firstName, lastName, email, phone, city };
    })
    .filter((row): row is ParsedGroupVolunteerRow => !!row);
};

export const parseGroupVolunteersFromSpreadsheet = (
  fileBase64: string
): ParsedGroupVolunteerRow[] => {
  const workbook = XLSX.read(decodeBase64Payload(fileBase64), {
    type: "buffer",
    raw: false,
    FS: ";",
  });

  const allRows = workbook.SheetNames.flatMap(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return [];
    return parseGroupVolunteersFromSheet(sheet);
  });

  const dedupedByEmail = new Map<string, ParsedGroupVolunteerRow>();
  for (const row of allRows) {
    if (!dedupedByEmail.has(row.email)) {
      dedupedByEmail.set(row.email, row);
    }
  }

  return Array.from(dedupedByEmail.values());
};

// ============================================
// EMAIL HELPERS
// ============================================

export const sendGroupMailDispatchSummary = async ({
  groupName,
  responsibleName,
  responsibleEmail,
  dayNumber,
  dayDate,
  createdQrCount,
  emailsSentCount,
  emailsFailedCount,
}: {
  groupName: string;
  responsibleName: string;
  responsibleEmail: string;
  dayNumber: number;
  dayDate: string;
  createdQrCount: number;
  emailsSentCount: number;
  emailsFailedCount: number;
}) => {
  const subject = `QR groupe envoyés - ${groupName} (${emailsSentCount} emails envoyés)`;

  await sendEmail({
    to: "contact@ftourbabrayan.ma",
    cc: [...GROUP_MAIL_DISPATCH_CC],
    subject,
    html: `
      <p>Bonjour,</p>
      <p>Les emails d'inscription du groupe ont été traités.</p>
      <ul>
        <li><strong>Groupe :</strong> ${groupName}</li>
        <li><strong>Responsable :</strong> ${responsibleName}</li>
        <li><strong>Email responsable :</strong> ${responsibleEmail}</li>
        <li><strong>Jour Ramadan :</strong> ${dayNumber} (${dayDate})</li>
        <li><strong>QR codes produits :</strong> ${createdQrCount}</li>
        <li><strong>Emails envoyés :</strong> ${emailsSentCount}</li>
        <li><strong>Emails en échec :</strong> ${emailsFailedCount}</li>
      </ul>
      <p>Ceci est un message d'information automatique.</p>
    `,
  });
};

const sendGroupVolunteerConfirmationEmails = async ({
  volunteers,
  day,
  volunteerSlots,
}: {
  volunteers: GroupVolunteerForEmail[];
  day: {
    dayNumber: number;
    date: string;
    location?: string | null;
    iftarTime?: string | null;
  };
  volunteerSlots: Array<"preparation_ftour" | "service_ftour">;
}) => {
  if (volunteers.length === 0) {
    return {
      sent: 0,
      failed: 0,
      details: [] as { email: string; success: boolean; error?: string }[],
    };
  }

  const baseUrl =
    process.env.NODE_ENV === "production"
      ? "https://ftourbabrayan.ma"
      : "http://localhost:3000";

  const emailTasks: Array<
    () => Promise<{ email: string; success: boolean; error?: string }>
  > = volunteers.map(volunteer => async () => {
    if (!volunteer.qrToken) {
      return {
        email: volunteer.email,
        success: false,
        error: "QR token introuvable",
      };
    }

    const emailData = generateVolunteerConfirmationEmail({
      firstName: volunteer.firstName,
      lastName: volunteer.lastName,
      email: volunteer.email,
      dayNumber: day.dayNumber,
      dayDate: new Date(day.date).toLocaleDateString("fr-FR", {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
      location: day.location || "Association Bab Rayan, Casablanca",
      startTime: day.iftarTime || "18h00",
      volunteerSlots,
      qrToken: volunteer.qrToken,
      baseUrl,
      groupMembersCount: volunteer.groupMembersCount,
    });

    const emailResult = await sendEmail({
      to: volunteer.email,
      subject: emailData.subject,
      html: emailData.html,
    });

    if (emailResult.success) {
      return { email: volunteer.email, success: true };
    }

    return {
      email: volunteer.email,
      success: false,
      error: emailResult.error || "Envoi email échoué",
    };
  });

  const details: { email: string; success: boolean; error?: string }[] = [];
  const emailBatches = chunkArray(emailTasks, 25);

  for (let batchIndex = 0; batchIndex < emailBatches.length; batchIndex += 1) {
    const emailBatch = emailBatches[batchIndex];
    const batchResults = await runWithConcurrencyLimit(emailBatch, 1);
    details.push(...batchResults);

    if (batchIndex < emailBatches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 800));
    }
  }

  const sent = details.filter(result => result.success).length;
  const failed = details.length - sent;

  return { sent, failed, details };
};

export const processGroupVolunteerRows = async ({
  parsedRows,
  dayId,
  day,
  volunteerSlots,
}: {
  parsedRows: ParsedGroupVolunteerRow[];
  dayId: number;
  day: {
    dayNumber: number;
    date: string;
    location?: string | null;
    iftarTime?: string | null;
  };
  volunteerSlots: Array<"preparation_ftour" | "service_ftour">;
}) => {
  const results: { email: string; success: boolean; error?: string }[] = [];
  const normalizedRows = parsedRows.map(row => ({
    ...row,
    email: row.email.toLowerCase().trim(),
  }));

  const existingEmails = new Set<string>();
  const duplicateCheckChunks = chunkArray(
    normalizedRows.map(row => row.email),
    400
  );
  for (const emailChunk of duplicateCheckChunks) {
    const chunkExisting = await supabaseServices.getExistingVolunteerEmailsForDay(
      dayId,
      emailChunk
    );
    chunkExisting.forEach(existingEmail => {
      existingEmails.add(existingEmail);
    });
  }

  const uniqueRows: typeof normalizedRows = [];
  const seenInFile = new Set<string>();

  for (const row of normalizedRows) {
    if (existingEmails.has(row.email)) {
      results.push({
        email: row.email,
        success: false,
        error: "Déjà inscrit pour ce jour",
      });
      continue;
    }

    if (seenInFile.has(row.email)) {
      results.push({
        email: row.email,
        success: false,
        error: "Email en doublon dans le fichier",
      });
      continue;
    }

    seenInFile.add(row.email);
    uniqueRows.push(row);
  }

  const createdVolunteersForEmail: GroupVolunteerForEmail[] = [];
  let emailsSentCount = 0;
  let emailsFailedCount = 0;

  if (uniqueRows.length > 0) {
    const insertChunks = chunkArray(uniqueRows, 200);

    for (const rowsChunk of insertChunks) {
      try {
        const createdVolunteers =
          await supabaseServices.createVolunteerShiftsBulkSupabase(
            rowsChunk.map(row => ({
              firstName: row.firstName,
              lastName: row.lastName,
              email: row.email,
              phone: row.phone,
              city: row.city,
              dayId,
              volunteerSlots,
              acceptedTerms: true,
            }))
          );

        const createdByEmail = new Map(
          createdVolunteers.map(vol => [vol.email.toLowerCase().trim(), vol])
        );

        for (const row of rowsChunk) {
          const volunteer = createdByEmail.get(row.email);
          if (!volunteer) {
            results.push({
              email: row.email,
              success: false,
              error: "Inscription créée de façon incomplète",
            });
            continue;
          }

          createdVolunteersForEmail.push({
            firstName: row.firstName,
            lastName: row.lastName,
            email: row.email,
            phone: row.phone,
            city: row.city,
            qrToken: volunteer.qrToken,
          });
        }
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : "Erreur inconnue";
        for (const row of rowsChunk) {
          results.push({ email: row.email, success: false, error: errMsg });
        }
        console.error("[ProcessGroupRows] Bulk creation error:", error);
      }
    }
  }

  if (createdVolunteersForEmail.length > 0) {
    const emailSummary = await sendGroupVolunteerConfirmationEmails({
      volunteers: createdVolunteersForEmail,
      day,
      volunteerSlots,
    });
    emailsSentCount = emailSummary.sent;
    emailsFailedCount = emailSummary.failed;

    const emailResults = emailSummary.details.map(result =>
      result.success
        ? result
        : {
            ...result,
            error: `Inscrit mais email non envoyé: ${result.error}`,
          }
    );
    results.push(...emailResults);
  }

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  return {
    results,
    successCount,
    failCount,
    totalRows: parsedRows.length,
    createdQrCount: createdVolunteersForEmail.length,
    emailsSentCount,
    emailsFailedCount,
  };
};

// ============================================
// MAIN VALIDATION FUNCTION
// ============================================

/**
 * Valide une demande de groupe bénévole à partir de son token de validation.
 * Déclenche l'envoi du mail de confirmation au responsable, le traitement
 * du fichier Excel et l'envoi des QR codes à tous les participants.
 *
 * Returns: { success: true } or throws an Error with a human-readable message.
 */
export async function validateGroupRequestByToken(token: string): Promise<{
  groupName: string;
  responsibleEmail: string;
  dayNumber: number;
  participantsProcessed: number;
}> {
  const request = await supabaseServices.getVolunteerGroupRequestByValidationToken(token);
  if (!request) {
    throw new Error("Lien de validation invalide ou expiré.");
  }

  if (request.status !== "pending") {
    const statusLabel = request.status === "validated" ? "déjà validée" : "refusée";
    throw new Error(`Cette demande a été ${statusLabel}.`);
  }

  const dayId = request.day_id ?? request.dayId;
  const day = await supabaseServices.getRamadanDayByIdSupabase(dayId);
  if (!day) {
    throw new Error("Jour Ramadan introuvable.");
  }

  const estimatedSize = Number(request.estimated_size ?? request.estimatedSize ?? 1);
  const normalizedEstimatedSize = Number.isFinite(estimatedSize) && estimatedSize > 0 ? estimatedSize : 1;
  const availableSeats = Math.max(0, day.capacity - (day.registeredCount ?? 0));

  if (normalizedEstimatedSize > availableSeats) {
    throw new Error(
      `Le jour choisi est complet pour cet effectif de groupe (${normalizedEstimatedSize} demandés, ${availableSeats} places disponibles).`
    );
  }

  const normalizedResponsibleEmail = String(
    request.responsible_email ?? request.responsibleEmail
  )
    .toLowerCase()
    .trim();

  const duplicate = await supabaseServices.checkVolunteerEmailExistsForDay(
    normalizedResponsibleEmail,
    dayId
  );
  if (duplicate) {
    throw new Error("Le responsable est déjà inscrit sur ce jour.");
  }

  // Create volunteer shift for group leader
  const createdVolunteer = await supabaseServices.createVolunteerShiftSupabase({
    firstName:
      String(request.responsible_name ?? request.responsibleName).split(" ")[0] ||
      String(request.group_name ?? request.groupName),
    lastName:
      String(request.responsible_name ?? request.responsibleName)
        .split(" ")
        .slice(1)
        .join(" ") || String(request.group_name ?? request.groupName),
    email: normalizedResponsibleEmail,
    phone: String(request.responsible_phone ?? request.responsiblePhone),
    dayId,
    volunteerSlots: (request.volunteer_slots ?? request.volunteerSlots ?? []) as string[],
    acceptedTerms: true,
    groupLeaderEmail: normalizedResponsibleEmail,
    groupMembersCount: normalizedEstimatedSize,
    groupRemainingEntries: normalizedEstimatedSize,
  });

  // Mark request as validated
  await supabaseServices.updateVolunteerGroupRequestSupabase(
    Number(request.id),
    { status: "validated", reviewedBy: null }
  );

  const groupName = String(request.group_name ?? request.groupName);
  const responsibleName = String(request.responsible_name ?? request.responsibleName).trim();
  const [firstName = "", ...lastNameParts] = responsibleName.split(" ");

  const baseUrl =
    process.env.PUBLIC_APP_URL ||
    process.env.APP_BASE_URL ||
    process.env.VITE_APP_URL ||
    "https://ftourbabrayan.ma";

  const dayDate = new Date(day.date).toLocaleDateString("fr-FR", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  // Send confirmation email to group leader
  if (createdVolunteer?.qrToken) {
    const { generateVolunteerConfirmationEmail: genEmail } = await import("./email");
    const emailData = genEmail({
      firstName: firstName || groupName,
      lastName: lastNameParts.join(" ") || groupName,
      email: normalizedResponsibleEmail,
      dayNumber: day.dayNumber,
      dayDate,
      location: day.location || "Association Bab Rayan, Casablanca",
      startTime: day.iftarTime || "18h00",
      volunteerSlots: (request.volunteer_slots ?? request.volunteerSlots ?? []) as string[],
      qrToken: createdVolunteer.qrToken,
      baseUrl,
      groupMembersCount: normalizedEstimatedSize,
    });

    try {
      await sendEmail({
        to: normalizedResponsibleEmail,
        subject: emailData.subject,
        html: emailData.html,
      });
    } catch (error) {
      console.error("[ValidateGroupRequest] Failed to send leader confirmation email", error);
    }
  }

  // Process Excel file with participant list
  let participantsProcessed = 0;
  const requestFileBase64 = String(
    request.file_base64 ?? request.fileBase64 ?? ""
  ).trim();

  if (requestFileBase64) {
    try {
      const parsedRows = parseGroupVolunteersFromSpreadsheet(requestFileBase64);

      if (parsedRows.length > 0) {
        const processResult = await processGroupVolunteerRows({
          parsedRows,
          dayId,
          day,
          volunteerSlots: (
            request.volunteer_slots ??
            request.volunteerSlots ??
            []
          ) as Array<"preparation_ftour" | "service_ftour">,
        });

        participantsProcessed = processResult.successCount;

        try {
          await sendGroupMailDispatchSummary({
            groupName,
            responsibleName,
            responsibleEmail: normalizedResponsibleEmail,
            dayNumber: day.dayNumber,
            dayDate,
            createdQrCount: processResult.createdQrCount,
            emailsSentCount: processResult.emailsSentCount,
            emailsFailedCount: processResult.emailsFailedCount,
          });
        } catch (error) {
          console.error("[ValidateGroupRequest] Failed to send dispatch summary", error);
        }
      }
    } catch (error) {
      console.error("[ValidateGroupRequest] Failed to process attachment", error);
    }
  }

  return {
    groupName,
    responsibleEmail: normalizedResponsibleEmail,
    dayNumber: day.dayNumber,
    participantsProcessed,
  };
}
