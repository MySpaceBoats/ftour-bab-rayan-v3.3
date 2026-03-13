import { logAction, sanitizeAuditPayload } from "../services/auditLogger";

const ACTION_MAP: Array<{
  matcher: RegExp;
  action: string;
  entityType?: string;
  description: string;
}> = [
  { matcher: /^auth\.login$/, action: "login", entityType: "auth", description: "Connexion utilisateur" },
  { matcher: /^auth\.logout$/, action: "logout", entityType: "auth", description: "Déconnexion utilisateur" },
  { matcher: /^auth\.signup$/, action: "create_account", entityType: "auth", description: "Création de compte" },
  { matcher: /^auth\.requestPasswordReset$/, action: "reset_password", entityType: "auth", description: "Demande de réinitialisation" },
  { matcher: /^auth\.resetPassword$/, action: "reset_password", entityType: "auth", description: "Réinitialisation du mot de passe" },
  { matcher: /adminCreateProduct/, action: "create_product", entityType: "product", description: "Création de produit" },
  { matcher: /adminUpdateProduct/, action: "update_product", entityType: "product", description: "Modification de produit" },
  { matcher: /adminDeleteProduct/, action: "delete_product", entityType: "product", description: "Suppression de produit" },
  { matcher: /adminUpdate.*Stock|adjustStock|stockEntry|movement/i, action: "update_stock", entityType: "stock", description: "Mise à jour de stock" },
  { matcher: /content\.|cms/i, action: "update_cms_content", entityType: "cms", description: "Modification du contenu CMS" },
  { matcher: /upload|image/i, action: "upload_image", entityType: "media", description: "Upload de média" },
  { matcher: /gallery\.createAlbum|gallery\.adminCreateAlbum/i, action: "add_gallery_album", entityType: "gallery_album", description: "Ajout album galerie" },
  { matcher: /gallery\.delete|adminDeleteAlbum/i, action: "delete_gallery_album", entityType: "gallery_album", description: "Suppression album galerie" },
  { matcher: /gallery\.upload|photo/i, action: "upload_gallery_photos", entityType: "gallery_photo", description: "Upload photos galerie" },
  { matcher: /terroirModule\.adminCreateProduct/, action: "add_terroir_product", entityType: "terroir_product", description: "Ajout produit terroir" },
  { matcher: /terroirModule\.adminUpdateProduct/, action: "update_terroir_product", entityType: "terroir_product", description: "Modification produit terroir" },
  { matcher: /terroirModule\.adminDeleteProduct/, action: "delete_terroir_product", entityType: "terroir_product", description: "Suppression produit terroir" },
  { matcher: /pastr(y|ies)\.create|pastry.*create/i, action: "add_pastry", entityType: "pastry", description: "Ajout pâtisserie" },
  { matcher: /pastr(y|ies)\.update|pastry.*update/i, action: "update_pastry", entityType: "pastry", description: "Modification pâtisserie" },
  { matcher: /pastr(y|ies)\.delete|pastry.*delete/i, action: "delete_pastry", entityType: "pastry", description: "Suppression pâtisserie" },
  { matcher: /orders\.create|adminCreate.*Order|pastryOrders\.create|terroirModule\.createOrder/i, action: "create_order", entityType: "order", description: "Création commande" },
  { matcher: /orders\.update|adminUpdate.*Order|adminUpdateOrderStatus/i, action: "update_order", entityType: "order", description: "Modification commande" },
  { matcher: /validateGroupRequestByToken|adminApprove|approveGroup/i, action: "validate_group_request", entityType: "group_request", description: "Validation demande groupe" },
  { matcher: /rejectGroup|adminReject/i, action: "reject_group_request", entityType: "group_request", description: "Refus demande groupe" },
];

function resolveAction(path: string) {
  return ACTION_MAP.find((rule) => rule.matcher.test(path));
}

export async function auditMutation(opts: {
  path: string;
  type: "query" | "mutation" | "subscription";
  input: unknown;
  ctx: { req?: any; user?: any };
  resultOk: boolean;
  errorMessage?: string;
}): Promise<void> {
  if (opts.type !== "mutation") return;

  const match = resolveAction(opts.path);
  if (!match) return;

  await logAction({
    user: opts.ctx.user,
    action: match.action,
    entityType: match.entityType,
    entityId:
      typeof opts.input === "object" && opts.input !== null && "id" in (opts.input as Record<string, unknown>)
        ? String((opts.input as Record<string, unknown>).id)
        : undefined,
    description: opts.resultOk ? match.description : `${match.description} (échec)`,
    metadata: {
      path: opts.path,
      success: opts.resultOk,
      input: sanitizeAuditPayload(opts.input),
      errorMessage: opts.errorMessage,
    },
    request: opts.ctx.req,
    route: opts.path,
    httpMethod: "TRPC_MUTATION",
    responseStatus: opts.resultOk ? 200 : 500,
  });
}
