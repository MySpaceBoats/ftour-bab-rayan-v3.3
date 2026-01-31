import { getSupabaseAdminClient } from './supabase';
import { nanoid } from 'nanoid';

// ============================================
// RESTAURANT SERVICES
// ============================================

export interface RestaurantData {
  name: string;
  address: string;
  phone?: string;
  description?: string;
  capacity?: number;
  active?: boolean;
}

export async function createRestaurantSupabase(data: RestaurantData) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('Supabase not configured');

  const { data: restaurant, error } = await client
    .from('restaurants')
    .insert({
      name: data.name,
      address: data.address,
      phone: data.phone,
      description: data.description,
      capacity: data.capacity || 100,
      active: data.active ?? true,
    })
    .select()
    .single();

  if (error) throw error;
  return mapRestaurant(restaurant);
}

export async function getAllRestaurantsSupabase(activeOnly = false) {
  const client = getSupabaseAdminClient();
  if (!client) return [];

  let query = client.from('restaurants').select('*').order('name', { ascending: true });
  
  if (activeOnly) {
    query = query.eq('active', true);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data?.map(mapRestaurant) || [];
}

export async function getRestaurantByIdSupabase(id: number) {
  const client = getSupabaseAdminClient();
  if (!client) return null;

  const { data, error } = await client
    .from('restaurants')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return null;
  return mapRestaurant(data);
}

export async function updateRestaurantSupabase(id: number, updates: Partial<RestaurantData>) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('Supabase not configured');

  const { error } = await client
    .from('restaurants')
    .update({
      name: updates.name,
      address: updates.address,
      phone: updates.phone,
      description: updates.description,
      capacity: updates.capacity,
      active: updates.active,
    })
    .eq('id', id);

  if (error) throw error;
}

export async function deleteRestaurantSupabase(id: number) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('Supabase not configured');

  const { error } = await client
    .from('restaurants')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

function mapRestaurant(r: any) {
  return {
    id: r.id,
    name: r.name,
    address: r.address,
    phone: r.phone,
    description: r.description,
    capacity: r.capacity,
    active: r.active,
    createdAt: new Date(r.created_at),
  };
}

// ============================================
// RESTAURANT SLOTS SERVICES
// ============================================

export interface RestaurantSlotData {
  restaurantId: number;
  date: string;
  startTime?: string;
  endTime?: string;
  capacity: number;
}

export async function createRestaurantSlotSupabase(data: RestaurantSlotData) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('Supabase not configured');

  const { data: slot, error } = await client
    .from('restaurant_slots')
    .insert({
      restaurant_id: data.restaurantId,
      date: data.date,
      start_time: data.startTime,
      end_time: data.endTime,
      capacity: data.capacity,
    })
    .select()
    .single();

  if (error) throw error;
  return mapSlot(slot);
}

export async function getSlotsByRestaurantAndDateSupabase(restaurantId: number, date: string) {
  const client = getSupabaseAdminClient();
  if (!client) return [];

  const { data, error } = await client
    .from('restaurant_slots')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('date', date)
    .order('start_time', { ascending: true });

  if (error) throw error;
  return data?.map(mapSlot) || [];
}

export async function getSlotByIdSupabase(id: number) {
  const client = getSupabaseAdminClient();
  if (!client) return null;

  const { data, error } = await client
    .from('restaurant_slots')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return null;
  return mapSlot(data);
}

export async function updateSlotSupabase(id: number, updates: Partial<RestaurantSlotData>) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('Supabase not configured');

  const updateData: Record<string, unknown> = {};
  if (updates.date !== undefined) updateData.date = updates.date;
  if (updates.startTime !== undefined) updateData.start_time = updates.startTime;
  if (updates.endTime !== undefined) updateData.end_time = updates.endTime;
  if (updates.capacity !== undefined) updateData.capacity = updates.capacity;

  const { error } = await client
    .from('restaurant_slots')
    .update(updateData)
    .eq('id', id);

  if (error) throw error;
}

export async function deleteSlotSupabase(id: number) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('Supabase not configured');

  const { error } = await client
    .from('restaurant_slots')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

