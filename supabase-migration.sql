-- ============================================================
-- 進和集團報價系統 — Supabase 資料庫遷移腳本
-- 使用方法：
--   1. 進入 Supabase Dashboard → SQL Editor
--   2. 貼上此腳本 → 點擊 Run
-- ============================================================

-- 建立主資料表 (每個設備一行，存全部數據 JSON)
CREATE TABLE IF NOT EXISTS store_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id TEXT UNIQUE NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 建立索引以加速查詢
CREATE INDEX IF NOT EXISTS idx_store_data_device_id ON store_data(device_id);
CREATE INDEX IF NOT EXISTS idx_store_data_updated_at ON store_data(updated_at DESC);

-- 啟用 RLS (Row Level Security) — 開發階段允許全訪問
ALTER TABLE store_data ENABLE ROW LEVEL SECURITY;

-- 允許匿名用戶讀寫（適合內部報價系統）
CREATE POLICY "Allow all on store_data"
ON store_data FOR ALL USING (true) WITH CHECK (true);

-- 自動更新 updated_at
CREATE OR REPLACE FUNCTION update_sb_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_sb_updated_at ON store_data;
CREATE TRIGGER set_sb_updated_at BEFORE UPDATE ON store_data FOR EACH ROW EXECUTE FUNCTION update_sb_updated_at();
