const { name, type = "0", rules: rules_file } = $arguments;

// 1. 读取模板
let config = JSON.parse($files[0]);

// 2. 先追加自定义规则
if (rules_file) {
  try {
    let customRulesRaw = await produceArtifact({
      type: "file",
      name: rules_file,
    });
    if (customRulesRaw) {
      let customRules = JSON.parse(customRulesRaw);
      
      // 【核心改动】：不再找 global 索引，直接将拦截规则插入到 route.rules 的最开头 (位置 0)
      // 这样可以确保广告拦截优先级最高，不会被后面的 sniff 或 direct 规则跳过
      const existingRulesStr = new Set(config.route.rules.map(r => JSON.stringify(r)));
      customRules = customRules.filter(r => !existingRulesStr.has(JSON.stringify(r)));
      
      config.route.rules.unshift(...customRules); 
      console.log("已成功将自定义拦截规则置顶");
    }
  } catch (e) {
    console.log("自定义规则解析失败，跳过插入: " + e);
  }
}

// 3. 拉取订阅或合集节点
let proxies = await produceArtifact({
  name,
  type: /^1$|col/i.test(type) ? "collection" : "subscription",
  platform: "sing-box",
  produceType: "internal",
});

// 4. 去重已有节点tag
const existingTags = config.outbounds.map(o => o.tag);
proxies = proxies.filter(p => !existingTags.includes(p.tag));

// 5. 添加新节点到 outbounds
config.outbounds.push(...proxies);

// 6. 准备 tag 列表
const allTags = proxies.map(p => p.tag);
const terminalTags = proxies.filter(p => !p.detour).map(p => p.tag);

// 7. 遍历分组追加节点
config.outbounds.forEach(group => {
  if (!Array.isArray(group.outbounds) || group.tag === "Direct-Out" || group.tag === "Block") return;

  if (group.tag === "Relay") {
    group.outbounds.push(...terminalTags);
  } else {
    group.outbounds.push(...allTags);
  }
});

// 8. 分组内去重
config.outbounds.forEach(group => {
  if (Array.isArray(group.outbounds)) {
    group.outbounds = [...new Set(group.outbounds)];
  }
});

// 9. 输出最终配置
$content = JSON.stringify(config, null, 2);
