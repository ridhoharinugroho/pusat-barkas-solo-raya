/**
 * Serverless User Registry & Cloud Sync API Endpoint for Pusat Jual Beli Solo Raya
 * Handles GET (fetch registered users) & POST (update registered users)
 */

let registeredUsersCache = [
  {
    id: "user-102",
    name: "Joko Supriyanto",
    storeName: "Toko Pak Joko",
    email: "joko.kra@gmail.com",
    phone: "085725012345",
    region: "karanganyar",
    district: "Jaten",
    avatar: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&q=80",
    bio: "Pusat perabot rumah tangga & elektronik seken berkualitas Karanganyar.",
    status: "active",
    deletedAt: null,
    createdAt: "2026-07-05T09:30:00.000Z",
    isDemo: true
  },
  {
    id: "user-103",
    name: "Rian Kurniawan",
    storeName: "Rian Gadget Kartasura",
    email: "rian.gadget@gmail.com",
    phone: "089678123456",
    region: "sukoharjo",
    district: "Kartasura",
    avatar: "https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=150&q=80",
    bio: "Thrift & gadget bekas garansi personal area UMS Kartasura & Solo Baru.",
    status: "active",
    deletedAt: null,
    createdAt: "2026-07-10T11:15:00.000Z",
    isDemo: true
  },
  {
    id: "user-104",
    name: "Siti Aisyah",
    storeName: "Aisyah's Crafts Solo",
    email: "aisyah.crafts@example.com",
    phone: "081234567890",
    region: "solo",
    district: "Mojosongo",
    avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&q=80",
    bio: "Handmade crafts, artwork, dan souvenir khas Solo. Fast WA response.",
    status: "active",
    deletedAt: null,
    createdAt: "2026-08-25T09:00:00.000Z",
    isDemo: true
  }
];

export default async function handler(req, res) {
  // CORS Configuration
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json(registeredUsersCache);
  }

  if (req.method === 'POST') {
    try {
      let body = req.body;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch (e) {}
      }

      if (Array.isArray(body) && body.length > 0) {
        // Merge incoming users into cache without duplicates
        body.forEach((newUser) => {
          if (!newUser || (!newUser.id && !newUser.email)) return;
          const idx = registeredUsersCache.findIndex(
            (u) => u.id === newUser.id || (u.email && newUser.email && u.email.toLowerCase() === newUser.email.toLowerCase())
          );
          if (idx === -1) {
            registeredUsersCache.push(newUser);
          } else {
            registeredUsersCache[idx] = { ...registeredUsersCache[idx], ...newUser };
          }
        });
      }

      return res.status(200).json({
        success: true,
        count: registeredUsersCache.length,
        users: registeredUsersCache
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  return res.status(405).json({ success: false, error: 'Method Not Allowed' });
}
