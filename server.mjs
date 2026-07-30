import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// Mock DB Storage
const DB = {
  turfs: [
    {
      id: 'turf_1',
      name: 'IPL Dhaba Box Turf - Singarayakonda',
      location: 'Singarayakonda, Prakasam Dist',
      area: 'Singarayakonda',
      distance: '0.8 km',
      rating: 4.9,
      reviewsCount: 142,
      pricePerHour: 1200,
      image: '/logo.png',
      pitchType: 'Floodlit Pro Cage',
      address: 'Main Road, Near Highway Pavilion, Singarayakonda, Andhra Pradesh',
    },
  ],
  orders: [],
  bookings: [],
};

// REST API Endpoints
app.get('/api/health', (req, res) => {
  res.json({ status: 'UP', service: 'IPL Dhaba Core API', timestamp: new Date().toISOString() });
});

app.get('/api/turfs', (req, res) => {
  const query = (req.query.q || '').toString().toLowerCase();
  const results = DB.turfs.filter(
    (t) => t.name.toLowerCase().includes(query) || t.location.toLowerCase().includes(query)
  );
  res.json(results);
});

app.post('/api/orders', (req, res) => {
  const order = {
    id: `ord_${Math.floor(1000 + Math.random() * 9000)}`,
    ...req.body,
    status: 'placed',
    createdAt: new Date().toISOString(),
  };
  DB.orders.push(order);
  res.status(201).json({ success: true, id: order.id, order });
});

app.post('/api/bookings', (req, res) => {
  const booking = {
    id: `tb_${Math.floor(1000 + Math.random() * 9000)}`,
    ...req.body,
    status: 'confirmed',
    createdAt: new Date().toISOString(),
  };
  DB.bookings.push(booking);
  res.status(201).json({ success: true, id: booking.id, booking });
});

// Serve Static production build if exists
app.use(express.static(path.join(__dirname, 'dist')));

app.listen(PORT, () => {
  console.log(`🚀 IPL Dhaba Express REST Backend API running on http://localhost:${PORT}`);
});
