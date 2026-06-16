/**
 * api/lib/supabase.js — Supabase 客户端初始化
 *
 * 使用 SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY（service_role key，服务端专用）
 * 确保所有 API 操作使用同一个客户端实例（连接复用）
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase 环境变量未配置！');
  console.error('   需要设置: SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY');
}

// 单例客户端（模块级缓存，Vercel 函数复用）
let _client = null;

function getClient() {
  if (!_client) {
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase 环境变量未配置');
    }
    _client = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }
    });
  }
  return _client;
}

module.exports = { getClient, supabaseUrl };
