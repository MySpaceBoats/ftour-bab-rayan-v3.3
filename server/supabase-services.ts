import { getSupabaseAdminClient, getSupabasePublicClient, volunteerSlotsColumnExists } from './supabase';
import { generateSecureToken } from './qrcode';

// ============================================
// USER SERVICES
// ============================================

export interface UserData {
  openId: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  loginMethod?: string | null;
  role?: 'user' | 'admin' | 'super_admin' | 'admin_operations' | 'admin_boutique' | 'admin_dons' | 'scanner';
}

export async function upsertUserSupabase(user: UserData) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('Supabase not configured');

  const { data: existing } = await client
    .from('users')
    .select('*')
    .eq('open_id', user.openId)
    .single();

  if (existing) {
    const { error } = await client
      .from('users')
      .update({
        name: user.name,
        email: user.email,
        phone: user.phone,
        login_method: user.loginMethod,
        role: user.role || existing.role,
        last_signed_in: new Date().toISOString(),
      })
      .eq('open_id', user.openId);
    
    if (error) throw error;
    return existing;
  } else {
    const { data, error } = await client
      .from('users')
      .insert({
        open_id: user.openId,
        name: user.name,
        email: user.email,
        phone: user.phone,
        login_method: user.loginMethod,
        role: user.role || 'user',
        last_signed_in: new Date().toISOString(),
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
}

export async function getUserByOpenIdSupabase(openId: string) {
  const client = getSupabaseAdminClient();
  if (!client) return null;

  const { data, error } = await client
    .from('users')
    .select('*')
    .eq('open_id', openId)
    .single();

  if (error || !data) return null;
  
  // Map snake_case to camelCase for compatibility
  return {
    id: data.id,
    openId: data.open_id,
    name: data.name,
    email: data.email,
    phone: data.phone,
    loginMethod: data.login_method,
    role: data.role,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
    lastSignedIn: new Date(data.last_signed_in),
  };
}

export async function getAllUsersSupabase() {
  const client = getSupabaseAdminClient();
  if (!client) return [];

  const { data, error } = await client
    .from('users')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data?.map(u => ({
    id: u.id,
    openId: u.open_id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    loginMethod: u.login_method,
    role: u.role,
    createdAt: new Date(u.created_at),
    updatedAt: new Date(u.updated_at),
    lastSignedIn: new Date(u.last_signed_in),
  })) || [];
}

export async function updateUserRoleSupabase(userId: number, role: string) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('Supabase not configured');

  const { error } = await client
    .from('users')
    .update({ role })
    .eq('id', userId);

  if (error) throw error;
}

export async function updateUserRoleByOpenIdSupabase(openId: string, role: string) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('Supabase not configured');

  const { error } = await client
    .from('users')
    .update({ role })
    .eq('open_id', openId);

  if (error) throw error;
}

// ============================================
// RAMADAN DAYS SERVICES
// ============================================

export interface RamadanDayData {
  dayNumber: number;
  date: string;
  hijriDate?: string;
  capacity: number;
  isOpen?: boolean;
  iftarTime?: string;
  location?: string;
  notes?: string;
}

export async function createRamadanDaySupabase(day: RamadanDayData) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('Supabase not configured');

  const { data, error } = await client
    .from('ramadan_days')
    .insert({
      day_number: day.dayNumber,
      date: day.date,
      hijri_date: day.hijriDate,
      capacity: day.capacity,
      is_open: day.isOpen ?? true,
      iftar_time: day.iftarTime,
      location: day.location,
      notes: day.notes,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getAllRamadanDaysSupabase() {
  const client = getSupabaseAdminClient();
  if (!client) return [];

  const { data, error } = await client
    .from('ramadan_days')
    .select('*')
    .order('day_number', { ascending: true });

  if (error) throw error;
  return data?.map(d => ({
    id: d.id,
    dayNumber: d.day_number,
    date: d.date,
    hijriDate: d.hijri_date,
    capacity: d.capacity,
    registeredCount: d.registered_count,
    isOpen: d.is_open,
    iftarTime: d.iftar_time,
    location: d.location,
    notes: d.notes,
    createdAt: new Date(d.created_at),
    updatedAt: new Date(d.updated_at),
  })) || [];
}

export async function getRamadanDayByIdSupabase(id: number) {
  const client = getSupabaseAdminClient();
  if (!client) return null;

  const { data, error } = await client
    .from('ramadan_days')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return null;
  return {
    id: data.id,
    dayNumber: data.day_number,
    date: data.date,
    hijriDate: data.hijri_date,
    capacity: data.capacity,
    registeredCount: data.registered_count,
    isOpen: data.is_open,
    iftarTime: data.iftar_time,
    location: data.location,
    notes: data.notes,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
  };
}

export async function updateRamadanDaySupabase(id: number, updates: Partial<RamadanDayData>) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('Supabase not configured');

  const updateData: Record<string, unknown> = {};
  if (updates.dayNumber !== undefined) updateData.day_number = updates.dayNumber;
  if (updates.date !== undefined) updateData.date = updates.date;
  if (updates.hijriDate !== undefined) updateData.hijri_date = updates.hijriDate;
  if (updates.capacity !== undefined) updateData.capacity = updates.capacity;
  if (updates.isOpen !== undefined) updateData.is_open = updates.isOpen;
  if (updates.iftarTime !== undefined) updateData.iftar_time = updates.iftarTime;
  if (updates.location !== undefined) updateData.location = updates.location;
  if (updates.notes !== undefined) updateData.notes = updates.notes;

  const { error } = await client
    .from('ramadan_days')
    .update(updateData)
    .eq('id', id);

  if (error) throw error;
}

export async function deleteRamadanDaySupabase(id: number) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('Supabase not configured');

  const { error } = await client
    .from('ramadan_days')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ============================================
// VOLUNTEER SERVICES
// ============================================

/**
 * Normalizes volunteer_slots from DB which may be stored as:
 * - a JSON array (correct): ["preparation_ftour","service_ftour"]
 * - a JSON string (legacy/quirk): '["preparation_ftour","service_ftour"]'
 * - null/undefined
 * Always returns a string[].
 */
function normalizeVolunteerSlots(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((s): s is string => typeof s === 'string');
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter((s): s is string => typeof s === 'string');
    } catch {
      // not JSON, return empty
    }
  }
  return [];
}

/**
 * Extracts volunteer_slots from a raw DB row, handling both
 * snake_case (volunteer_slots) and camelCase (volunteerSlots) column names.
 */
function extractSlots(row: any): string[] {
  return normalizeVolunteerSlots(row.volunteer_slots ?? row.volunteerSlots);
}

