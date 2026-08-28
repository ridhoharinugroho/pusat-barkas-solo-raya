import supabase from '../../js/lib/supabase.js';
import listingsDemo from '../../db/listings.json' assert { type: 'json' };

/**
 * Insert demo users & listings if tables are empty.
 * Runs once on app start.
 */
export async function initializeDatabase() {
  if (!supabase) {
    console.warn('[InitSync] Supabase client not available.');
    return;
  }

  // ----- USERS -------------------------------------------------
  const { data: users, error: usersErr } = await supabase.from('users').select('id', { count: 'exact' });
  if (usersErr) {
    console.error('[InitSync] users count error:', usersErr.message);
    return;
  }

  if (users?.length === 0) {
    const demoUsers = [
      {
        id: 'user-102',
        name: 'Joko Supriyanto',
        store_name: 'Toko Pak Joko',
        phone: '085725012345',
        email: 'joko.kra@gmail.com',
        avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&q=80',
        region: 'karanganyar',
        district: 'Jaten',
      },
      {
        id: 'user-103',
        name: 'Rian Kurniawan',
        store_name: 'Rian Gadget Kartasura',
        phone: '089678123456',
        email: 'rian.gadget@gmail.com',
        avatar: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=150&q=80',
        region: 'sukoharjo',
        district: 'Kartasura',
      },
      {
        id: 'user-104',
        name: 'Siti Aisyah',
        store_name: "Aisyah's Crafts Solo",
        phone: '081234567890',
        email: 'aisyah.crafts@example.com',
        avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&q=80',
        region: 'solo',
        district: 'Mojosongo',
      },
    ];

    const { error: insertUsers } = await supabase.from('users').insert(demoUsers);
    if (insertUsers) console.error('[InitSync] insert users error:', insertUsers.message);
    else console.log('[InitSync] demo users inserted.');
  }

  // ----- LISTINGS -----------------------------------------------
  const { data: listings, error: listingsErr } = await supabase.from('listings').select('id', { count: 'exact' });
  if (listingsErr) {
    console.error('[InitSync] listings count error:', listingsErr.message);
    return;
  }

  if (listings?.length === 0) {
    const { error: insertListings } = await supabase.from('listings').insert(listingsDemo);
    if (insertListings) console.error('[InitSync] insert listings error:', insertListings.message);
    else console.log('[InitSync] demo listings inserted.');
  }
}
