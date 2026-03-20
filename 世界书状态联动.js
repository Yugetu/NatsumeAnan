const 日志前缀 = '[世界书状态联动]';
const 常态条目后缀 = '-魔法少女';
const 堕落条目后缀 = '-堕落魔法少女';
const 示例对话条目后缀 = '-示例对话';
const NSFW档案条目后缀 = '-NSFW档案';
const 同步等待超时毫秒 = 10000;
const 同步轮询间隔毫秒 = 100;

let 正在同步 = false;
let 需要再次同步 = false;
let 待同步变量 = null;
const 待同步来源 = new Set();

let 当前世界书缓存 = {
  名称: null,
  索引: null,
};
let 刷新世界书缓存任务 = null;

function 是可用的Mvu变量(variables) {
  return _.isPlainObject(variables) && _.has(variables, 'stat_data');
}

function 是已知名称(value) {
  return typeof value === 'string' && value.trim() && value.trim() !== '???';
}

function 获取角色别名(角色键名, 角色数据) {
  return Array.from(
    new Set(
      [角色键名, _.get(角色数据, '真名'), _.get(角色数据, '魔法名')]
        .filter(是已知名称)
        .map(value => value.trim()),
    ),
  );
}

function 规范化心结条目(knot) {
  const record = _.isPlainObject(knot) ? knot : {};
  const 是否解开 = _.get(record, '是否解开', _.get(record, '已解开', false)) === true;
  const 描述原文 = typeof _.get(record, '描述', '') === 'string' ? record.描述.trim() : '';

  return {
    描述: 是否解开 ? '' : 描述原文 || '???',
    是否解开,
  };
}

function 清理心结映射(rawKnots) {
  const result = {};
  if (!_.isPlainObject(rawKnots)) {
    return result;
  }

  _.forEach(rawKnots, (knot, rawName) => {
    const name = typeof rawName === 'string' && rawName.trim() ? rawName.trim() : '???';
    result[name] = 规范化心结条目(knot);
  });

  return result;
}

function 读取最新Mvu变量() {
  try {
    return Mvu.getMvuData({ type: 'message', message_id: 'latest' });
  } catch {
    return null;
  }
}

async function 等待最新楼层变量可用(timeoutMs = 同步等待超时毫秒) {
  const 开始时间 = Date.now();

  while (Date.now() - 开始时间 < timeoutMs) {
    const variables = 读取最新Mvu变量();
    if (是可用的Mvu变量(variables)) {
      return variables;
    }

    await new Promise(resolve => setTimeout(resolve, 同步轮询间隔毫秒));
  }

  return null;
}

function 获取魔法少女表(statData) {
  const girls = _.get(statData, '魔法少女', {});
  return _.isPlainObject(girls) ? girls : {};
}

function 获取当前主世界书名称() {
  try {
    const worldbookName = _.get(getCharWorldbookNames('current'), 'primary', null);
    return typeof worldbookName === 'string' && worldbookName.trim() ? worldbookName : null;
  } catch (error) {
    console.warn(`${日志前缀} 无法读取当前角色卡绑定的主世界书`, error);
    return null;
  }
}

function 提取条目魔法名(content) {
  const text = typeof content === 'string' ? content : '';
  const match = text.match(/^\s*魔法名:\s*(.+)$/m);
  return match ? match[1].trim() : null;
}

function 解析角色条目(entry) {
  if (!entry || typeof entry.name !== 'string') {
    return null;
  }

  const match = entry.name.match(/^\[角色\]\s+(.+?)(-堕落魔法少女|-魔法少女)(?:-(示例对话|NSFW档案))?$/);
  if (!match) {
    return null;
  }

  return {
    真名: match[1].trim(),
    类型: match[2] === 堕落条目后缀 ? '堕落' : '常态',
    附属类型: match[3] ?? '主体',
    条目名: entry.name,
    魔法名: match[3] ? null : 提取条目魔法名(entry.content),
  };
}

function 角色配对完整(role) {
  return Boolean(
    role &&
      role.常态条目名 &&
      role.堕落条目名 &&
      是已知名称(role.常态魔法名) &&
      是已知名称(role.堕落魔法名),
  );
}

