import { getSupabaseAdminClient, getSupabasePublicClient } from './supabase';
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

export interface VolunteerData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city?: string;
  dayId: number;
  acceptedTerms: boolean;
}

export async function createVolunteerShiftSupabase(data: VolunteerData) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('Supabase not configured');

  // Generate secure token
  const qrToken = generateSecureToken();

  const { data: volunteer, error } = await client
    .from('volunteers')
    .insert({
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
    })
    .select()
    .single();

  if (error) throw error;
  
  return {
    id: volunteer.id,
    firstName: volunteer.first_name,
    lastName: volunteer.last_name,
    email: volunteer.email,
    phone: volunteer.phone,
    city: volunteer.city,
    dayId: volunteer.day_id,
    qrToken: volunteer.qr_token,
    qrStatus: volunteer.qr_status,
    status: volunteer.status,
    acceptedTerms: volunteer.accepted_terms,
    emailSent: volunteer.email_sent,
    createdAt: new Date(volunteer.created_at),
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
  
  return {
    id: data.id,
    firstName: data.first_name,
    lastName: data.last_name,
    email: data.email,
    phone: data.phone,
    city: data.city,
    dayId: data.day_id,
    qrToken: data.qr_token,
    qrStatus: data.qr_status,
    status: data.status,
    scannedAt: data.scanned_at ? new Date(data.scanned_at) : null,
    scannedBy: data.scanned_by,
    acceptedTerms: data.accepted_terms,
    emailSent: data.email_sent,
    notes: data.notes,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
    day: data.ramadan_days ? {
      id: data.ramadan_days.id,
      dayNumber: data.ramadan_days.day_number,
      date: data.ramadan_days.date,
      hijriDate: data.ramadan_days.hijri_date,
      iftarTime: data.ramadan_days.iftar_time,
      location: data.ramadan_days.location,
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
    volunteers: volunteers?.map(v => ({
      id: v.id,
      firstName: v.first_name,
      lastName: v.last_name,
      email: v.email,
      phone: v.phone,
      city: v.city,
      dayId: v.day_id,
      qrToken: v.qr_token,
      qrStatus: v.qr_status,
      status: v.status,
      scannedAt: v.scanned_at ? new Date(v.scanned_at) : null,
      scannedBy: v.scanned_by,
      createdAt: new Date(v.created_at),
      day: v.ramadan_days ? {
        dayNumber: v.ramadan_days.day_number,
        date: v.ramadan_days.date,
      } : null,
    })) || [],
    days: days?.map(d => ({
      id: d.id,
      dayNumber: d.day_number,
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
    return { success: false, error: 'Token invalide', code: 'INVALID_TOKEN' };
  }

  // Check if already validated (anti-doublon)
  if (volunteer.qrStatus === 'validated') {
    return { 
      success: false, 
      error: 'QR code déjà validé', 
      code: 'ALREADY_VALIDATED',
      volunteer,
      scannedAt: volunteer.scannedAt,
    };
  }

  // Check if it's the right day
  const today = new Date().toISOString().split('T')[0];
  if (volunteer.day?.date !== today) {
    return { 
      success: false, 
      error: 'Ce QR code n\'est pas valide pour aujourd\'hui', 
      code: 'WRONG_DAY',
      volunteer,
      expectedDate: volunteer.day?.date,
    };
  }

  // Validate the volunteer
  const now = new Date().toISOString();
  
  const { error: updateError } = await client
    .from('volunteers')
    .update({
      qr_status: 'validated',
      status: 'present',
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

  return { 
    success: true, 
    volunteer: { ...volunteer, qrStatus: 'validated', status: 'present', scannedAt: new Date(now) },
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
      status: 'present',
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
  if (!client) return [];

  let query = client.from('goodies').select('*, goodie_variants(*)');
  
  if (activeOnly) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query.order('sort_order', { ascending: true });
  if (error) throw error;

  return data?.map(g => ({
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
  const totalAmount = data.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

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

  return data?.map(o => ({
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

  if (error) throw error;

  return {
    donationId: donation.id,
    donationReference: donation.donation_reference,
    amount: parseFloat(donation.amount),
    status: donation.status,
    createdAt: new Date(donation.created_at),
  };
}

export async function getAllDonationsSupabase() {
  const client = getSupabaseAdminClient();
  if (!client) return [];

  const { data, error } = await client
    .from('donations')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;

  return data?.map(d => ({
    id: d.id,
    donationReference: d.donation_reference,
    donorName: d.donor_name,
    donorEmail: d.donor_email,
    donorPhone: d.donor_phone,
    amount: parseFloat(d.amount),
    paymentMethod: d.payment_method,
    status: d.status,
    message: d.message,
    isAnonymous: d.is_anonymous,
    acceptsUpdates: d.accepts_updates,
    createdAt: new Date(d.created_at),
  })) || [];
}

export async function markDonationReceivedSupabase(donationId: number, processedBy?: number) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('Supabase not configured');

  const { error } = await client
    .from('donations')
    .update({ status: 'received', processed_by: processedBy })
    .eq('id', donationId);

  if (error) throw error;
}

export async function updateDonationStatusSupabase(donationId: number, status: string, processedBy?: number) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('Supabase not configured');

  const { error } = await client
    .from('donations')
    .update({ status, processed_by: processedBy })
    .eq('id', donationId);

  if (error) throw error;
}

export async function getDonationStatsSupabase() {
  const client = getSupabaseAdminClient();
  if (!client) return { total: 0, promised: 0, received: 0, totalAmount: 0, receivedAmount: 0 };

  const { data, error } = await client
    .from('donations')
    .select('status, amount');

  if (error) throw error;

  const total = data?.length || 0;
  const promised = data?.filter(d => d.status === 'promised').length || 0;
  const received = data?.filter(d => d.status === 'received').length || 0;
  const totalAmount = data?.reduce((sum, d) => sum + parseFloat(d.amount), 0) || 0;
  const receivedAmount = data?.filter(d => d.status === 'received').reduce((sum, d) => sum + parseFloat(d.amount), 0) || 0;

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
