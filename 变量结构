import { registerMvuSchema } from 'https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js';

const DEFAULT_LOCATION = {
  城市: '新都',
  地区: '未知地区',
  地址: '未知地点',
};

const ATTITUDES = ['陌生', '无关心', '一般', '信任', '恋心', '讨厌', '死仇', '爱恨交织'];
const EMOTION_LEVELS = ['微弱', '些许', '普通', '强烈', '极端'];

const AttitudeSchema = z.enum(ATTITUDES);
const EmotionLevelSchema = z.enum(EMOTION_LEVELS);

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function toNumber(value, fallback) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const text = value.trim();
    if (text) {
      const parsed = Number(text);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return fallback;
}

function normalizeOptionalText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeText(value, fallback) {
  const text = normalizeOptionalText(value);
  return text || fallback;
}

function normalizeAttitude(value) {
  const normalized = normalizeText(value, '').replace(/倾心/g, '恋心');
  return ATTITUDES.includes(normalized) ? normalized : '陌生';
}

function normalizeEmotionLevel(value) {
  const normalized = normalizeText(value, '');
  return EMOTION_LEVELS.includes(normalized) ? normalized : '普通';
}

function normalizeThoughtText(value) {
  return normalizeOptionalText(value) || '……';
}

function limitRecord(record, count) {
  return Object.fromEntries(Object.entries(record).slice(-count));
}

function normalizeMagicValue(rawValue, rawLimit) {
  let currentInput = rawValue;
  let maxInput = rawLimit;

  if (isRecord(rawValue)) {
    currentInput = rawValue.当前;
    maxInput = rawLimit ?? rawValue.上限;
  }

  const 魔力上限 = clamp(toNumber(maxInput, 100), 0, 999);
  const 魔力 = clamp(toNumber(currentInput, 100), 0, 魔力上限);
  return { 魔力, 魔力上限 };
}

function normalizeSkillMap(rawSkills) {
  const result = {};
  if (!isRecord(rawSkills)) {
    return result;
  }

  for (const [rawName, rawValue] of Object.entries(rawSkills)) {
    const name = normalizeOptionalText(rawName);
    if (!name) {
      continue;
    }

    const record = isRecord(rawValue) ? rawValue : {};
    result[name] = {
      说明: normalizeOptionalText(record.说明 ?? record.描述 ?? rawValue),
    };
  }

  return result;
}

function normalizeKnotEntry(rawValue) {
  const record = isRecord(rawValue) ? rawValue : {};
  const 是否解开 = Boolean(record.是否解开 ?? record.已解开 ?? false);
  const 描述 = normalizeOptionalText(record.描述);

  return {
    描述: 是否解开 ? '' : 描述 || '???',
    是否解开,
  };
}

function normalizeKnotMap(rawKnots) {
  const result = {};
  if (!isRecord(rawKnots)) {
    return result;
  }

  for (const [rawName, rawValue] of Object.entries(rawKnots)) {
    const name = normalizeText(rawName, '???');
    result[name] = normalizeKnotEntry(rawValue);
  }

  return result;
}

function mergeKnotMap(...maps) {
  const result = {};

  maps.forEach(map => {
    if (!map) {
      return;
    }

    Object.entries(map).forEach(([rawName, rawValue]) => {
      const name = normalizeText(rawName, '???');
      result[name] = normalizeKnotEntry(rawValue);
    });
  });

  return result;
}

function normalizeLocation(rawLocation) {
  if (typeof rawLocation === 'string') {
    const splitter = rawLocation.includes(' / ') ? /\s*\/\s*/ : '、';
    const parts = rawLocation
      .split(splitter)
      .map(part => part.trim())
      .filter(Boolean);

    return {
      城市: normalizeText(parts[0], DEFAULT_LOCATION.城市),
      地区: normalizeText(parts[1], DEFAULT_LOCATION.地区),
      地址: normalizeText(parts.slice(2).join('、'), DEFAULT_LOCATION.地址),
    };
  }

  const record = isRecord(rawLocation) ? rawLocation : {};
  return {
    城市: normalizeText(record.城市, DEFAULT_LOCATION.城市),
    地区: normalizeText(record.地区, DEFAULT_LOCATION.地区),
    地址: normalizeText(record.地址 ?? record.详细地址, DEFAULT_LOCATION.地址),
  };
}

