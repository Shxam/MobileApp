-- ===================================================
-- IPL Dhaba — Database Seed Script (001)
-- Seed data extracted from mockData.ts
-- ===================================================

-- Seed Categories
INSERT INTO food_categories (id, name_en, name_hi, icon) VALUES
('all', 'All Menu (70+ Items)', 'सभी व्यंजन (70+)', 'Utensils'),
('combos', 'Matchday Combos', 'मैचडे कॉम्बो', 'Flame'),
('biryani', 'Biryani & Rice', 'बिरयानी और चावल', 'Soup'),
('starters', 'Tandoori Starters', 'तंदूरी स्टार्टर्स', 'Drumstick'),
('curries', 'Dhaba Curries', 'ढाबा करी', 'UtensilsCrossed'),
('rolls', 'Rotis & Rolls', 'रोटी और रोल', 'Sandwich'),
('drinks', 'Lassi & Drinks', 'लस्सी और पेय', 'Coffee'),
('snacks', 'Chaat & Pitch Bites', 'चाट और स्नैक्स', 'Pizza')
ON CONFLICT (id) DO NOTHING;

-- Seed Turfs
INSERT INTO turfs (id, name, location, area, distance, rating, reviews_count, price_per_hour, image_url, gallery, amenities, pitch_type, address, lat, lng, description) VALUES
('turf_singarayakonda', 'IPL Dhaba Box Turf - Singarayakonda', 'NH-16, Singarayakonda, Prakasam Dist', 'Singarayakonda', '0.5 km', 4.9, 512, 1200.00, 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&q=80&w=800', 
ARRAY['https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&q=80&w=800', 'https://images.unsplash.com/photo-1512719991214-e02f5a60a7ff?auto=format&fit=crop&q=80&w=800'],
ARRAY['Floodlights 500 Lux', 'Dhaba Dining Deck', 'Live Scoring Screen', 'Dressing Room AC', 'Free Parking'],
'Floodlit Pro Cage', 'NH-16 Bypass Road, Next to IPL Dhaba Kitchen, Singarayakonda, Andhra Pradesh', 15.25, 80.03, 'Singarayakonda’s premier floodlit box-cricket turf attached to the authentic IPL Dhaba kitchen.')
ON CONFLICT (id) DO NOTHING;

-- Seed Sample Menu Items
INSERT INTO menu_items (id, category_id, name_en, name_hi, description_en, description_hi, price, image_url, is_veg, is_bestseller, rating, prep_time_minutes, calories, spiciness) VALUES
('b1', 'biryani', 'Dhaba Special Dum Biryani', 'ढाबा स्पेशल दम बिरयानी', 'Authentic slow-cooked hyderabadi style biryani with fragrant basmati rice.', 'सुगंधित बासमती चावल के साथ प्रामाणिक धीमी गति से पकाई गई हैदराबादी बिरयानी।', 280.00, 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&q=80&w=400', false, true, 4.9, 20, 650, 'medium'),
('c1', 'combos', 'IPL Powerplay Bucket Combo', 'आईपीएल पावरप्ले बकेट कॉम्बो', '4 Parathas + Butter Chicken + 2 Chhole Bhature + 4 Chilled Lassis + Extra Maska Butter.', '4 पराठे + बटर चिकन + 2 छोले भटूरे + 4 ठंडी लस्सी।', 899.00, 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&q=80&w=400', false, true, 4.95, 25, 1400, 'spicy'),
('s1', 'starters', 'Tandoori Paneer Tikka', 'तंदूरी पनीर टिक्का', 'Charcoal-grilled cottage cheese cubes marinated in spiced yogurt and mint sauce.', 'मसालेदार दही और पुदीने की चटनी में मैरीनेट किए गए तंदूरी पनीर।', 240.00, 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?auto=format&fit=crop&q=80&w=400', true, false, 4.7, 15, 420, 'mild')
ON CONFLICT (id) DO NOTHING;

-- Seed Celebration Packages
INSERT INTO celebration_packages (id, title_en, title_hi, subtitle_en, subtitle_hi, base_price, image_url, inclusions_en, inclusions_hi, recommended_for, rating) VALUES
('p1', 'Super Birthday League (SBL)', 'सुपर बर्थडे लीग', 'Light up the pitch for your birthday match with stadium lights and live commentary', 'अपने जन्मदिन के मैच के लिए स्टेडियम की लाइटों और लाइव कमेंट्री के साथ मैदान को रोशन करें', 4999.00, 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&q=80&w=800',
ARRAY['2 Hours Floodlit Turf Booking', 'Live Match DJ & Sound System', 'Dhaba Starter Platter for 15', 'Trophy & Player of the Match Medal'],
ARRAY['2 घंटे फ्लडलाइट टर्फ बुकिंग', 'लाइव मैच डीजे और साउंड सिस्टम', '15 लोगों के लिए ढाबा स्टार्टर थाली', 'ट्रॉफी और प्लेयर ऑफ द मैच मेडल'], 'Birthdays & Private T10 Matches', 4.95)
ON CONFLICT (id) DO NOTHING;