function 构建世界书角色索引(worldbook) {
  const byTrueName = new Map();
  const byAlias = new Map();

  worldbook.forEach(entry => {
    const parsed = 解析角色条目(entry);
    if (!parsed) {
      return;
    }

    const role = byTrueName.get(parsed.真名) ?? {
      真名: parsed.真名,
      常态条目名: null,
      堕落条目名: null,
      常态附属条目名: [],
      堕落附属条目名: [],
      常态魔法名: null,
      堕落魔法名: null,
    };

    if (parsed.类型 === '常态') {
      if (parsed.附属类型 === '主体') {
        role.常态条目名 = parsed.条目名;
        role.常态魔法名 = parsed.魔法名;
      } else if (!role.常态附属条目名.includes(parsed.条目名)) {
        role.常态附属条目名.push(parsed.条目名);
      }
    } else {
      if (parsed.附属类型 === '主体') {
        role.堕落条目名 = parsed.条目名;
        role.堕落魔法名 = parsed.魔法名;
      } else if (!role.堕落附属条目名.includes(parsed.条目名)) {
        role.堕落附属条目名.push(parsed.条目名);
      }
    }

    byTrueName.set(role.真名, role);
  });

  byTrueName.forEach(role => {
    [role.真名, role.常态魔法名, role.堕落魔法名]
      .filter(是已知名称)
      .forEach(alias => {
        const key = alias.trim();
        if (!byAlias.has(key)) {
          byAlias.set(key, role);
        }
      });
  });

  return { byTrueName, byAlias };
}

function 从索引中查找角色(index, 角色键名, 角色数据) {
  if (!index) {
    return null;
  }

  const aliases = 获取角色别名(角色键名, 角色数据);
  for (const alias of aliases) {
    const role = index.byAlias.get(alias);
    if (role) {
      return role;
    }
  }

  return null;
}

function 合并角色记录(base, incoming) {
  if (!_.isPlainObject(base)) {
    return _.cloneDeep(incoming);
  }

  const 魔力上限候选 = _.get(incoming, '魔力上限', 100);
  const 旧魔力上限 = _.get(base, '魔力上限', 100);
  const 魔力上限 = _.clamp(魔力上限候选 !== 100 || 旧魔力上限 === 100 ? 魔力上限候选 : 旧魔力上限, 0, 999);
  const 魔力候选 = _.get(incoming, '魔力', 100);
  const 旧魔力 = _.get(base, '魔力', 100);
  const 魔力 = _.clamp(魔力候选 !== 100 || 旧魔力 === 100 ? 魔力候选 : 旧魔力, 0, 魔力上限);

  return {
    ..._.cloneDeep(base),
    ..._.cloneDeep(incoming),
    魔法名: 是已知名称(_.get(incoming, '魔法名')) ? incoming.魔法名 : _.get(base, '魔法名', '???'),
    真名: 是已知名称(_.get(incoming, '真名')) ? incoming.真名 : _.get(base, '真名', '???'),
    暴露: _.get(base, '暴露', false) === true || _.get(incoming, '暴露', false) === true,
    对主角的态度:
      _.get(incoming, '对主角的态度') && _.get(incoming, '对主角的态度') !== '陌生'
        ? incoming.对主角的态度
        : _.get(base, '对主角的态度', _.get(incoming, '对主角的态度', '陌生')),
    是否堕落: _.get(incoming, '是否堕落', _.get(base, '是否堕落', false)) === true,
    精神极限: _.get(base, '精神极限', false) === true || _.get(incoming, '精神极限', false) === true,
    魔力,
    魔力上限,
    心结: 清理心结映射({
      ..._.cloneDeep(_.get(base, '心结', {})),
      ..._.cloneDeep(_.get(incoming, '心结', {})),
    }),
  };
}

function 规范化预置角色数据(girl, role) {
  const nextGirl = _.cloneDeep(girl);
  nextGirl.真名 = role.真名;
  nextGirl.魔法名 = nextGirl.是否堕落 === true ? role.堕落魔法名 : role.常态魔法名;
  return nextGirl;
}

function 构建纠正后的魔法少女表(newGirls, oldGirls, roleIndex) {
  const corrected = {};
  const 已命中的预置角色 = new Set();

  _.forEach(newGirls, (girl, key) => {
    if (!_.isPlainObject(girl)) {
      return;
    }

    const role = 从索引中查找角色(roleIndex, key, girl);
    if (!角色配对完整(role)) {
      corrected[key] = 合并角色记录(corrected[key], girl);
      return;
    }

    已命中的预置角色.add(role.真名);
    corrected[role.真名] = 合并角色记录(corrected[role.真名], 规范化预置角色数据(girl, role));
  });

  _.forEach(oldGirls, (girl, key) => {
    if (!_.isPlainObject(girl)) {
      return;
    }

    const role = 从索引中查找角色(roleIndex, key, girl);
    if (!角色配对完整(role) || 已命中的预置角色.has(role.真名)) {
      return;
    }

    已命中的预置角色.add(role.真名);
    corrected[role.真名] = 合并角色记录(corrected[role.真名], 规范化预置角色数据(girl, role));
  });

  return corrected;
}