function mapSlot(s: any) {
  return {
    id: s.id,
    restaurantId: s.restaurant_id,
    date: s.date,
    startTime: s.start_time,
    endTime: s.end_time,
    capacity: s.capacity,
    createdAt: new Date(s.created_at),
  };
}

// ============================================
// RESERVATION SERVICES
// ============================================

export type ReservationStatus = 'pending' | 'confirmed' | 'cancelled' | 'no_show' | 'checked_in';

export interface ReservationData {
  restaurantId: number;
  date: string;
  slotId?: number;
  fullName: string;
  phone: string;
  email?: string;
  seats: number;
  notes?: string;
  status?: ReservationStatus;
}

function generateReferenceCode(): string {
  // Format: RES-XXXXXXXX (8 caractères alphanumériques)
  return `RES-${nanoid(8).toUpperCase()}`;
}

function generateQrToken(): string {
  return nanoid(32);
}

export async function createReservationSupabase(data: ReservationData) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('Supabase not configured');

  // Check capacity before creating
  const availabilityResult = await getAvailableSeatsSupabase(data.restaurantId, data.date, data.slotId);
  if (availabilityResult.available < data.seats) {
    throw new Error(`Capacité insuffisante. Places disponibles: ${availabilityResult.available}`);
  }

  const referenceCode = generateReferenceCode();
  const qrToken = generateQrToken();

  const { data: reservation, error } = await client
    .from('reservations')
    .insert({
      restaurant_id: data.restaurantId,
      date: data.date,
      slot_id: data.slotId || null,
      full_name: data.fullName,
      phone: data.phone,
      email: data.email || null,
      seats: data.seats,
      notes: data.notes || null,
      status: data.status || 'confirmed',
      reference_code: referenceCode,
      qr_token: qrToken,
    })
    .select('*, restaurants(*)')
    .single();

  if (error) throw error;
  return mapReservation(reservation);
}

export async function getReservationByIdSupabase(id: number) {
  const client = getSupabaseAdminClient();
  if (!client) return null;

  const { data, error } = await client
    .from('reservations')
    .select('*, restaurants(*), restaurant_slots(*)')
    .eq('id', id)
    .single();

  if (error || !data) return null;
  return mapReservation(data);
}

export async function getReservationByReferenceSupabase(referenceCode: string) {
  const client = getSupabaseAdminClient();
  if (!client) return null;

  const { data, error } = await client
    .from('reservations')
    .select('*, restaurants(*), restaurant_slots(*)')
    .eq('reference_code', referenceCode)
    .single();

  if (error || !data) return null;
  return mapReservation(data);
}

export async function getReservationByQrTokenSupabase(qrToken: string) {
  const client = getSupabaseAdminClient();
  if (!client) return null;

  const { data, error } = await client
    .from('reservations')
    .select('*, restaurants(*), restaurant_slots(*)')
    .eq('qr_token', qrToken)
    .single();

  if (error || !data) return null;
  return mapReservation(data);
}

export interface ReservationFilters {
  restaurantId?: number;
  date?: string;
  status?: ReservationStatus;
  slotId?: number;
}

export async function getAllReservationsSupabase(filters?: ReservationFilters) {
  const client = getSupabaseAdminClient();
  if (!client) return [];

  let query = client
    .from('reservations')
    .select('*, restaurants(*), restaurant_slots(*)')
    .order('created_at', { ascending: false });

  if (filters?.restaurantId) {
    query = query.eq('restaurant_id', filters.restaurantId);
  }
  if (filters?.date) {
    query = query.eq('date', filters.date);
  }
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.slotId) {
    query = query.eq('slot_id', filters.slotId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data?.map(mapReservation) || [];
}

export async function updateReservationStatusSupabase(
  id: number, 
  status: ReservationStatus,
  updatedBy?: string
) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('Supabase not configured');

  const { error } = await client
    .from('reservations')
    .update({ 
      status,
      updated_by: updatedBy,
    })
    .eq('id', id);

  if (error) throw error;
}

export async function cancelReservationSupabase(id: number, updatedBy?: string) {
  return updateReservationStatusSupabase(id, 'cancelled', updatedBy);
}

