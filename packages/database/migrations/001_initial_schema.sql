-- ===================================================
-- IPL Dhaba — Complete PostgreSQL Schema Migration (001)
-- Multi-domain tables with RLS, triggers, indexes
-- ===================================================

-- Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS & PROFILES
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cognito_id VARCHAR(255) UNIQUE,
    phone VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    name VARCHAR(255) NOT NULL,
    favorite_team VARCHAR(100) DEFAULT 'Royal Challengers Bengaluru',
    wallet_balance NUMERIC(10, 2) NOT NULL DEFAULT 1450.00 CHECK (wallet_balance >= 0),
    fan_points INT NOT NULL DEFAULT 920 CHECK (fan_points >= 0),
    avatar_url TEXT,
    role VARCHAR(50) NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'driver', 'partner', 'admin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. TURFS & SLOTS
CREATE TABLE IF NOT EXISTS turfs (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    location TEXT NOT NULL,
    area VARCHAR(100) NOT NULL,
    distance VARCHAR(50),
    rating NUMERIC(3, 2) DEFAULT 4.9,
    reviews_count INT DEFAULT 0,
    price_per_hour NUMERIC(10, 2) NOT NULL,
    image_url TEXT NOT NULL,
    gallery TEXT[] DEFAULT '{}',
    amenities TEXT[] DEFAULT '{}',
    pitch_type VARCHAR(100) NOT NULL,
    address TEXT NOT NULL,
    lat NUMERIC(10, 8),
    lng NUMERIC(11, 8),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS turf_slots (
    id VARCHAR(100) PRIMARY KEY,
    turf_id VARCHAR(100) REFERENCES turfs(id) ON DELETE CASCADE,
    slot_time VARCHAR(100) NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    category VARCHAR(50) NOT NULL,
    is_floodlit BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. TURF BOOKINGS
CREATE TABLE IF NOT EXISTS turf_bookings (
    id VARCHAR(100) PRIMARY KEY DEFAULT ('tb_' || floor(random() * 900000 + 100000)::text),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    turf_id VARCHAR(100) REFERENCES turfs(id),
    turf_name VARCHAR(255) NOT NULL,
    turf_address TEXT NOT NULL,
    booking_date DATE NOT NULL,
    slots JSONB NOT NULL,
    total_amount NUMERIC(10, 2) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'completed', 'cancelled', 'rescheduled')),
    qr_code TEXT NOT NULL,
    addons JSONB DEFAULT '[]'::jsonb,
    match_format VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. FOOD MENU & CATEGORIES
CREATE TABLE IF NOT EXISTS food_categories (
    id VARCHAR(50) PRIMARY KEY,
    name_en VARCHAR(255) NOT NULL,
    name_hi VARCHAR(255) NOT NULL,
    icon VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS menu_items (
    id VARCHAR(100) PRIMARY KEY,
    category_id VARCHAR(50) REFERENCES food_categories(id),
    name_en VARCHAR(255) NOT NULL,
    name_hi VARCHAR(255) NOT NULL,
    description_en TEXT,
    description_hi TEXT,
    price NUMERIC(10, 2) NOT NULL,
    image_url TEXT NOT NULL,
    is_veg BOOLEAN NOT NULL DEFAULT TRUE,
    is_bestseller BOOLEAN DEFAULT FALSE,
    is_available BOOLEAN DEFAULT TRUE,
    rating NUMERIC(3, 2) DEFAULT 4.8,
    prep_time_minutes INT DEFAULT 15,
    calories INT,
    spiciness VARCHAR(20) CHECK (spiciness IN ('mild', 'medium', 'spicy', 'fiery')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. FOOD ORDERS & ITEMS
CREATE TABLE IF NOT EXISTS food_orders (
    id VARCHAR(100) PRIMARY KEY DEFAULT ('ord_' || floor(random() * 900000 + 100000)::text),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    driver_id UUID REFERENCES users(id) ON DELETE SET NULL,
    delivery_type VARCHAR(50) NOT NULL CHECK (delivery_type IN ('turf_slot', 'home_delivery')),
    delivery_target TEXT NOT NULL,
    subtotal NUMERIC(10, 2) NOT NULL,
    gst_amount NUMERIC(10, 2) NOT NULL,
    delivery_fee NUMERIC(10, 2) NOT NULL DEFAULT 30.00,
    discount_amount NUMERIC(10, 2) DEFAULT 0.00,
    total_amount NUMERIC(10, 2) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'placed' CHECK (status IN ('placed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled')),
    cooking_instructions TEXT,
    payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('wallet', 'upi', 'card')),
    estimated_delivery_minutes INT DEFAULT 25,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id VARCHAR(100) REFERENCES food_orders(id) ON DELETE CASCADE,
    menu_item_id VARCHAR(100) REFERENCES menu_items(id),
    item_name VARCHAR(255) NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(10, 2) NOT NULL,
    customization TEXT
);

-- 6. CELEBRATIONS
CREATE TABLE IF NOT EXISTS celebration_packages (
    id VARCHAR(100) PRIMARY KEY,
    title_en VARCHAR(255) NOT NULL,
    title_hi VARCHAR(255) NOT NULL,
    subtitle_en TEXT,
    subtitle_hi TEXT,
    base_price NUMERIC(10, 2) NOT NULL,
    image_url TEXT NOT NULL,
    inclusions_en TEXT[] DEFAULT '{}',
    inclusions_hi TEXT[] DEFAULT '{}',
    recommended_for VARCHAR(255),
    rating NUMERIC(3, 2) DEFAULT 4.9
);

CREATE TABLE IF NOT EXISTS celebration_bookings (
    id VARCHAR(100) PRIMARY KEY DEFAULT ('cb_' || floor(random() * 900000 + 100000)::text),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    package_id VARCHAR(100) REFERENCES celebration_packages(id),
    package_name VARCHAR(255) NOT NULL,
    turf_name VARCHAR(255) NOT NULL,
    event_date DATE NOT NULL,
    time_slot VARCHAR(100) NOT NULL,
    guest_count INT NOT NULL CHECK (guest_count >= 1),
    customizations JSONB NOT NULL DEFAULT '{}'::jsonb,
    total_amount NUMERIC(10, 2) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'in_preparation', 'completed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. WALLET TRANSACTIONS
CREATE TABLE IF NOT EXISTS wallet_transactions (
    id VARCHAR(100) PRIMARY KEY DEFAULT ('txn_' || floor(random() * 900000 + 100000)::text),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('credit', 'debit')),
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    title VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('topup', 'booking', 'food', 'celebration', 'reward_cashback', 'refund')),
    reference_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. REVIEWS & RATINGS
CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    target_type VARCHAR(50) NOT NULL CHECK (target_type IN ('food_order', 'turf_booking', 'celebration')),
    target_id VARCHAR(100) NOT NULL,
    rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('booking', 'food', 'wallet', 'reward', 'system', 'driver')),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_food_orders_user ON food_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_food_orders_status ON food_orders(status);
CREATE INDEX IF NOT EXISTS idx_turf_bookings_user ON turf_bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_txns_user ON wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category_id);

-- 11. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE turf_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE celebration_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 12. AUTOMATIC UPDATED_AT TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_food_orders_updated_at
BEFORE UPDATE ON food_orders
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
