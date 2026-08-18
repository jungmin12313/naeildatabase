-- 1. Create `zones` table
CREATE TABLE IF NOT EXISTS public.zones (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    level TEXT NOT NULL,
    polygon JSONB,
    final_index NUMERIC,
    color_grade TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create `sub_zones` table
CREATE TABLE IF NOT EXISTS public.sub_zones (
    id TEXT PRIMARY KEY,
    zone_id TEXT REFERENCES public.zones(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    final_index NUMERIC,
    polygon JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create `facilities` table
CREATE TABLE IF NOT EXISTS public.facilities (
    id TEXT PRIMARY KEY,
    zone_id TEXT REFERENCES public.zones(id) ON DELETE CASCADE,
    sub_zone_id TEXT REFERENCES public.sub_zones(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT,
    facility_type TEXT,
    location JSONB, -- { "lat": 35.123, "lng": 126.123 }
    last_survey_date TEXT,
    status TEXT,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Create `category_scores` table
CREATE TABLE IF NOT EXISTS public.category_scores (
    id TEXT PRIMARY KEY,
    facility_id TEXT REFERENCES public.facilities(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    score NUMERIC,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sub_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_scores ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS Policies (Allow all reads for Anon, Allow all for authenticated / service role)
-- For this prototype, we'll allow public reads, and let the Service Role Key handle inserts.
CREATE POLICY "Enable read access for all users" ON public.zones FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON public.sub_zones FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON public.facilities FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON public.category_scores FOR SELECT USING (true);

-- (Inserts will be done via the API Route using SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS)