export interface AvailableSeatsResult {
  available: number;
  total: number;
  reserved: number;
}

export async function getAvailableSeatsSupabase(
  restaurantId: number, 
  date: string, 
  slotId?: number
): Promise<AvailableSeatsResult> {
  const client = getSupabaseAdminClient();
  if (!client) return { available: 0, total: 0, reserved: 0 };

  // Get restaurant capacity
  const { data: restaurant } = await client
    .from('restaurants')
    .select('capacity')
    .eq('id', restaurantId)
    .single();

  if (!restaurant) return { available: 0, total: 0, reserved: 0 };

  let capacity = restaurant.capacity;

  // If slot specified, use slot capacity instead
  if (slotId) {
    const { data: slot } = await client
      .from('restaurant_slots')
      .select('capacity')
      .eq('id', slotId)
      .single();
    
    if (slot) {
      capacity = slot.capacity;
    }
  }

  // Count reserved seats (excluding cancelled and no_show)
  let query = client
    .from('reservations')
    .select('seats')
    .eq('restaurant_id', restaurantId)
    .eq('date', date)
    .in('status', ['pending', 'confirmed', 'checked_in']);

  if (slotId) {
    query = query.eq('slot_id', slotId);
  }

  const { data: reservations } = await query;
  
  const reservedSeats = reservations?.reduce((sum, r) => sum + r.seats, 0) || 0;
  const availableSeats = Math.max(0, capacity - reservedSeats);
  
  return {
    available: availableSeats,
    total: capacity,
    reserved: reservedSeats,
  };
}

export async function getCapacityStatsSupabase(restaurantId: number, date: string) {
  const client = getSupabaseAdminClient();
  if (!client) return null;

  // Get restaurant
  const { data: restaurant } = await client
    .from('restaurants')
    .select('*')
    .eq('id', restaurantId)
    .single();

  if (!restaurant) return null;

  // Get slots for this date
  const { data: slots } = await client
    .from('restaurant_slots')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('date', date);

  // Get reservations for this date
  const { data: reservations } = await client
    .from('reservations')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('date', date)
    .in('status', ['pending', 'confirmed', 'checked_in']);

  const totalReserved = reservations?.reduce((sum, r) => sum + r.seats, 0) || 0;
  const totalCapacity = restaurant.capacity;

  return {
    restaurant: mapRestaurant(restaurant),
    date,
    totalCapacity,
    totalReserved,
    availableSeats: Math.max(0, totalCapacity - totalReserved),
    slots: slots?.map(s => {
      const slotReservations = reservations?.filter(r => r.slot_id === s.id) || [];
      const slotReserved = slotReservations.reduce((sum, r) => sum + r.seats, 0);
      return {
        ...mapSlot(s),
        reserved: slotReserved,
        available: Math.max(0, s.capacity - slotReserved),
      };
    }) || [],
    reservationsByStatus: {
      pending: reservations?.filter(r => r.status === 'pending').length || 0,
      confirmed: reservations?.filter(r => r.status === 'confirmed').length || 0,
      checkedIn: reservations?.filter(r => r.status === 'checked_in').length || 0,
    },
  };
}

function mapReservation(r: any) {
  return {
    id: r.id,
    restaurantId: r.restaurant_id,
    date: r.date,
    slotId: r.slot_id,
    fullName: r.full_name,
    phone: r.phone,
    email: r.email,
    seats: r.seats,
    notes: r.notes,
    status: r.status as ReservationStatus,
    referenceCode: r.reference_code,
    qrToken: r.qr_token,
    updatedBy: r.updated_by,
    createdAt: new Date(r.created_at),
    updatedAt: r.updated_at ? new Date(r.updated_at) : null,
    restaurant: r.restaurants ? mapRestaurant(r.restaurants) : null,
    slot: r.restaurant_slots ? mapSlot(r.restaurant_slots) : null,
  };
}

// ============================================
// CHECK-IN SERVICES
// ============================================

export interface CheckinData {
  reservationId: number;
  validationMode: 'scan' | 'manual';
  validatedBy: string;
}