function 纠正魔法少女变量(newVariables, oldVariables, roleIndex) {
  if (!roleIndex) {
    return false;
  }

  const statData = _.get(newVariables, 'stat_data');
  if (!_.isPlainObject(statData)) {
    return false;
  }

  const currentGirls = 获取魔法少女表(statData);
  const oldGirls = 获取魔法少女表(_.get(oldVariables, 'stat_data', {}));
  const correctedGirls = 构建纠正后的魔法少女表(currentGirls, oldGirls, roleIndex);

  if (_.isEqual(correctedGirls, currentGirls)) {
    return false;
  }

  _.set(statData, '魔法少女', correctedGirls);
  return true;
}

async function 刷新当前世界书缓存(force = false) {
  const worldbookName = 获取当前主世界书名称();
  if (!worldbookName) {
    当前世界书缓存 = {
      名称: null,
      索引: null,
    };
    return 当前世界书缓存;
  }

  if (!force && 当前世界书缓存.名称 === worldbookName && 当前世界书缓存.索引) {
    return 当前世界书缓存;
  }

  if (!force && 刷新世界书缓存任务) {
    return 刷新世界书缓存任务;
  }

  刷新世界书缓存任务 = (async () => {
    const worldbook = await getWorldbook(worldbookName);
    当前世界书缓存 = {
      名称: worldbookName,
      索引: 构建世界书角色索引(worldbook),
    };
    return 当前世界书缓存;
  })().finally(() => {
    刷新世界书缓存任务 = null;
  });

  return 刷新世界书缓存任务;
}

function 构建旧角色索引(oldGirls) {
  const aliasIndex = new Map();

  _.forEach(oldGirls, (girl, key) => {
    if (!_.isPlainObject(girl)) {
      return;
    }

    获取角色别名(key, girl).forEach(alias => {
      if (!aliasIndex.has(alias)) {
        aliasIndex.set(alias, girl);
      }
    });
  });

  return aliasIndex;
}

function 查找旧角色(oldGirls, aliasIndex, key, girl) {
  if (_.isPlainObject(oldGirls[key])) {
    return oldGirls[key];
  }

  const aliases = 获取角色别名(key, girl);
  for (const alias of aliases) {
    const matched = aliasIndex.get(alias);
    if (matched) {
      return matched;
    }
  }

  return null;
}

function 回滚AI对只读字段的修改(newVariables, oldVariables) {
  const newStatData = _.get(newVariables, 'stat_data');
  const oldStatData = _.get(oldVariables, 'stat_data');

  if (!_.isPlainObject(newStatData) || !_.isPlainObject(oldStatData)) {
    return;
  }

  _.set(newStatData, '橘雪莉.技能', _.cloneDeep(_.get(oldStatData, '橘雪莉.技能', {})));

  const newGirls = 获取魔法少女表(newStatData);
  const oldGirls = 获取魔法少女表(oldStatData);
  const aliasIndex = 构建旧角色索引(oldGirls);

  _.forEach(newGirls, (girl, key) => {
    if (!_.isPlainObject(girl)) {
      return;
    }

    const oldGirl = 查找旧角色(oldGirls, aliasIndex, key, girl);
    _.set(girl, '是否堕落', _.get(oldGirl, '是否堕落', false) === true);
  });
}

function 分析世界书目标(worldbook, girls) {
  const entriesByName = _.keyBy(worldbook, 'name');
  const roleIndex = 构建世界书角色索引(worldbook);
  const targetEnabledByName = new Map();
  const changedGirls = [];
  const missingGirls = [];

  _.forEach(girls, (girl, roleName) => {
    if (!_.isPlainObject(girl)) {
      return;
    }

    const role = 从索引中查找角色(roleIndex, roleName, girl);
    if (!角色配对完整(role)) {
      missingGirls.push(roleName);
      return;
    }

    const 已堕落 = _.get(girl, '是否堕落', false) === true;
    const 常态启用 = !已堕落;
    const 堕落启用 = 已堕落;

    targetEnabledByName.set(role.常态条目名, 常态启用);
    targetEnabledByName.set(role.堕落条目名, 堕落启用);
    role.常态附属条目名.forEach(name => {
      targetEnabledByName.set(name, 常态启用);
    });
    role.堕落附属条目名.forEach(name => {
      targetEnabledByName.set(name, 堕落启用);
    });

    const 常态条目 = entriesByName[role.常态条目名];
    const 堕落条目 = entriesByName[role.堕落条目名];

    if (!常态条目 || !堕落条目) {
      missingGirls.push(roleName);
      return;
    }

    const 常态附属条目需更新 = role.常态附属条目名.some(name => entriesByName[name] && entriesByName[name].enabled !== 常态启用);
    const 堕落附属条目需更新 = role.堕落附属条目名.some(name => entriesByName[name] && entriesByName[name].enabled !== 堕落启用);

    if (常态条目.enabled !== 常态启用 || 堕落条目.enabled !== 堕落启用 || 常态附属条目需更新 || 堕落附属条目需更新) {
      changedGirls.push(`${role.真名}:${已堕落 ? '堕落' : '常态'}`);
    }
  });

  return {
    roleIndex,
    targetEnabledByName,
    changedGirls,
    missingGirls: Array.from(new Set(missingGirls)),
  };
}

