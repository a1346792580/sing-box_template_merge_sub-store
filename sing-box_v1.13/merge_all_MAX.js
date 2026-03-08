const { name, type = "0", rules: rules_file } = $arguments;

// 1. 读取模板
let config;

if ($files && $files.length > 0) {
  config = JSON.parse($files[0]);
} else {
  throw new Error("未找到模板文件");
}

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

      console.log("已成功插入自定义规则");
    }
  } catch (e) {
    console.log("自定义规则解析失败: " + e);
  }
}

// 3. 拉取订阅或合集节点
let proxies = await produceArtifact({
  name,
  type: /^1$|col/i.test(type) ? "collection" : "subscription",
  platform: "sing-box",
  produceType: "internal",
});

// 4. 获取已有节点tag
const existingTags = config.outbounds.map(o => o.tag);

// 5. 去重节点
proxies = proxies.filter(p => !existingTags.includes(p.tag));

// 6. 添加节点到 outbounds
config.outbounds.push(...proxies);

// 7. 节点 tag 列表
const allTags = proxies.map(p => p.tag);

// 终端节点（非 relay）
const terminalTags = proxies
  .filter(p => !p.detour)
  .map(p => p.tag);

// 8. 自动填充分组
config.outbounds.forEach(group => {

  if (!Array.isArray(group.outbounds)) return;

  // 跳过直连和拦截
  if (group.type === "direct" || group.type === "block") return;

  // 自动选择组只加入终端节点
  if (group.type === "urltest") {
    group.outbounds.push(...terminalTags);
  }

  // selector 组加入全部节点
  else if (group.type === "selector") {
    group.outbounds.push(...allTags);
  }

});

// 9. 分组内去重
config.outbounds.forEach(group => {
  if (Array.isArray(group.outbounds)) {
    group.outbounds = [...new Set(group.outbounds)];
  }
});

// 10. 输出最终配置
$content = JSON.stringify(config, null, 2);