export interface VolunteerData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city?: string;
  dayId: number;
  volunteerSlots?: string[];
  acceptedTerms: boolean;
}

export async function createVolunteerShiftSupabase(data: VolunteerData) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('Supabase not configured');

  // Generate secure token
  const qrToken = generateSecureToken();

  const slotsArray = data.volunteerSlots || [];

  // Build the insert payload
  const insertPayload: Record<string, any> = {
    first_name: data.firstName,
    last_name: data.lastName,
    email: data.email,
    phone: data.phone,
    city: data.city,
    day_id: data.dayId,
    qr_token: qrToken,
    qr_status: 'generated',
    status: 'registered',
    accepted_terms: data.acceptedTerms,
    email_sent: false,
  };

  // Always include volunteer_slots - PostgREST silently ignores it
  // if the column doesn't exist in the DB
  insertPayload.volunteer_slots = slotsArray;

  const { data: volunteer, error } = await client
    .from('volunteers')
    .insert(insertPayload)
    .select()
    .single();

  if (error) throw error;

  // Log if slots weren't stored (column might be missing from DB)
  const storedSlots = extractSlots(volunteer);
  if (slotsArray.length > 0 && storedSlots.length === 0) {
    console.warn('[Volunteer] WARNING: volunteer_slots were NOT stored in DB!');
    console.warn('[Volunteer] The volunteer_slots column is likely missing.');
    console.warn("[Volunteer] Run: ALTER TABLE volunteers ADD COLUMN IF NOT EXISTS volunteer_slots JSONB DEFAULT '[]'::jsonb;");
  }

  return {
    id: volunteer.id,
    firstName: volunteer.first_name ?? volunteer.firstName,
    lastName: volunteer.last_name ?? volunteer.lastName,
    email: volunteer.email,
    phone: volunteer.phone,
    city: volunteer.city,
    dayId: volunteer.day_id ?? volunteer.dayId,
    volunteerSlots: storedSlots.length > 0 ? storedSlots : slotsArray,
    qrToken: volunteer.qr_token ?? volunteer.qrToken,
    qrStatus: volunteer.qr_status ?? volunteer.qrStatus,
    status: volunteer.status,
    acceptedTerms: volunteer.accepted_terms ?? volunteer.acceptedTerms,
    emailSent: volunteer.email_sent ?? volunteer.emailSent,
    createdAt: new Date(volunteer.created_at ?? volunteer.createdAt),
  };
}

export async function getVolunteerByTokenSupabase(token: string) {
  const client = getSupabaseAdminClient();
  if (!client) return null;

  const { data, error } = await client
    .from('volunteers')
    .select('*, ramadan_days(*)')
    .eq('qr_token', token)
    .single();

  if (error || !data) return null;

  const rd = data.ramadan_days;
  return {
    id: data.id,
    firstName: data.first_name ?? data.firstName,
    lastName: data.last_name ?? data.lastName,
    email: data.email,
    phone: data.phone,
    city: data.city,
    dayId: data.day_id ?? data.dayId,
    volunteerSlots: extractSlots(data),
    qrToken: data.qr_token ?? data.qrToken,
    qrStatus: data.qr_status ?? data.qrStatus,
    status: data.status,
    confirmedAt: (data.confirmed_at ?? data.confirmedAt) ? new Date(data.confirmed_at ?? data.confirmedAt) : null,
    scannedAt: (data.scanned_at ?? data.scannedAt) ? new Date(data.scanned_at ?? data.scannedAt) : null,
    scannedBy: data.scanned_by ?? data.scannedBy,
    acceptedTerms: data.accepted_terms ?? data.acceptedTerms,
    emailSent: data.email_sent ?? data.emailSent,
    notes: data.notes,
    createdAt: new Date(data.created_at ?? data.createdAt),
    updatedAt: new Date(data.updated_at ?? data.updatedAt),
    day: rd ? {
      id: rd.id,
      dayNumber: rd.day_number ?? rd.dayNumber,
      date: rd.date,
      hijriDate: rd.hijri_date ?? rd.hijriDate,
      iftarTime: rd.iftar_time ?? rd.iftarTime,
      location: rd.location,
    } : null,
  };
}

export async function getVolunteersByDaySupabase(dayId?: number) {
  const client = getSupabaseAdminClient();
  if (!client) return { volunteers: [], days: [] };

  let query = client.from('volunteers').select('*, ramadan_days(*)');
  
  if (dayId) {
    query = query.eq('day_id', dayId);
  }

  const { data: volunteers, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;

  const { data: days } = await client
    .from('ramadan_days')
    .select('*')
    .order('day_number', { ascending: true });

  return {
    volunteers: volunteers?.map(v => {
      const rd = v.ramadan_days;
      return {
        id: v.id,
        firstName: v.first_name ?? v.firstName,
        lastName: v.last_name ?? v.lastName,
        email: v.email,
        phone: v.phone,
        city: v.city,
        dayId: v.day_id ?? v.dayId,
        volunteerSlots: extractSlots(v),
        qrToken: v.qr_token ?? v.qrToken,
        qrStatus: v.qr_status ?? v.qrStatus,
        status: v.status,
        scannedAt: (v.scanned_at ?? v.scannedAt) ? new Date(v.scanned_at ?? v.scannedAt) : null,
        scannedBy: v.scanned_by ?? v.scannedBy,
        createdAt: new Date(v.created_at ?? v.createdAt),
        day: rd ? {
          dayNumber: rd.day_number ?? rd.dayNumber,
          date: rd.date,
        } : null,
      };
    }) || [],
    days: days?.map(d => ({
      id: d.id,
      dayNumber: d.day_number ?? d.dayNumber,
      date: d.date,
    })) || [],
  };
}

export async function scanAndValidateTokenSupabase(token: string, validatedBy?: number, ipAddress?: string, userAgent?: string) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('Supabase not configured');

  // Get volunteer by token
  const volunteer = await getVolunteerByTokenSupabase(token);
  if (!volunteer) {
    console.log(JSON.stringify({ event: 'volunteer_confirm', token, state: 'invalid_token' }));
    return { success: false, error: 'Token invalide', code: 'INVALID_TOKEN' };
  }

  // Idempotent: already confirmed/validated → return success
  if (volunteer.qrStatus === 'validated') {
    console.log(JSON.stringify({ event: 'volunteer_confirm', volunteerId: volunteer.id, state: 'already_confirmed' }));
    return {
      success: true,
      state: 'already_confirmed' as const,
      volunteer,
    };
  }

  // Check if it's the right day
  const today = new Date().toISOString().split('T')[0];
  const volunteerDate = volunteer.day?.date
    ? new Date(volunteer.day.date).toISOString().split('T')[0]
    : null;
  if (volunteerDate && volunteerDate !== today) {
    console.log(JSON.stringify({ event: 'volunteer_confirm', volunteerId: volunteer.id, state: 'wrong_day', expected: volunteerDate, actual: today }));
    return {
      success: false,
      error: 'Ce QR code n\'est pas valide pour aujourd\'hui',
      code: 'WRONG_DAY',
      volunteer,
      expectedDate: volunteerDate,
    };
  }

  // Confirm the volunteer
  const now = new Date().toISOString();

  const { error: updateError } = await client
    .from('volunteers')
    .update({
      qr_status: 'validated',
      status: 'confirmed',
      confirmed_at: now,
      scanned_at: now,
      scanned_by: validatedBy,
    })
    .eq('id', volunteer.id);

  if (updateError) throw updateError;

  // Create checkin record for audit
  await client.from('checkins').insert({
    volunteer_id: volunteer.id,
    token: token,
    scanned_at: now,
    validated_by: validatedBy,
    validation_mode: 'scan',
    ip_address: ipAddress,
    user_agent: userAgent,
  });

  console.log(JSON.stringify({ event: 'volunteer_confirm', volunteerId: volunteer.id, state: 'confirmed' }));

  return {
    success: true,
    state: 'confirmed' as const,
    volunteer: { ...volunteer, qrStatus: 'validated', status: 'confirmed', confirmedAt: new Date(now), scannedAt: new Date(now) },
  };
}

