-- ============================================================
-- 進和集團報價系統 — Supabase 資料庫遷移腳本
-- 使用方法：
--   1. 註冊 Supabase 帳號 → https://supabase.com
--   2. 創建新專案 (New Project)
--   3. 進入 SQL Editor → 貼上此腳本 → 點擊 Run
-- ============================================================

-- 建立主資料表 (key-value 結構，對應 localStorage)
CREATE TABLE IF NOT EXISTS cw_data (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 建立索引以加速查詢
CREATE INDEX IF NOT EXISTS idx_cw_data_updated_at ON cw_data(updated_at DESC);

-- 啟用 RLS (Row Level Security)
ALTER TABLE cw_data ENABLE ROW LEVEL SECURITY;

-- 允許匿名用戶 (anon key) 讀寫全部資料
-- 安全性說明：Supabase anon key 是公開的，所以任何人都能讀寫此表。
-- 這對單人/小團隊內部系統是安全的。如需加強安全，可改用 authenticated 策略。
CREATE POLICY "Allow all operations on cw_data"
ON cw_data
FOR ALL
USING (true)
WITH CHECK (true);

-- 可選：建立 updated_at 自動更新函數
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 建立觸發器：每次更新時自動更新 updated_at
DROP TRIGGER IF EXISTS set_updated_at ON cw_data;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON cw_data
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
