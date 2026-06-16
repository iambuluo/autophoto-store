-- ============================================================
-- AutoPhoto Store - 授权码池数据库
-- 运行方式：Supabase Dashboard → SQL Editor → 粘贴执行
-- ============================================================

-- 1. 授权码表
CREATE TABLE IF NOT EXISTS licenses (
  code          TEXT        PRIMARY KEY,   -- 授权码，如 VCG-A1B2C3D4
  plugin_id     TEXT        NOT NULL,     -- 插件标识
  plan          TEXT        NOT NULL,     -- 授权方案：trial / annual / permanent
  status        TEXT        NOT NULL DEFAULT 'unused',  -- unused / issued / bound / revoked
  machine_code  TEXT,                      -- 绑定的机器码
  bound_email   TEXT,                      -- 绑定邮箱
  bound_at      TIMESTAMPTZ,              -- 绑定时间
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  issued_at     TIMESTAMPTZ,              -- 发行时间
  issued_email  TEXT,                      -- 发行时客户邮箱
  stripe_session_id TEXT,                  -- 对应 Stripe Session ID
  remark        TEXT                       -- 管理员备注
);

-- 2. 发行订单记录表
CREATE TABLE IF NOT EXISTS issued_orders (
  order_id   TEXT        PRIMARY KEY,   -- Stripe Session ID
  code       TEXT        NOT NULL,
  plugin_id  TEXT        NOT NULL,
  plan       TEXT        NOT NULL,
  email      TEXT        NOT NULL,
  issued_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. 索引（加速各类查询）
CREATE INDEX IF NOT EXISTS idx_licenses_plugin_plan ON licenses(plugin_id, plan);
CREATE INDEX IF NOT EXISTS idx_licenses_status    ON licenses(status);
CREATE INDEX IF NOT EXISTS idx_licenses_issued_email ON licenses(issued_email);
CREATE INDEX IF NOT EXISTS idx_licenses_machine_code ON licenses(machine_code);
CREATE INDEX IF NOT EXISTS idx_licenses_stripe_session ON licenses(stripe_session_id);

-- 4. 关闭 RLS（服务端直接用 service_role key，无需 RLS）
ALTER TABLE licenses    ENABLE ROW LEVEL SECURITY;
ALTER TABLE issued_orders ENABLE ROW LEVEL SECURITY;

-- 为 service_role 放行（服务端完全访问）
CREATE POLICY "service_role_full_access_licenses" ON licenses
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_full_access_orders" ON issued_orders
  FOR ALL USING (auth.role() = 'service_role');

-- 为 anon 角色只读（前端查询统计等）
CREATE POLICY "anon_read_stats" ON licenses
  FOR SELECT USING (true);

-- 5. 自动初始化码池（2100个预生成授权码）
DO $$
DECLARE
  _code TEXT;
  _idx  INT := 0;
BEGIN
  -- 如果已初始化，跳过
  IF EXISTS (SELECT 1 FROM licenses LIMIT 1) THEN
    RAISE NOTICE '码池已有数据，跳过初始化。';
    RETURN;
  END IF;

  RAISE NOTICE '开始初始化 2100 个预生成授权码...';

  -- 视觉中国 VCG × 3方案
  FOREACH _code IN ARRAY ARRAY['trial', 'annual', 'permanent']
  LOOP
    FOR _idx IN 1..100 LOOP
      INSERT INTO licenses (code, plugin_id, plan, status)
      VALUES ('VCG-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8)), 'shijuezhongguo', _code, 'unused')
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;

  -- 光厂 VJ × 3方案
  FOREACH _code IN ARRAY ARRAY['trial', 'annual', 'permanent']
  LOOP
    FOR _idx IN 1..100 LOOP
      INSERT INTO licenses (code, plugin_id, plan, status)
      VALUES ('VJ-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8)), 'guangchang', _code, 'unused')
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;

  -- 新片场 XC × 3方案
  FOREACH _code IN ARRAY ARRAY['trial', 'annual', 'permanent']
  LOOP
    FOR _idx IN 1..100 LOOP
      INSERT INTO licenses (code, plugin_id, plan, status)
      VALUES ('XC-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8)), 'xinchangchang', _code, 'unused')
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;

  -- Dreamstime DT × 3方案
  FOREACH _code IN ARRAY ARRAY['trial', 'annual', 'permanent']
  LOOP
    FOR _idx IN 1..100 LOOP
      INSERT INTO licenses (code, plugin_id, plan, status)
      VALUES ('DT-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8)), 'dreamstime', _code, 'unused')
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;

  -- Adobe Stock AS × 3方案
  FOREACH _code IN ARRAY ARRAY['trial', 'annual', 'permanent']
  LOOP
    FOR _idx IN 1..100 LOOP
      INSERT INTO licenses (code, plugin_id, plan, status)
      VALUES ('AS-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8)), 'adobe-stock', _code, 'unused')
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;

  -- 清影图片 QY × 3方案
  FOREACH _code IN ARRAY ARRAY['trial', 'annual', 'permanent']
  LOOP
    FOR _idx IN 1..100 LOOP
      INSERT INTO licenses (code, plugin_id, plan, status)
      VALUES ('QY-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8)), 'qingying-image', _code, 'unused')
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;

  -- 清影视频 QV × 3方案
  FOREACH _code IN ARRAY ARRAY['trial', 'annual', 'permanent']
  LOOP
    FOR _idx IN 1..100 LOOP
      INSERT INTO licenses (code, plugin_id, plan, status)
      VALUES ('QV-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8)), 'qingying-video', _code, 'unused')
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;

  RAISE NOTICE '码池初始化完成！';
END;
$$;

-- 验证码池
SELECT plugin_id, plan, status, COUNT(*) as count
FROM licenses
GROUP BY plugin_id, plan, status
ORDER BY plugin_id, plan, status;