export async function manualValidateSupabase(volunteerId: number, validatedBy: number) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('Supabase not configured');

  const now = new Date().toISOString();

  // Get volunteer first
  const { data: volunteer } = await client
    .from('volunteers')
    .select('qr_token')
    .eq('id', volunteerId)
    .single();

  const { error } = await client
    .from('volunteers')
    .update({
      qr_status: 'validated',
      status: 'confirmed',
      confirmed_at: now,
      scanned_at: now,
      scanned_by: validatedBy,
    })
    .eq('id', volunteerId);

  if (error) throw error;

  // Create checkin record for audit
  await client.from('checkins').insert({
    volunteer_id: volunteerId,
    token: volunteer?.qr_token || '',
    scanned_at: now,
    validated_by: validatedBy,
    validation_mode: 'manual',
  });
}

export async function updateVolunteerStatusSupabase(volunteerId: number, status: string) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('Supabase not configured');

  const { error } = await client
    .from('volunteers')
    .update({ status })
    .eq('id', volunteerId);

  if (error) throw error;
}

export async function getVolunteerStatsSupabase() {
  const client = getSupabaseAdminClient();
  if (!client) return { total: 0, present: 0, absent: 0 };

  const { data, error } = await client
    .from('volunteers')
    .select('status');

  if (error) throw error;

  const total = data?.length || 0;
  const present = data?.filter(v => v.status === 'present').length || 0;
  const absent = data?.filter(v => v.status === 'absent').length || 0;

  return { total, present, absent };
}

export async function deleteVolunteerSupabase(volunteerId: number) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('Supabase not configured');

  // D'abord supprimer les checkins associés
  await client
    .from('checkins')
    .delete()
    .eq('volunteer_id', volunteerId);

  // Ensuite supprimer le bénévole
  const { error } = await client
    .from('volunteers')
    .delete()
    .eq('id', volunteerId);

  if (error) throw error;
}

// ============================================
// GOODIES SERVICES
// ============================================

export interface GoodieData {
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  category?: string;
  isActive?: boolean;
  sortOrder?: number;
}

export async function createGoodieSupabase(data: GoodieData) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('Supabase not configured');

  const { data: goodie, error } = await client
    .from('goodies')
    .insert({
      name: data.name,
      description: data.description,
      price: String(data.price), // Convert number to string for Supabase
      image_url: data.imageUrl,
      category: data.category,
      is_active: data.isActive ?? true,
      sort_order: data.sortOrder ?? 0,
    })
    .select()
    .single();

  if (error) throw error;
  return goodie;
}

export async function getAllGoodiesSupabase(activeOnly = false) {
  const client = getSupabaseAdminClient();
  if (!client) {
    console.error('[Goodies] Supabase admin client not configured');
    return [];
  }

  // Try fetching goodies with variants join first
  let query = client.from('goodies').select('*, goodie_variants(*)');

  if (activeOnly) {
    query = query.eq('is_active', true);
  }

  let { data, error } = await query.order('sort_order', { ascending: true });

  // If the variants join fails (FK not set up), fall back to goodies only
  if (error) {
    console.warn('[Goodies] Variants join failed, fetching goodies without variants:', error.message);
    let fallbackQuery = client.from('goodies').select('*');
    if (activeOnly) {
      fallbackQuery = fallbackQuery.eq('is_active', true);
    }
    const fallbackResult = await fallbackQuery.order('sort_order', { ascending: true });
    if (fallbackResult.error) {
      console.error('[Goodies] Failed to fetch goodies:', fallbackResult.error.message);
      throw fallbackResult.error;
    }
    data = fallbackResult.data?.map((g: any) => ({ ...g, goodie_variants: [] })) ?? null;
  }

  return data?.map((g: any) => ({
    id: g.id,
    name: g.name,
    description: g.description,
    price: parseFloat(g.price),
    imageUrl: g.image_url,
    category: g.category,
    isActive: g.is_active,
    sortOrder: g.sort_order,
    variants: g.goodie_variants?.map((v: { id: number; size: string | null; color: string | null; stock: number; price_modifier: string; is_available: boolean }) => ({
      id: v.id,
      size: v.size,
      color: v.color,
      stock: v.stock,
      priceModifier: parseFloat(v.price_modifier),
      isAvailable: v.is_available,
    })) || [],
    createdAt: new Date(g.created_at),
  })) || [];
}

export async function updateGoodieSupabase(id: number, updates: Partial<GoodieData>) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('Supabase not configured');

  const updateData: Record<string, unknown> = {};
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.price !== undefined) updateData.price = String(updates.price);
  if (updates.imageUrl !== undefined) updateData.image_url = updates.imageUrl;
  if (updates.category !== undefined) updateData.category = updates.category;
  if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
  if (updates.sortOrder !== undefined) updateData.sort_order = updates.sortOrder;

  const { error } = await client
    .from('goodies')
    .update(updateData)
    .eq('id', id);

  if (error) throw error;
}

export async function deleteGoodieSupabase(id: number) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('Supabase not configured');

  const { error } = await client
    .from('goodies')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ============================================