export async function createCheckinSupabase(data: CheckinData) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('Supabase not configured');

  // Get reservation
  const reservation = await getReservationByIdSupabase(data.reservationId);
  if (!reservation) {
    throw new Error('Réservation non trouvée');
  }

  // Check if already checked in
  if (reservation.status === 'checked_in') {
    throw new Error('Cette réservation a déjà été validée');
  }

  // Check if cancelled
  if (reservation.status === 'cancelled') {
    throw new Error('Cette réservation a été annulée');
  }

  // Check date
  const today = new Date().toISOString().split('T')[0];
  if (reservation.date !== today) {
    throw new Error(`Cette réservation est pour le ${reservation.date}, pas pour aujourd'hui`);
  }

  // Create checkin record
  const { data: checkin, error: checkinError } = await client
    .from('reservation_checkins')
    .insert({
      reservation_id: data.reservationId,
      validation_mode: data.validationMode,
      validated_by: data.validatedBy,
    })
    .select()
    .single();

  if (checkinError) throw checkinError;

  // Update reservation status
  await updateReservationStatusSupabase(data.reservationId, 'checked_in', data.validatedBy);

  return {
    id: checkin.id,
    reservationId: checkin.reservation_id,
    scannedAt: new Date(checkin.scanned_at),
    validationMode: checkin.validation_mode,
    validatedBy: checkin.validated_by,
    reservation,
  };
}

export async function getCheckinsByReservationSupabase(reservationId: number) {
  const client = getSupabaseAdminClient();
  if (!client) return [];

  const { data, error } = await client
    .from('reservation_checkins')
    .select('*')
    .eq('reservation_id', reservationId)
    .order('scanned_at', { ascending: false });

  if (error) throw error;
  return data?.map(c => ({
    id: c.id,
    reservationId: c.reservation_id,
    scannedAt: new Date(c.scanned_at),
    validationMode: c.validation_mode,
    validatedBy: c.validated_by,
    createdAt: new Date(c.created_at),
  })) || [];
}

// ============================================
// EXPORT SERVICES
// ============================================

export async function exportReservationsCSVSupabase(filters?: ReservationFilters) {
  const reservations = await getAllReservationsSupabase(filters);
  
  const headers = [
    'Référence',
    'Date',
    'Restaurant',
    'Nom complet',
    'Téléphone',
    'Email',
    'Places',
    'Statut',
    'Notes',
    'Créé le',
  ];

  const rows = reservations.map(r => [
    r.referenceCode,
    r.date,
    r.restaurant?.name || '',
    r.fullName,
    r.phone,
    r.email || '',
    r.seats.toString(),
    r.status,
    r.notes || '',
    r.createdAt.toISOString(),
  ]);

  return [headers, ...rows].map(row => row.join(',')).join('\n');
}


// ============================================
// STATS SERVICES
// ============================================

export interface StatsFilters {
  restaurantId?: number;
  date?: string;
}

export async function getReservationStatsSupabase(filters?: StatsFilters) {
  const client = getSupabaseAdminClient();
  if (!client) return { total: 0, pending: 0, confirmed: 0, cancelled: 0, noShow: 0, checkedIn: 0, totalSeats: 0 };

  let query = client
    .from('reservations')
    .select('status, seats');

  if (filters?.restaurantId) {
    query = query.eq('restaurant_id', filters.restaurantId);
  }
  if (filters?.date) {
    query = query.eq('date', filters.date);
  }

  const { data, error } = await query;
  if (error) throw error;

  const reservations = data || [];
  
  return {
    total: reservations.length,
    pending: reservations.filter(r => r.status === 'pending').length,
    confirmed: reservations.filter(r => r.status === 'confirmed').length,
    cancelled: reservations.filter(r => r.status === 'cancelled').length,
    noShow: reservations.filter(r => r.status === 'no_show').length,
    checkedIn: reservations.filter(r => r.status === 'checked_in').length,
    totalSeats: reservations
      .filter(r => ['pending', 'confirmed', 'checked_in'].includes(r.status))
      .reduce((sum, r) => sum + r.seats, 0),
  };
}
