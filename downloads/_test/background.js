// AutoPhoto Plugin - 授权验证
// 此文件需要在购买授权后替换为完整插件

// 机器指纹（用于授权验证）
chrome.runtime.onInstalled.addListener(() => {
  // 生成或读取机器ID
  chrome.storage.local.get(['__ap_machine_id'], (result) => {
    if (!result.__ap_machine_id) {
      const id = 'AP-' + Math.random().toString(36).substring(2, 10).toUpperCase() + '-' + Date.now().toString(36).toUpperCase();
      chrome.storage.local.set({ __ap_machine_id: id });
      console.log('[AutoPhoto] 机器ID已生成:', id);
    } else {
      console.log('[AutoPhoto] 机器ID:', result.__ap_machine_id);
    }
  });
});