// ORDER SERVICES
// ============================================

export interface OrderItemData {
  goodieId: number;
  variantId?: number;
  quantity: number;
  unitPrice: number;
}

export interface OrderData {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  items: OrderItemData[];
  pickupDate?: string;
  pickupLocation?: string;
  notes?: string;
  deliveryMode?: 'pickup' | 'home_delivery';
  deliveryAddress?: string;
  deliveryCity?: string;
  deliveryNeighborhood?: string;
  deliveryPostalCode?: string;
  deliveryPhone?: string;
  deliveryInstructions?: string;
  paymentMethod?: 'bank_transfer' | 'cheque' | 'cash' | 'paypal' | string;
}

function generateOrderReference(): string {
  const prefix = 'FBR';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

export async function createGoodieOrderSupabase(data: OrderData) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('Supabase not configured');

  const orderReference = generateOrderReference();
  const deliveryFee = data.deliveryMode === 'home_delivery' ? 30 : 0;
  const itemsTotal = data.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const totalAmount = itemsTotal + deliveryFee;

  // Build delivery address JSON if home delivery
  const deliveryAddressData = data.deliveryMode === 'home_delivery' ? JSON.stringify({
    address: data.deliveryAddress,
    city: data.deliveryCity,
    neighborhood: data.deliveryNeighborhood,
    postalCode: data.deliveryPostalCode,
  }) : null;

  // Create order
  const { data: order, error: orderError } = await client
    .from('orders')
    .insert({
      order_reference: orderReference,
      customer_name: data.customerName,
      customer_email: data.customerEmail,
      customer_phone: data.customerPhone,
      total_amount: totalAmount,
      status: 'reserved',
      pickup_date: data.pickupDate,
      pickup_location: data.pickupLocation,
      notes: data.notes,
      delivery_mode: data.deliveryMode || 'pickup',
      delivery_fee: deliveryFee,
      delivery_address: deliveryAddressData,
      delivery_phone: data.deliveryPhone,
      delivery_instructions: data.deliveryInstructions,
      payment_method: data.paymentMethod || 'cash',
    })
    .select()
    .single();

  if (orderError) throw orderError;

  // Create order items
  const orderItems = data.items.map(item => ({
    order_id: order.id,
    goodie_id: item.goodieId,
    variant_id: item.variantId,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    total_price: item.unitPrice * item.quantity,
  }));

  const { error: itemsError } = await client
    .from('order_items')
    .insert(orderItems);

  if (itemsError) throw itemsError;

  return {
    orderId: order.id,
    orderReference: order.order_reference,
    totalAmount: parseFloat(order.total_amount),
    status: order.status,
    createdAt: new Date(order.created_at),
  };
}

export async function getAllOrdersSupabase() {
  const client = getSupabaseAdminClient();
  if (!client) return [];

  const { data, error } = await client
    .from('orders')
    .select('*, order_items(*, goodies(name))')
    .order('created_at', { ascending: false });

  if (error) throw error;

  return data?.map((o: any) => ({
    id: o.id,
    orderReference: o.order_reference,
    customerName: o.customer_name,
    customerEmail: o.customer_email,
    customerPhone: o.customer_phone,
    totalAmount: parseFloat(o.total_amount),
    status: o.status,
    pickupDate: o.pickup_date,
    pickupLocation: o.pickup_location,
    notes: o.notes,
    deliveryMode: o.delivery_mode,
    deliveryFee: o.delivery_fee ? parseFloat(o.delivery_fee) : 0,
    deliveryAddress: o.delivery_address,
    deliveryPhone: o.delivery_phone,
    deliveryInstructions: o.delivery_instructions,
    paymentMethod: o.payment_method,
    createdAt: new Date(o.created_at),
    items: o.order_items?.map((i: { id: number; goodie_id: number; quantity: number; unit_price: string; total_price: string; goodies: { name: string } | null }) => ({
      id: i.id,
      goodieId: i.goodie_id,
      goodieName: i.goodies?.name,
      quantity: i.quantity,
      unitPrice: parseFloat(i.unit_price),
      totalPrice: parseFloat(i.total_price),
    })) || [],
  })) || [];
}

export async function updateGoodieOrderStatusSupabase(orderId: number, status: string, processedBy?: number) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('Supabase not configured');

  const { error } = await client
    .from('orders')
    .update({ status, processed_by: processedBy })
    .eq('id', orderId);

  if (error) throw error;
}

export async function getGoodieOrderByReferenceSupabase(reference: string) {
  const client = getSupabaseAdminClient();
  if (!client) return null;

  const { data, error } = await client
    .from('orders')
    .select('*, order_items(*, goodies(name))')
    .eq('order_reference', reference)
    .single();

  if (error || !data) return null;

  // Parse delivery address if it's a JSON string
  let deliveryAddress = null;
  let deliveryCity = null;
  let deliveryNeighborhood = null;
  let deliveryPostalCode = null;
  
  if (data.delivery_address && typeof data.delivery_address === 'string') {
    try {
      const parsed = JSON.parse(data.delivery_address);
      deliveryAddress = parsed.address;
      deliveryCity = parsed.city;
      deliveryNeighborhood = parsed.neighborhood;
      deliveryPostalCode = parsed.postalCode;
    } catch (e) {
      // If parsing fails, use as is
      deliveryAddress = data.delivery_address;
    }
  }

  return {
    id: data.id,
    orderReference: data.order_reference,
    customerName: data.customer_name,
    customerEmail: data.customer_email,
    customerPhone: data.customer_phone,
    totalAmount: parseFloat(data.total_amount),
    status: data.status,
    pickupDate: data.pickup_date,
    pickupLocation: data.pickup_location,
    notes: data.notes,
    deliveryMode: data.delivery_mode,
    deliveryFee: data.delivery_fee ? parseFloat(data.delivery_fee) : 0,
    deliveryAddress,
    deliveryCity,
    deliveryNeighborhood,
    deliveryPostalCode,
    deliveryPhone: data.delivery_phone,
    deliveryInstructions: data.delivery_instructions,
    createdAt: new Date(data.created_at),
    items: data.order_items?.map((i: { id: number; goodie_id: number; quantity: number; unit_price: string; total_price: string; goodies: { name: string } | null }) => ({
      id: i.id,
      goodieId: i.goodie_id,
      goodieName: i.goodies?.name,
      quantity: i.quantity,
      unitPrice: parseFloat(i.unit_price),
      totalPrice: parseFloat(i.total_price),
    })) || [],
  };
}

