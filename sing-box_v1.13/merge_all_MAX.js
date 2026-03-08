const { name, type = "0", rules: rules_file } = $arguments;

// 1. 读取模板
let config = JSON.parse($files[0]);

// 2. 插入自定义规则（优先级最高）
if (rules_file) {
  try {
    let customRulesRaw = await produceArtifact({
      type: "file",
      name: rules_file,
    });

    if (customRulesRaw) {
      let customRules = JSON.parse(customRulesRaw);

      const existingRules = new Set(
        config.route.rules.map(r => JSON.stringify(r))
      );

      customRules = customRules.filter(
        r => !existingRules.has(JSON.stringify(r))
      );

      config.route.rules.unshift(...customRules);

      console.log("已成功将自定义规则置顶");
    }
  } catch (e) {
    console.log("自定义规则解析失败，跳过: " + e);
  }
}

// 3. 拉取订阅节点
let proxies = await produceArtifact({
  name,
  type: /^1$|col/i.test(type) ? "collection" : "subscription",
  platform: "sing-box",
  produceType: "internal",
});

// 4. 防止节点 tag 重复
const existingTags = config.outbounds.map(o => o.tag);
proxies = proxies.filter(p => !existingTags.includes(p.tag));

// 5. 添加节点到 outbounds
config.outbounds.push(...proxies);

// 6. 生成节点 tag 列表
const allTags = proxies.map(p => p.tag);
const terminalTags = proxies
  .filter(p => !p.detour)
  .map(p => p.tag);

// 7. 向分组添加节点
config.outbounds.forEach(group => {

  if (!Array.isArray(group.outbounds)) return;

  // 跳过直连和拦截
  if (group.type === "direct" || group.type === "block") return;

  // 节点选择加入全部节点
  if (group.tag === "🚀 节点选择") {
    group.outbounds.push(...allTags);
  }

  // 自动选择只加入终端节点
  if (group.tag === "🎈 自动选择") {
    group.outbounds.push(...terminalTags);
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