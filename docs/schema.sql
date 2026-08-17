-- Enable PostGIS extension
create extension if not exists postgis;

-- 1. zones table
create type zone_level as enum ('대구역', '중구역', '소구역');

create table zones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  level zone_level not null,
  parent_zone_id uuid references zones(id),
  polygon geometry(Polygon, 4326),
  final_index numeric,
  color_grade text
);

-- 2. facilities table
create type facility_status as enum ('공개', '비공개', '폐업');

create table facilities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  zone_id uuid references zones(id),
  address text,
  location geometry(Point, 4326),
  facility_type text,
  last_survey_date date,
  status facility_status default '공개'
);

-- 3. measurements table
create type measurement_category as enum ('S1_보행로', 'S2_출입구', 'S3_화장실', 'S4_엘리베이터', 'S5_주차장');

create table measurements (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid references facilities(id),
  category measurement_category not null,
  field_name text not null,
  value numeric,
  unit text,
  photo_url text,
  survey_date date
);

-- 4. category_scores table
create type score_status as enum ('계산완료', 'N_A', '산출보류');

create table category_scores (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid references facilities(id),
  category measurement_category not null,
  score numeric check (score >= 0 and score <= 100),
  status score_status default '계산완료',
  calculated_at timestamptz default now()
);

-- 5. diagnosis_texts table
create type diagnosis_source as enum ('AI생성', '사람작성');
create type diagnosis_review_status as enum ('확인필요', '검수완료');

create table diagnosis_texts (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid references facilities(id),
  category measurement_category not null,
  text text not null,
  source diagnosis_source not null,
  created_at timestamptz default now(),
  review_status diagnosis_review_status default '확인필요',
  reviewed_by text,
  reviewed_at timestamptz
);

-- 6. re_diagnosis_logs table (Phase 1)
create type trigger_type_enum as enum ('자동', '수동');
create type re_diagnosis_status as enum ('예정', '완료', '취소');

create table re_diagnosis_logs (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid references facilities(id) not null,
  trigger_type trigger_type_enum not null,
  status re_diagnosis_status default '예정',
  created_at timestamptz default now(),
  scheduled_for date,
  completed_at timestamptz
);

-- RLS: For Phase 0/1, allow public read access
alter table zones enable row level security;
alter table facilities enable row level security;
alter table measurements enable row level security;
alter table category_scores enable row level security;
alter table diagnosis_texts enable row level security;
alter table re_diagnosis_logs enable row level security;

create policy "Public read access for zones" on zones for select using (true);
create policy "Public read access for facilities" on facilities for select using (status = '공개');
create policy "Public read access for measurements" on measurements for select using (true);
create policy "Public read access for category_scores" on category_scores for select using (true);
create policy "Public read access for diagnosis_texts" on diagnosis_texts for select using (true);
create policy "Public read access for re_diagnosis_logs" on re_diagnosis_logs for select using (true);