async function 执行一次同步(source, candidateVariables) {
  const variables = 是可用的Mvu变量(candidateVariables) ? candidateVariables : await 等待最新楼层变量可用();
  if (!是可用的Mvu变量(variables)) {
    console.warn(`${日志前缀} 跳过同步: ${source} 时未能读取最新楼层的 stat_data`);
    return;
  }

  const girls = 获取魔法少女表(_.get(variables, 'stat_data', {}));

  const worldbookName = 获取当前主世界书名称();
  if (!worldbookName) {
    console.warn(`${日志前缀} 跳过同步: 当前角色卡未绑定主世界书`);
    return;
  }

  console.info(`${日志前缀} 开始同步: ${source} -> ${worldbookName}`);

  try {
    const worldbook = await getWorldbook(worldbookName);
    const { roleIndex, targetEnabledByName, changedGirls, missingGirls } = 分析世界书目标(worldbook, girls);

    当前世界书缓存 = {
      名称: worldbookName,
      索引: roleIndex,
    };

    missingGirls.forEach(roleName => {
      console.warn(`${日志前缀} 跳过 ${roleName}: 未找到完整的 [角色] 常态/堕落条目配对`);
    });

    if (!changedGirls.length) {
      return;
    }

    await updateWorldbookWith(
      worldbookName,
      entries =>
        entries.map(entry =>
          targetEnabledByName.has(entry.name)
            ? {
                ...entry,
                enabled: targetEnabledByName.get(entry.name),
              }
            : entry,
        ),
      { render: 'debounced' },
    );

    console.info(`${日志前缀} 已更新角色条目: ${changedGirls.join(', ')}`);
  } catch (error) {
    console.warn(`${日志前缀} 同步世界书失败: ${worldbookName}`, error);
  }
}

function 请求同步(source, variables) {
  待同步来源.add(source);
  if (是可用的Mvu变量(variables)) {
    待同步变量 = variables;
  }

  if (正在同步) {
    需要再次同步 = true;
    return;
  }

  正在同步 = true;

  errorCatched(async () => {
    try {
      do {
        需要再次同步 = false;

        const sourceText = Array.from(待同步来源).join('、') || source;
        const nextVariables = 待同步变量;

        待同步来源.clear();
        待同步变量 = null;

        await 执行一次同步(sourceText, nextVariables);
      } while (需要再次同步 || 待同步来源.size > 0);
    } finally {
      正在同步 = false;
    }
  })();
}

async function 纠正并回写最新变量(source) {
  const variables = await 等待最新楼层变量可用();
  if (!是可用的Mvu变量(variables)) {
    return;
  }

  const cache = await 刷新当前世界书缓存();
  if (!cache.索引) {
    请求同步(source, variables);
    return;
  }

  const draft = _.cloneDeep(variables);
  const hasCorrection = 纠正魔法少女变量(draft, variables, cache.索引);

  if (hasCorrection) {
    console.info(`${日志前缀} ${source} 时已纠正预置魔法少女变量`);
    await Mvu.replaceMvuData(draft, { type: 'message', message_id: 'latest' });
    请求同步(`${source}-纠正后`, draft);
    return;
  }

  请求同步(source, variables);
}

$(() => {
  errorCatched(async () => {
    await waitGlobalInitialized('Mvu');

    await 刷新当前世界书缓存();
    await 纠正并回写最新变量('脚本加载');

    eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, (newVariables, oldVariables) => {
      回滚AI对只读字段的修改(newVariables, oldVariables);

      const roleIndex = _.get(当前世界书缓存, '索引', null);
      if (roleIndex) {
        纠正魔法少女变量(newVariables, oldVariables, roleIndex);
      }

      请求同步('变量更新结束', newVariables);
    });

    eventOn(tavern_events.CHAT_CHANGED, () => {
      errorCatched(async () => {
        await 刷新当前世界书缓存(true);
        await 纠正并回写最新变量('切换聊天');
      })();
    });
  })();
});
