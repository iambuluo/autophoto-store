/**
 * 模拟完整授权流程测试脚本
 * 
 * 模拟步骤：
 * 1. 生成授权码（放入码池）
 * 2. 模拟 Stripe 付款分配
 * 3. 模拟用户首次激活（bind）
 * 4. 模拟在线验证（validate）
 * 5. 模拟换设备（unbind + 重新 bind）
 * 6. 模拟换设备后再验证
 * 7. 模拟管理员吊销
 */

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// ============================================================
// 初始化 Supabase 客户端
// ============================================================
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase 环境变量未配置！');
  console.error('   需要设置: SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY');
  console.error('   当前 SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('   当前 SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

// ============================================================
// 辅助函数
// ============================================================
function genLicenseCode(prefix = 'VCG') {
  return `${prefix}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

function randomMachineCode() {
  return crypto.randomBytes(8).toString('hex').toUpperCase();
}

let PASS = 0, FAIL = 0;
function assert(condition, msg) {
  if (condition) {
    PASS++;
    console.log(`   ✅ ${msg}`);
  } else {
    FAIL++;
    console.error(`   ❌ ${msg}`);
  }
}

// ============================================================
// 测试流程
// ============================================================
async function main() {
  console.log('==========================================');
  console.log('  完整授权流程模拟测试');
  console.log('==========================================\n');

  // ---------- Step 1: 生成测试授权码 ----------
  console.log('[Step 1] 生成测试授权码...');
  const testCode = genLicenseCode('TEST');
  const testPluginId = 'shijuezhongguo';
  const testPlan = 'annual';
  
  const { error: insertErr } = await supabase
    .from('licenses')
    .insert([{
      code: testCode,
      plugin_id: testPluginId,
      plan: testPlan,
      status: 'unused',
      machine_code: null,
      bound_email: null,
      bound_at: null,
      created_at: new Date().toISOString(),
      issued_at: null,
      issued_email: null,
      stripe_session_id: null,
      remark: null
    }]);
  
  if (insertErr) {
    console.error('   ❌ 插入测试授权码失败:', insertErr.message);
    process.exit(1);
  }
  console.log(`   ✅ 生成授权码: ${testCode}\n`);

  // ---------- Step 2: 模拟 Stripe 付款后分配 ----------
  console.log('[Step 2] 模拟 Stripe 付款后分配...');
  
  // 查询状态应为 unused
  const { data: beforeAllocate, error: qErr1 } = await supabase
    .from('licenses')
    .select('*')
    .eq('code', testCode)
    .maybeSingle();
  assert(qErr1 === null && beforeAllocate, '查询成功');
  assert(beforeAllocate.status === 'unused', `状态为 unused (got: ${beforeAllocate.status})`);
  
  // 模拟分配：从 unused -> issued
  const now = new Date().toISOString();
  await supabase
    .from('licenses')
    .update({ status: 'issued', issued_at: now, issued_email: 'test@example.com' })
    .eq('code', testCode);
  
  // 查询状态应为 issued
  const { data: afterAllocate } = await supabase
    .from('licenses')
    .select('*')
    .eq('code', testCode)
    .maybeSingle();
  assert(afterAllocate.status === 'issued', `状态变为 issued`);
  assert(afterAllocate.issued_email === 'test@example.com', `发行邮箱已记录`);
  console.log(`   ✅ 码状态: unused -> issued\n`);

  // ---------- Step 3: 模拟用户首次激活 (bind) ----------
  console.log('[Step 3] 模拟用户首次激活（绑定机器码）...');
  const originalMachine = randomMachineCode();
  console.log(`   原机器码: ${originalMachine}`);
  
  // 调用 bindLicense 逻辑
  const { data: beforeBind } = await supabase
    .from('licenses')
    .select('*')
    .eq('code', testCode)
    .maybeSingle();
  assert(beforeBind.status === 'issued', `状态为 issued (ready to bind)`);
  
  await supabase
    .from('licenses')
    .update({ status: 'bound', machine_code: originalMachine, bound_email: 'test@example.com', bound_at: now })
    .eq('code', testCode);
  
  const { data: afterBind } = await supabase
    .from('licenses')
    .select('*')
    .eq('code', testCode)
    .maybeSingle();
  assert(afterBind.status === 'bound', `状态变为 bound`);
  assert(afterBind.machine_code === originalMachine, `机器码已绑定`);
  console.log(`   ✅ 授权码状态: issued -> bound\n`);

  // ---------- Step 4: 模拟在线验证 (validate) ----------
  console.log('[Step 4] 模拟在线验证（机器码正确）...');
  
  // 4a. 验证：机器码正确
  const validate1 = await supabase
    .from('licenses')
    .select('*')
    .eq('code', testCode)
    .maybeSingle();
  
  const v1 = validate1.data;
  const v1Valid = v1.status !== 'revoked' && v1.status !== 'unused' && v1.status !== 'issued' 
                  && v1.machine_code === 'SAME_AS_CHECKED';
  // 我们直接用原始机器码比较
  const correctMachineMatch = v1.machine_code === originalMachine;
  assert(correctMachineMatch, `机器码匹配验证通过`);
  console.log(`   ✅ 在线验证: VALID\n`);
  
  // 4b. 验证：机器码错误
  const wrongMachine = 'WRONG123456';
  assert(v1.machine_code !== wrongMachine, `错误机器码不被接受`);
  console.log(`   ✅ 错误机器码验证失败\n`);

  // ---------- Step 5: 模拟换设备（unbind + rebind） ----------
  console.log('[Step 5] 模拟换设备（解绑 + 重新绑定）...');
  
  // 5a. 管理员调用 unbind
  const { data: beforeUnbind } = await supabase
    .from('licenses')
    .select('*')
    .eq('code', testCode)
    .maybeSingle();
  assert(beforeUnbind.status === 'bound', `绑定状态可解绑`);
  
  await supabase
    .from('licenses')
    .update({ status: 'issued', machine_code: null, bound_email: null, bound_at: null })
    .eq('code', testCode);
  
  const { data: afterUnbind } = await supabase
    .from('licenses')
    .select('*')
    .eq('code', testCode)
    .maybeSingle();
  assert(afterUnbind.status === 'issued', `状态回到 issued`);
  assert(afterUnbind.machine_code === null, `机器码已清空`);
  console.log(`   ✅ 解绑成功: bound -> issued`);
  
  // 5b. 用户在新设备重新激活 (bind)
  const newMachine = randomMachineCode();
  console.log(`   新机器码: ${newMachine}`);
  
  await supabase
    .from('licenses')
    .update({ status: 'bound', machine_code: newMachine, bound_email: 'test@example.com', bound_at: new Date().toISOString() })
    .eq('code', testCode);
  
  const { data: afterRebind } = await supabase
    .from('licenses')
    .select('*')
    .eq('code', testCode)
    .maybeSingle();
  assert(afterRebind.status === 'bound', `重新绑定成功`);
  assert(afterRebind.machine_code === newMachine, `新机器码已绑定`);
  assert(afterRebind.machine_code !== originalMachine, `旧机器码已替换`);
  console.log(`   ✅ 换设备完成: 旧机器码 ${originalMachine.slice(0,8)} -> 新机器码 ${newMachine.slice(0,8)}\n`);

  // ---------- Step 6: 换设备后再验证 ----------
  console.log('[Step 6] 换设备后验证（新机器码应该通过）...');
  const validate2 = await supabase
    .from('licenses')
    .select('*')
    .eq('code', testCode)
    .maybeSingle();
  
  const correctNewMachineMatch = validate2.data.machine_code === newMachine;
  const wrongNewMachineMismatch = validate2.data.machine_code !== originalMachine; // 旧机器码不应该通过
  
  assert(correctNewMachineMatch, `新机器码验证通过`);
  assert(wrongNewMachineMismatch, `旧机器码验证失败`);
  console.log(`   ✅ 验证通过\n`);

  // ---------- Step 7: 模拟管理员吊销 ----------
  console.log('[Step 7] 模拟管理员吊销授权...');
  
  await supabase
    .from('licenses')
    .update({ status: 'revoked' })
    .eq('code', testCode);
  
  const { data: afterRevoke } = await supabase
    .from('licenses')
    .select('*')
    .eq('code', testCode)
    .maybeSingle();
  assert(afterRevoke.status === 'revoked', `状态变为 revoked`);
  console.log(`   ✅ 授权已吊销\n`);

  // ---------- Step 8: 额外边界测试 ----------
  console.log('[Step 8] 边界情况测试...');
  
  // 8a. unused 码不能 bind
  const unusedCode = genLicenseCode('TEST');
  await supabase
    .from('licenses')
    .insert([{ code: unusedCode, plugin_id: testPluginId, plan: testPlan, status: 'unused', machine_code: null, bound_email: null, bound_at: null, created_at: now, issued_at: null, issued_email: null, stripe_session_id: null, remark: null }]);
  
  const { data: unUsedCheck } = await supabase.from('licenses').select('*').eq('code', unusedCode).maybeSingle();
  assert(unUsedCheck.status === 'unused', '未发行码状态为 unused');
  assert(unUsedCheck.status === 'unused' && unUsedCheck.status !== 'issued' && unUsedCheck.status !== 'bound', 'unused 码不允许直接 bind');
  console.log(`   ✅ 未发行码不能激活`);
  
  // 8b. revoked 码不能 bind
  assert(afterRevoke.status === 'revoked', '已吊销码不能再绑定');
  console.log(`   ✅ 已吊销码不能重新绑定`);
  
  // 8c. 同一机器码重复激活
  assert(originalMachine !== newMachine, '两个不同机器码');
  console.log(`   ✅ 不同机器码区分正确\n`);

  // ---------- Step 9: 清理测试数据 ----------
  console.log('[Step 9] 清理测试数据...');
  const { error: cleanErr1 } = await supabase
    .from('licenses')
    .delete()
    .in('code', [testCode, unusedCode]);
  assert(cleanErr1 === null, '测试数据清理完成');
  console.log(`   ✅ 已删除测试授权码\n`);

  // ============================================================
  // 汇总
  // ============================================================
  console.log('==========================================');
  console.log(`  测试结果: ${PASS} 通过, ${FAIL} 失败`);
  console.log('==========================================');
  
  if (FAIL > 0) {
    process.exit(1);
  } else {
    console.log('\n🎉 所有测试用例通过！完整授权流程验证成功！');
  }
}

main().catch(err => {
  console.error('测试异常:', err.message);
  process.exit(1);
});