export async function getOrderStatsSupabase() {
  const client = getSupabaseAdminClient();
  if (!client) return { total: 0, reserved: 0, paid: 0, delivered: 0, totalAmount: 0 };

  const { data, error } = await client
    .from('orders')
    .select('status, total_amount');

  if (error) throw error;

  const total = data?.length || 0;
  const reserved = data?.filter(o => o.status === 'reserved').length || 0;
  const paid = data?.filter(o => o.status === 'paid').length || 0;
  const delivered = data?.filter(o => o.status === 'delivered').length || 0;
  const totalAmount = data?.reduce((sum, o) => sum + parseFloat(o.total_amount), 0) || 0;

  return { total, reserved, paid, delivered, totalAmount };
}

// ============================================
// DONATION SERVICES
// ============================================

export interface DonationData {
  donorName: string;
  donorEmail: string;
  donorPhone?: string;
  amount: number;
  paymentMethod: 'transfer' | 'on_site';
  message?: string;
  isAnonymous?: boolean;
  acceptsUpdates?: boolean;
}

function generateDonationReference(): string {
  const prefix = 'DON';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

export async function createDonationPledgeSupabase(data: DonationData) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('Supabase not configured');

  const donationReference = generateDonationReference();

  const { data: donation, error } = await client
    .from('donations')
    .insert({
      donation_reference: donationReference,
      donor_name: data.donorName,
      donor_email: data.donorEmail,
      donor_phone: data.donorPhone,
      amount: data.amount,
      payment_method: data.paymentMethod,
      status: 'promised',
      message: data.message,
      is_anonymous: data.isAnonymous ?? false,
      accepts_updates: data.acceptsUpdates ?? false,
    })
    .select()
    .single();

  if (error) {
    console.error('[Donations] Error creating donation:', error.message, error.code);
    throw error;
  }

  return {
    donationId: donation.id,
    donationReference: donation.donation_reference ?? donation.donationReference,
    amount: parseFloat(donation.amount) || 0,
    status: donation.status ?? donation.donationStatus,
    createdAt: new Date(donation.created_at ?? donation.createdAt),
  };
}

export async function getAllDonationsSupabase() {
  const client = getSupabaseAdminClient();
  if (!client) {
    console.error('[Donations] Supabase admin client not configured');
    return [];
  }

  const { data, error } = await client
    .from('donations')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Donations] Error fetching donations:', error.message, error.code);
    throw error;
  }

  return data?.map((d: any) => ({
    id: d.id,
    donationReference: d.donation_reference ?? d.donationReference,
    donorName: d.donor_name ?? d.donorName,
    donorEmail: d.donor_email ?? d.donorEmail,
    donorPhone: d.donor_phone ?? d.donorPhone,
    amount: parseFloat(d.amount) || 0,
    paymentMethod: d.payment_method ?? d.paymentMethod,
    status: d.status ?? d.donationStatus,
    message: d.message,
    isAnonymous: d.is_anonymous ?? d.isAnonymous ?? false,
    acceptsUpdates: d.accepts_updates ?? d.acceptsUpdates ?? false,
    processedBy: d.processed_by ?? d.processedBy,
    createdAt: new Date(d.created_at ?? d.createdAt),
    updatedAt: d.updated_at ?? d.updatedAt ? new Date(d.updated_at ?? d.updatedAt) : null,
  })) || [];
}

export async function markDonationReceivedSupabase(donationId: number, processedBy?: number) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('Supabase not configured');

  const { error } = await client
    .from('donations')
    .update({ status: 'received', processed_by: processedBy })
    .eq('id', donationId);

  if (error) {
    console.error('[Donations] Error marking donation received:', error.message, error.code);
    throw error;
  }
}

export async function updateDonationStatusSupabase(donationId: number, status: string, processedBy?: number) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('Supabase not configured');

  const { error } = await client
    .from('donations')
    .update({ status, processed_by: processedBy })
    .eq('id', donationId);

  if (error) {
    console.error('[Donations] Error updating donation status:', error.message, error.code);
    throw error;
  }
}

export async function getDonationStatsSupabase() {
  const client = getSupabaseAdminClient();
  if (!client) {
    console.error('[Donations] Supabase admin client not configured for stats');
    return { total: 0, promised: 0, received: 0, totalAmount: 0, receivedAmount: 0 };
  }

  const { data, error } = await client
    .from('donations')
    .select('status, amount');

  if (error) {
    console.error('[Donations] Error fetching donation stats:', error.message, error.code);
    throw error;
  }

  const total = data?.length || 0;
  const getStatus = (d: any) => d.status ?? d.donationStatus;
  const getAmount = (d: any) => parseFloat(d.amount) || 0;
  const promised = data?.filter(d => getStatus(d) === 'promised').length || 0;
  const received = data?.filter(d => getStatus(d) === 'received').length || 0;
  const totalAmount = data?.reduce((sum, d) => sum + getAmount(d), 0) || 0;
  const receivedAmount = data?.filter(d => getStatus(d) === 'received').reduce((sum, d) => sum + getAmount(d), 0) || 0;

  return { total, promised, received, totalAmount, receivedAmount };
}

// ============================================
// CONTACT MESSAGES SERVICES
// ============================================

export interface ContactMessageData {
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
}

export async function createContactMessageSupabase(data: ContactMessageData) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('Supabase not configured');

  const { data: message, error } = await client
    .from('contact_messages')
    .insert({
      name: data.name,
      email: data.email,
      phone: data.phone,
      subject: data.subject,
      message: data.message,
      is_read: false,
    })
    .select()
    .single();

  if (error) throw error;
   return message;
}

export async function getAllContactMessagesSupabase() {
  const client = getSupabaseAdminClient();
  if (!client) return [];
  const { data, error } = await client
    .from('contact_messages')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function markContactMessageReadSupabase(id: number) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('Supabase not configured');
  const { error } = await client
    .from('contact_messages')
    .update({ is_read: true })
    .eq('id', id);
  if (error) throw error;
  return { success: true };
}

export async function deleteContactMessageSupabase(id: number) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('Supabase not configured');
  const { error } = await client
    .from('contact_messages')
    .delete()
    .eq('id', id);
  if (error) throw error;
  return { success: true };
}

// ============================================
// PUBLIC DATA SERVICES
// ============================================

export async function getPublicStatsSupabase() {
  const client = getSupabaseAdminClient();
  if (!client) return { totalVolunteers: 0, totalDonations: 0, totalFtours: 31200, receivedDonationAmount: 0 };

  const { data: volunteers } = await client.from('volunteers').select('id');
  const { data: donations } = await client.from('donations').select('id, amount').eq('status', 'received');

  const receivedDonationAmount = donations?.reduce((sum, d) => sum + (Number(d.amount) || 0), 0) || 0;

  return {
    totalVolunteers: volunteers?.length || 0,
    totalDonations: donations?.length || 0,
    totalFtours: 31200, // Historical data
    receivedDonationAmount,
  };
}