function normalizeMagicName(rawMagicName, isFallen, fallbackKey) {
  if (typeof rawMagicName === 'string') {
    return normalizeText(rawMagicName, normalizeText(fallbackKey, '???'));
  }

  if (isRecord(rawMagicName)) {
    return normalizeText(isFallen ? rawMagicName.堕落 : rawMagicName.常态, normalizeText(fallbackKey, '???'));
  }

  return normalizeText(fallbackKey, '???');
}

function normalizeMagicGirlKey(rawKey, trueName, magicName) {
  if (trueName !== '???') {
    return trueName;
  }

  return normalizeText(rawKey, magicName);
}

function mergeMagicGirlRecord(base, incoming) {
  if (!base) {
    return {
      ...incoming,
      心结: { ...incoming.心结 },
    };
  }

  const 魔力上限 = incoming.魔力上限 !== 100 || base.魔力上限 === 100 ? incoming.魔力上限 : base.魔力上限;
  const 魔力 = incoming.魔力 !== 100 || base.魔力 === 100 ? incoming.魔力 : base.魔力;

  return {
    魔法名: incoming.魔法名 !== '???' ? incoming.魔法名 : base.魔法名,
    真名: incoming.真名 !== '???' ? incoming.真名 : base.真名,
    暴露: base.暴露 || incoming.暴露,
    对主角的态度: incoming.对主角的态度 !== '陌生' ? incoming.对主角的态度 : base.对主角的态度,
    是否堕落: incoming.是否堕落,
    精神极限: base.精神极限 || incoming.精神极限,
    魔力上限,
    魔力: clamp(魔力, 0, 魔力上限),
    心结: mergeKnotMap(base.心结, incoming.心结),
  };
}

function normalizeMagicGirlEntry(rawKey, rawGirl, rawLegacyRole) {
  const girl = isRecord(rawGirl) ? rawGirl : {};
  const legacyRole = isRecord(rawLegacyRole) ? rawLegacyRole : {};
  const 是否堕落 = Boolean(girl.是否堕落 ?? girl.堕落 ?? false);
  const 精神极限 = Boolean(girl.精神极限 ?? girl.待堕落确认 ?? false);
  const 暴露 = Boolean(girl.暴露 ?? false);
  const 魔法名 = normalizeMagicName(girl.魔法名, 是否堕落, rawKey);
  const 真名 = normalizeText(girl.真名 ?? legacyRole.真名, '???');
  const key = normalizeMagicGirlKey(rawKey, 真名, 魔法名);
  const 心结 = mergeKnotMap(normalizeKnotMap(legacyRole.心结), normalizeKnotMap(girl.心结));
  const { 魔力, 魔力上限 } = normalizeMagicValue(girl.魔力, girl.魔力上限);

  return {
    key,
    value: {
      魔法名,
      真名,
      暴露,
      对主角的态度: normalizeAttitude(girl.对主角的态度 ?? legacyRole.对主角态度 ?? legacyRole.对user态度),
      是否堕落,
      精神极限,
      魔力,
      魔力上限,
      心结,
    },
  };
}

function normalizeMagicGirlMap(rawGirls, rawLegacyRoles) {
  const result = {};
  const girls = isRecord(rawGirls) ? rawGirls : {};
  const legacyRoles = isRecord(rawLegacyRoles) ? rawLegacyRoles : {};
  const keys = new Set([...Object.keys(girls), ...Object.keys(legacyRoles)]);

  for (const key of keys) {
    const entry = normalizeMagicGirlEntry(key, girls[key], legacyRoles[key]);
    result[entry.key] = mergeMagicGirlRecord(result[entry.key], entry.value);
  }

  return result;
}