// ============================================
// TESTIMONIALS & PARTNERS SERVICES
// ============================================

export async function getAllTestimonialsSupabase() {
  const client = getSupabaseAdminClient();
  if (!client) return [];

  const { data, error } = await client
    .from('testimonials')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('[Supabase] Error fetching testimonials:', error);
    return [];
  }

  return (data || []).map(t => ({
    id: t.id,
    content: t.content,
    authorName: t.author_name,
    authorRole: t.author_role,
    rating: t.rating,
    createdAt: new Date(t.created_at),
  }));
}

export async function getAllPartnersSupabase() {
  const client = getSupabaseAdminClient();
  if (!client) return [];

  const { data, error } = await client
    .from('partners')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('[Supabase] Error fetching partners:', error);
    return [];
  }

  return (data || []).map(p => ({
    id: p.id,
    name: p.name,
    logoUrl: p.logo_url,
    websiteUrl: p.website_url,
    createdAt: new Date(p.created_at),
  }));
}


// ============================================
// PAYMENT SERVICES
// ============================================

import crypto from 'crypto';

export interface CreatePaymentInput {
  userName: string;
  email: string;
  phone: string;
  amount: number;
  currency?: string;
  paymentMethod: 'bank_transfer' | 'cheque' | 'cash' | 'paypal';
  description?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  metadata?: Record<string, any>;
}

/**
 * Génère une référence de paiement unique
 * Format: PAY-YYYYMMDD-XXXXX
 */
export function generatePaymentReference(): string {
  const date = new Date();
  const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
  const random = crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 5);
  return `PAY-${dateStr}-${random}`;
}

/**
 * Crée un paiement dans la base de données
 */
export async function createPaymentSupabase(input: CreatePaymentInput) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('Supabase not configured');

  const paymentReference = generatePaymentReference();
  const status = input.paymentMethod === 'paypal' ? 'processing' : 'pending';

  const { data: payment, error } = await client
    .from('payments')
    .insert({
      user_name: input.userName,
      email: input.email,
      phone: input.phone,
      amount: input.amount,
      currency: input.currency || 'MAD',
      payment_method: input.paymentMethod,
      payment_reference: paymentReference,
      status,
      description: input.description,
      related_entity_type: input.relatedEntityType,
      related_entity_id: input.relatedEntityId,
      metadata: input.metadata,
    })
    .select()
    .single();

  if (error) throw error;

  // Enregistrer l'action dans les logs
  await logPaymentActionSupabase(
    payment.id,
    'created',
    undefined,
    status,
    `Paiement ${input.paymentMethod} créé`
  );

  return payment;
}

/**
 * Récupère un paiement par ID
 */
export async function getPaymentByIdSupabase(paymentId: number) {
  const client = getSupabaseAdminClient();
  if (!client) return null;

  const { data, error } = await client
    .from('payments')
    .select('*')
    .eq('id', paymentId)
    .single();

  if (error) return null;
  return data;
}

/**
 * Récupère un paiement par référence
 */
export async function getPaymentByReferenceSupabase(reference: string) {
  const client = getSupabaseAdminClient();
  if (!client) return null;

  const { data, error } = await client
    .from('payments')
    .select('*')
    .eq('payment_reference', reference)
    .single();

  if (error) return null;
  return data;
}

/**
 * Récupère tous les paiements avec filtres optionnels
 */
export async function getPaymentsSupabase(filters?: {
  paymentMethod?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
}) {
  const client = getSupabaseAdminClient();
  if (!client) return [];

  let query = client.from('payments').select('*');

  if (filters?.paymentMethod) {
    query = query.eq('payment_method', filters.paymentMethod);
  }

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  if (filters?.startDate) {
    query = query.gte('created_at', filters.startDate.toISOString());
  }

  if (filters?.endDate) {
    query = query.lte('created_at', filters.endDate.toISOString());
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) return [];
  return data || [];
}

/**
 * Valide un paiement (admin)
 */
export async function validatePaymentSupabase(
  paymentId: number,
  validatedBy: number,
  notes?: string
) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('Supabase not configured');

  const payment = await getPaymentByIdSupabase(paymentId);
  if (!payment) throw new Error('Payment not found');

  const oldStatus = payment.status;

  const { error } = await client
    .from('payments')
    .update({
      status: 'confirmed',
      validated_at: new Date().toISOString(),
      validated_by: validatedBy,
    })
    .eq('id', paymentId);

  if (error) throw error;

  // Enregistrer l'action
  await logPaymentActionSupabase(
    paymentId,
    'validated',
    oldStatus,
    'confirmed',
    notes || 'Paiement validé par admin',
    validatedBy
  );

  return getPaymentByIdSupabase(paymentId);
}

/**
 * Annule un paiement
 */
export async function cancelPaymentSupabase(
  paymentId: number,
  cancelledBy: number,
  notes?: string
) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('Supabase not configured');

  const payment = await getPaymentByIdSupabase(paymentId);
  if (!payment) throw new Error('Payment not found');

  const oldStatus = payment.status;

  const { error } = await client
    .from('payments')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancelled_by: cancelledBy,
    })
    .eq('id', paymentId);

  if (error) throw error;

  // Enregistrer l'action
  await logPaymentActionSupabase(
    paymentId,
    'cancelled',
    oldStatus,
    'cancelled',
    notes || 'Paiement annulé',
    cancelledBy
  );

  return getPaymentByIdSupabase(paymentId);
}

/**
 * Marque un chèque comme encaissé
 */
export async function markChequeAsCashedSupabase(
  paymentId: number,
  cashedBy: number,
  notes?: string
) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('Supabase not configured');

  const payment = await getPaymentByIdSupabase(paymentId);
  if (!payment) throw new Error('Payment not found');
  if (payment.payment_method !== 'cheque') throw new Error('Payment is not a cheque');

  const oldStatus = payment.status;

  const { error } = await client
    .from('payments')
    .update({
      status: 'cashed',
      validated_at: new Date().toISOString(),
      validated_by: cashedBy,
    })
    .eq('id', paymentId);

  if (error) throw error;

  // Enregistrer l'action
  await logPaymentActionSupabase(
    paymentId,
    'cashed',
    oldStatus,
    'cashed',
    notes || 'Chèque encaissé',
    cashedBy
  );

  return getPaymentByIdSupabase(paymentId);
}

/**
 * Enregistre une action dans le journal des paiements
 */