function addFeeling(result, rawName, rawLevel) {
  const name = normalizeOptionalText(rawName);
  if (!name) {
    return;
  }

  result[name] = normalizeEmotionLevel(rawLevel);
}

function normalizeFeelingMap(rawFeelings) {
  const result = {};
  if (!isRecord(rawFeelings)) {
    return result;
  }

  for (const [rawName, rawValue] of Object.entries(rawFeelings)) {
    if (typeof rawValue === 'string') {
      addFeeling(result, rawName, rawValue);
      continue;
    }

    if (!isRecord(rawValue)) {
      addFeeling(result, rawName, rawValue);
      continue;
    }

    const legacyWords = Array.isArray(rawValue.感情) ? rawValue.感情 : [];
    if (legacyWords.length) {
      for (const word of legacyWords) {
        addFeeling(result, word, rawValue.强度);
      }
      continue;
    }

    addFeeling(result, rawName, rawValue.强度 ?? rawValue.等级 ?? rawValue);
  }

  return limitRecord(result, 3);
}

function normalizePresentCharacterMap(rawPresentCharacters) {
  const result = {};

  if (!isRecord(rawPresentCharacters)) {
    return result;
  }

  for (const [rawKey, rawValue] of Object.entries(rawPresentCharacters)) {
    const record = isRecord(rawValue) ? rawValue : {};
    const key = normalizeText(rawKey, '???');

    result[key] = {
      名称: normalizeText(record.名称 ?? record.显示名 ?? rawKey, '???'),
      是否变身: Boolean(record.是否变身 ?? record.变身 ?? false),
      感情: normalizeFeelingMap(record.感情 ?? record.感情标签),
      心声: normalizeThoughtText(record.心声),
      情欲: clamp(toNumber(record.情欲 ?? record.情欲值, 0), 0, 100),
    };
  }

  return result;
}

const SkillSchema = z
  .object({
    说明: z.string().prefault(''),
  })
  .prefault({ 说明: '' });

const KnotSchema = z
  .object({
    描述: z.string().prefault('???'),
    是否解开: z.boolean().prefault(false),
  })
  .transform(data => ({
    描述: data.是否解开 ? '' : normalizeText(data.描述, '???'),
    是否解开: data.是否解开,
  }))
  .prefault({ 描述: '???', 是否解开: false });

const LocationSchema = z
  .object({
    城市: z.string().prefault(DEFAULT_LOCATION.城市),
    地区: z.string().prefault(DEFAULT_LOCATION.地区),
    地址: z.string().prefault(DEFAULT_LOCATION.地址),
  })
  .transform(data => ({
    城市: normalizeText(data.城市, DEFAULT_LOCATION.城市),
    地区: normalizeText(data.地区, DEFAULT_LOCATION.地区),
    地址: normalizeText(data.地址, DEFAULT_LOCATION.地址),
  }))
  .prefault(DEFAULT_LOCATION);

const RavenSchema = z
  .object({
    魔力: z.coerce.number().transform(value => clamp(value, 0, 999)).prefault(100),
    魔力上限: z.coerce.number().transform(value => clamp(value, 0, 999)).prefault(100),
    技能: z.record(z.string().describe('技能名'), SkillSchema).prefault({}),
  })
  .transform(data => {
    const 魔力上限 = clamp(data.魔力上限, 0, 999);
    return {
      魔力: clamp(data.魔力, 0, 魔力上限),
      魔力上限,
      技能: data.技能,
    };
  })
  .prefault({
    魔力: 100,
    魔力上限: 100,
    技能: {},
  });

const MagicGirlSchema = z
  .object({
    魔法名: z.string().prefault('???'),
    真名: z.string().prefault('???'),
    暴露: z.boolean().prefault(false),
    对主角的态度: AttitudeSchema.prefault('陌生'),
    是否堕落: z.boolean().prefault(false),
    精神极限: z.boolean().prefault(false),
    魔力: z.coerce.number().transform(value => clamp(value, 0, 999)).prefault(100),
    魔力上限: z.coerce.number().transform(value => clamp(value, 0, 999)).prefault(100),
    心结: z.record(z.string().describe('心结名'), KnotSchema).prefault({}),
  })
  .transform(data => {
    const 魔力上限 = clamp(data.魔力上限, 0, 999);
    return {
      魔法名: normalizeText(data.魔法名, '???'),
      真名: normalizeText(data.真名, '???'),
      暴露: data.暴露,
      对主角的态度: normalizeAttitude(data.对主角的态度),
      是否堕落: data.是否堕落,
      精神极限: data.精神极限,
      魔力: clamp(data.魔力, 0, 魔力上限),
      魔力上限,
      心结: mergeKnotMap(data.心结),
    };
  })
  .prefault({
    魔法名: '???',
    真名: '???',
    暴露: false,
    对主角的态度: '陌生',
    是否堕落: false,
    精神极限: false,
    魔力: 100,
    魔力上限: 100,
    心结: {},
  });

const PresentCharacterSchema = z
  .object({
    名称: z.string().prefault('???'),
    是否变身: z.boolean().prefault(false),
    感情: z.record(z.string().describe('感情条目'), EmotionLevelSchema).prefault({}),
    心声: z.string().prefault('……'),
    情欲: z.coerce.number().transform(value => clamp(value, 0, 100)).prefault(0),
  })
  .transform(data => ({
    名称: normalizeText(data.名称, '???'),
    是否变身: data.是否变身,
    感情: limitRecord(data.感情, 3),
    心声: normalizeThoughtText(data.心声),
    情欲: clamp(data.情欲, 0, 100),
  }))
  .prefault({
    名称: '???',
    是否变身: false,
    感情: {},
    心声: '……',
    情欲: 0,
  });

const FinalSchema = z
  .object({
    地点: LocationSchema,
    橘雪莉: RavenSchema,
    魔法少女: z.record(z.string().describe('魔法少女标识名'), MagicGirlSchema).prefault({}),
    在场角色: z.record(z.string().describe('在场角色标识名'), PresentCharacterSchema).prefault({}),
  })
  .prefault({
    地点: DEFAULT_LOCATION,
    橘雪莉: {
      魔力: 100,
      魔力上限: 100,
      技能: {},
    },
    魔法少女: {},
    在场角色: {},
  });

const InputSchema = z
  .object({
    地点: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
    橘雪莉: z.record(z.string(), z.unknown()).optional(),
    魔法少女: z.record(z.string().describe('魔法少女标识名'), z.record(z.string(), z.unknown())).optional(),
    日常角色: z.record(z.string().describe('旧版角色名'), z.record(z.string(), z.unknown())).optional(),
    在场角色: z.record(z.string().describe('在场角色标识名'), z.record(z.string(), z.unknown())).optional(),
  })
  .prefault({});

export const Schema = InputSchema.transform(input =>
  FinalSchema.parse({
    地点: normalizeLocation(input.地点),
    橘雪莉: normalizeRaven(input.橘雪莉),
    魔法少女: normalizeMagicGirlMap(input.魔法少女, input.日常角色),
    在场角色: normalizePresentCharacterMap(input.在场角色),
  }),
);

function normalizeRaven(rawRaven) {
  const raven = isRecord(rawRaven) ? rawRaven : {};
  return {
    ...normalizeMagicValue(raven.魔力, raven.魔力上限),
    技能: normalizeSkillMap(raven.技能),
  };
}

$(() => {
  registerMvuSchema(Schema);
});