export async function logPaymentActionSupabase(
  paymentId: number,
  action: string,
  oldStatus?: string,
  newStatus?: string,
  notes?: string,
  performedBy?: number,
  ipAddress?: string,
  userAgent?: string
) {
  try {
    const client = getSupabaseAdminClient();
    if (!client) return;

    await client.from('payment_logs').insert({
      payment_id: paymentId,
      action,
      old_status: oldStatus,
      new_status: newStatus,
      notes,
      performed_by: performedBy,
      ip_address: ipAddress,
      user_agent: userAgent,
    });
  } catch (error) {
    console.error('[PaymentLog] Error logging action:', error);
  }
}

/**
 * Récupère la configuration d'un moyen de paiement
 */
export async function getPaymentMethodConfigSupabase(method: string) {
  const client = getSupabaseAdminClient();
  if (!client) return null;

  const { data, error } = await client
    .from('payment_methods_config')
    .select('*')
    .eq('method', method)
    .single();

  if (error) return null;
  return data;
}

/**
 * Récupère les statistiques des paiements
 */
export async function getPaymentStatsSupabase() {
  const client = getSupabaseAdminClient();
  if (!client) return { total: 0, pending: 0, confirmed: 0, cancelled: 0, totalAmount: 0 };

  const { data, error } = await client
    .from('payments')
    .select('status, amount');

  if (error) return { total: 0, pending: 0, confirmed: 0, cancelled: 0, totalAmount: 0 };

  const stats = {
    total: data?.length || 0,
    pending: data?.filter(p => p.status === 'pending').length || 0,
    confirmed: data?.filter(p => p.status === 'confirmed').length || 0,
    cancelled: data?.filter(p => p.status === 'cancelled').length || 0,
    totalAmount: data?.reduce((sum: number, p: any) => sum + (parseFloat(p.amount) || 0), 0) || 0,
  };

  return stats;
}


// ============================================
// PASTRY SERVICES (Pâtisserie Solidaire)
// ============================================

export async function getPastriesSupabase() {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('Supabase not configured');

  const { data, error } = await client
    .from('pastries')
    .select('*')
    .eq('active', true)
    .order('sortOrder', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createPastryOrderSupabase(orderData: {
  reference: string;
  customerName: string;
  phone: string;
  email?: string;
  items: Array<{ pastryId: number; quantity: number; price: number }>;
  totalAmount: number;
  paymentMethod: string;
  qrToken?: string;
}) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('Supabase not configured');

  const { data, error } = await client
    .from('pastry_orders')
    .insert({
      reference: orderData.reference,
      customer_name: orderData.customerName,
      phone: orderData.phone,
      email: orderData.email,
      items: orderData.items,
      total_amount: orderData.totalAmount,
      payment_method: orderData.paymentMethod,
      payment_status: 'pending',
      order_status: 'reserved',
      qr_token: orderData.qrToken,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getPastryOrderByReferenceSupabase(reference: string) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('Supabase not configured');

  const { data, error } = await client
    .from('pastry_orders')
    .select('*')
    .eq('reference', reference)
    .single();

  if (error) throw error;
  return data;
}

export async function getPastryOrdersSupabase(filters?: {
  status?: string;
  paymentStatus?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('Supabase not configured');

  let query = client.from('pastry_orders').select('*');

  if (filters?.status) {
    query = query.eq('order_status', filters.status);
  }
  if (filters?.paymentStatus) {
    query = query.eq('payment_status', filters.paymentStatus);
  }
  if (filters?.dateFrom) {
    query = query.gte('created_at', filters.dateFrom);
  }
  if (filters?.dateTo) {
    query = query.lte('created_at', filters.dateTo);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function updatePastryOrderStatusSupabase(
  orderId: number,
  orderStatus: string,
  paymentStatus?: string,
  scannedBy?: number
) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('Supabase not configured');

  const updateData: any = {
    order_status: orderStatus,
    scanned_at: new Date().toISOString(),
  };

  if (paymentStatus) {
    updateData.payment_status = paymentStatus;
  }
  if (scannedBy) {
    updateData.scanned_by = scannedBy;
  }

  const { data, error } = await client
    .from('pastry_orders')
    .update(updateData)
    .eq('id', orderId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function generateQRTokenSupabase(scope: string, entityId: number) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('Supabase not configured');

  const token = generateSecureToken();

  const { data, error } = await client
    .from('qr_tokens')
    .insert({
      token,
      scope,
      entity_id: entityId,
      status: 'active',
      max_uses: 1,
      uses_count: 0,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function validateQRTokenSupabase(token: string, scope: string) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('Supabase not configured');

  const { data: qrData, error: qrError } = await client
    .from('qr_tokens')
    .select('*')
    .eq('token', token)
    .eq('scope', scope)
    .single();

  if (qrError || !qrData) {
    throw new Error('QR token not found');
  }

  if (qrData.status !== 'active') {
    throw new Error('QR token is not active');
  }

  if (qrData.uses_count >= qrData.max_uses) {
    throw new Error('QR token has reached maximum uses');
  }

  // Increment uses count
  const { error: updateError } = await client
    .from('qr_tokens')
    .update({
      uses_count: qrData.uses_count + 1,
      status: qrData.uses_count + 1 >= qrData.max_uses ? 'used' : 'active',
    })
    .eq('id', qrData.id);

  if (updateError) throw updateError;

  return qrData;
}

export async function logQRScanSupabase(
  token: string,
  scope: string,
  entityId: number,
  validationAction: string,
  validatedBy: number,
  success: boolean = true,
  errorMessage?: string
) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('Supabase not configured');

  const { error } = await client
    .from('qr_scans')
    .insert({
      token,
      scope,
      entity_id: entityId,
      validation_action: validationAction,
      validated_by: validatedBy,
      success,
      error_message: errorMessage,
      scanned_at: new Date().toISOString(),
    });

  if (error) throw error;
}

export async function getPastryOrderStatsSupabase() {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('Supabase not configured');

  const { data, error } = await client
    .from('pastry_orders')
    .select('order_status, payment_status, total_amount');

  if (error) return { total: 0, reserved: 0, paid: 0, handed: 0, totalAmount: 0 };

  const stats = {
    total: data?.length || 0,
    reserved: data?.filter(p => p.order_status === 'reserved').length || 0,
    paid: data?.filter(p => p.order_status === 'paid').length || 0,
    handed: data?.filter(p => p.order_status === 'handed').length || 0,
    totalAmount: data?.reduce((sum: number, p: any) => sum + (parseFloat(p.total_amount) || 0), 0) || 0,
  };

  return stats;
}

// ============================================
// CONTENT MANAGEMENT SERVICES (Partners, Testimonials, FAQ)
// ============================================

// --- PARTNERS ADMIN ---
export async function getAllPartnersAdminSupabase() {
  const client = getSupabaseAdminClient();
  if (!client) return [];
  const { data, error } = await client
    .from('partners')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) { console.error('[Supabase] Error fetching partners (admin):', error); return []; }
  return (data || []).map(p => ({
    id: p.id, name: p.name, logoUrl: p.logo_url, websiteUrl: p.website_url,
    description: p.description || '', isActive: p.is_active, sortOrder: p.sort_order,
    createdAt: p.created_at, updatedAt: p.updated_at,
  }));
}

export async function createPartnerSupabase(input: { name: string; logoUrl?: string; websiteUrl?: string; description?: string }) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('Supabase not configured');
  const { data, error } = await client.from('partners').insert({
    name: input.name, logo_url: input.logoUrl || null, website_url: input.websiteUrl || null,
    description: input.description || null, is_active: true, sort_order: 0,
  }).select().single();
  if (error) throw new Error(`Erreur création partenaire: ${error.message}`);
  return data;
}

export async function updatePartnerSupabase(id: number, input: { name?: string; logoUrl?: string; websiteUrl?: string; description?: string; isActive?: boolean; sortOrder?: number }) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('Supabase not configured');
  const updateData: any = { updated_at: new Date().toISOString() };
  if (input.name !== undefined) updateData.name = input.name;
  if (input.logoUrl !== undefined) updateData.logo_url = input.logoUrl;
  if (input.websiteUrl !== undefined) updateData.website_url = input.websiteUrl;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.isActive !== undefined) updateData.is_active = input.isActive;
  if (input.sortOrder !== undefined) updateData.sort_order = input.sortOrder;
  const { data, error } = await client.from('partners').update(updateData).eq('id', id).select().single();
  if (error) throw new Error(`Erreur mise à jour partenaire: ${error.message}`);
  return data;
}

export async function deletePartnerSupabase(id: number) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('Supabase not configured');
  const { error } = await client.from('partners').delete().eq('id', id);
  if (error) throw new Error(`Erreur suppression partenaire: ${error.message}`);
  return { success: true };
}

// --- TESTIMONIALS ADMIN ---
export async function getAllTestimonialsAdminSupabase() {
  const client = getSupabaseAdminClient();
  if (!client) return [];
  const { data, error } = await client
    .from('testimonials')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) { console.error('[Supabase] Error fetching testimonials (admin):', error); return []; }
  return (data || []).map(t => ({
    id: t.id, content: t.content, authorName: t.author_name, authorRole: t.author_role,
    rating: t.rating, isActive: t.is_active, sortOrder: t.sort_order,
    createdAt: t.created_at, updatedAt: t.updated_at,
  }));
}

export async function createTestimonialSupabase(input: { content: string; authorName: string; authorRole?: string; rating?: number }) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('Supabase not configured');
  const { data, error } = await client.from('testimonials').insert({
    content: input.content, author_name: input.authorName, author_role: input.authorRole || null,
    rating: input.rating || 5, is_active: true, sort_order: 0,
  }).select().single();
  if (error) throw new Error(`Erreur création témoignage: ${error.message}`);
  return data;
}

export async function updateTestimonialSupabase(id: number, input: { content?: string; authorName?: string; authorRole?: string; rating?: number; isActive?: boolean; sortOrder?: number }) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('Supabase not configured');
  const updateData: any = { updated_at: new Date().toISOString() };
  if (input.content !== undefined) updateData.content = input.content;
  if (input.authorName !== undefined) updateData.author_name = input.authorName;
  if (input.authorRole !== undefined) updateData.author_role = input.authorRole;
  if (input.rating !== undefined) updateData.rating = input.rating;
  if (input.isActive !== undefined) updateData.is_active = input.isActive;
  if (input.sortOrder !== undefined) updateData.sort_order = input.sortOrder;
  const { data, error } = await client.from('testimonials').update(updateData).eq('id', id).select().single();
  if (error) throw new Error(`Erreur mise à jour témoignage: ${error.message}`);
  return data;
}

export async function deleteTestimonialSupabase(id: number) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('Supabase not configured');
  const { error } = await client.from('testimonials').delete().eq('id', id);
  if (error) throw new Error(`Erreur suppression témoignage: ${error.message}`);
  return { success: true };
}

// --- FAQ ADMIN ---
export async function getAllFaqsAdminSupabase() {
  const client = getSupabaseAdminClient();
  if (!client) return [];
  const { data, error } = await client
    .from('faq')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) {
    // Table might not exist yet — return empty
    console.error('[Supabase] Error fetching FAQ (admin):', error);
    return [];
  }
  return (data || []).map(f => ({
    id: f.id, question: f.question, answer: f.answer, category: f.category,
    isActive: f.is_active, sortOrder: f.sort_order,
    createdAt: f.created_at, updatedAt: f.updated_at,
  }));
}

export async function getAllFaqsPublicSupabase() {
  const client = getSupabaseAdminClient();
  if (!client) return [];
  const { data, error } = await client
    .from('faq')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (error) return [];
  return (data || []).map(f => ({
    id: f.id, question: f.question, answer: f.answer, category: f.category,
  }));
}

export async function createFaqSupabase(input: { question: string; answer: string; category: string }) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('Supabase not configured');
  const { data, error } = await client.from('faq').insert({
    question: input.question, answer: input.answer, category: input.category,
    is_active: true, sort_order: 0,
  }).select().single();
  if (error) throw new Error(`Erreur création FAQ: ${error.message}`);
  return data;
}

export async function updateFaqSupabase(id: number, input: { question?: string; answer?: string; category?: string; isActive?: boolean; sortOrder?: number }) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('Supabase not configured');
  const updateData: any = { updated_at: new Date().toISOString() };
  if (input.question !== undefined) updateData.question = input.question;
  if (input.answer !== undefined) updateData.answer = input.answer;
  if (input.category !== undefined) updateData.category = input.category;
  if (input.isActive !== undefined) updateData.is_active = input.isActive;
  if (input.sortOrder !== undefined) updateData.sort_order = input.sortOrder;
  const { data, error } = await client.from('faq').update(updateData).eq('id', id).select().single();
  if (error) throw new Error(`Erreur mise à jour FAQ: ${error.message}`);
  return data;
}

export async function deleteFaqSupabase(id: number) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('Supabase not configured');
  const { error } = await client.from('faq').delete().eq('id', id);
  if (error) throw new Error(`Erreur suppression FAQ: ${error.message}`);
  return { success: true };
}
