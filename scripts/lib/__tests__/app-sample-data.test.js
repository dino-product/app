// #136 운영 코드에 예시(더미) 데이터를 두지 않는다. 화면의 작업·업체명·기사 이름은 API 응답으로만 온다.
// 운영 코드는 앱 진입점(index.js)에서 import·require 로 닿는 모듈이다 (Metro 가 번들에 넣는 범위).
// 테스트 전용 모듈(테스트·testing 헬퍼·픽스처)은 거기서 닿지 않아야 한다.
// src 를 읽는 검사지만 src 의 TypeScript 설정에는 Node 타입이 없어 fs 로 읽는 검사를 여기에 둔다
const fs = require('fs');
const path = require('path');
const { parseSync } = require('@babel/core');

const ROOT = path.resolve(__dirname, '../../..');
const ENTRY = 'index.js';

const CODE = /\.[jt]sx?$/;
// Metro 는 플랫폼마다 하나를 고르지만, 두 플랫폼을 함께 보도록 있는 것은 모두 따라간다
const PLATFORMS = ['.ios', '.android', '.native', ''];
const EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js', '.json'];

// 테스트 전용 모듈: 테스트·렌더 예산·터치 영역 테스트, testing 헬퍼, 화면 예시 픽스처(mockData), jest 설정
const TEST_ONLY = [
  /\.test\.[jt]sx?$/,
  /\.perf-test\.[jt]sx?$/,
  /(^|\/)testing(\/|\.[jt]sx?$)/,
  /Testing\.[jt]sx?$/,
  /(^|\/)mockData\.[jt]sx?$/,
  /(^|\/)__(tests|mocks)__\//,
  /^jest\//,
];
const isTestOnly = file => TEST_ONLY.some(pattern => pattern.test(file));

// 전에 운영 작업 저장소를 채우던 예시의 발주사·기사·고객 이름 (지금은 테스트 시드에만 있다).
// 작업 이름은 흔한 문구라(예: CTA 주석의 "에어컨 필터 교체 수락") 보지 않는다
const {
  LOCAL_ORGANIZATION_NAME,
  makeLocalSeed,
} = require('../../../src/features/work/data/localSeedTesting');

const SAMPLE_NAMES = [
  ...new Set(
    [
      LOCAL_ORGANIZATION_NAME,
      ...makeLocalSeed(new Date()).flatMap(work => [
        work.schedule?.technician?.name,
        work.customer?.name,
      ]),
    ].filter(Boolean),
  ),
];

const isFile = file => fs.existsSync(file) && fs.statSync(file).isFile();

function parserPlugins(file) {
  if (file.endsWith('.tsx')) {
    return ['typescript', 'jsx'];
  }
  return file.endsWith('.ts') ? ['typescript'] : ['jsx'];
}

// require()·import() 의 경로. 문자열이나 식 없는 템플릿 리터럴만 따라갈 수 있고, 그 밖의 동적 경로는 검사가 빠뜨리므로 실패한다
function staticPath(file, argument) {
  if (argument?.type === 'StringLiteral') {
    return argument.value;
  }
  if (
    argument?.type === 'TemplateLiteral' &&
    argument.expressions.length === 0
  ) {
    return argument.quasis[0].value.cooked;
  }
  throw new Error(`${file}: 따라갈 수 없는 가져오기 (${argument?.type})`);
}

// 모듈이 가져오는 경로: import(type 포함)·export … from, require(), import(), import x = require()
function specifiersOf(file, code) {
  const ast = parseSync(code, {
    filename: file,
    configFile: false,
    babelrc: false,
    sourceType: 'module',
    parserOpts: { plugins: parserPlugins(file) },
  });
  const found = [];
  const visit = node => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (!node || typeof node.type !== 'string') {
      return;
    }
    if (
      (node.type === 'ImportDeclaration' ||
        node.type === 'ExportNamedDeclaration' ||
        node.type === 'ExportAllDeclaration') &&
      node.source
    ) {
      found.push(node.source.value);
    }
    if (
      node.type === 'CallExpression' &&
      (node.callee.type === 'Import' ||
        (node.callee.type === 'Identifier' && node.callee.name === 'require'))
    ) {
      found.push(staticPath(file, node.arguments[0]));
    }
    // 파서 설정에 따라 import() 가 따로 된 노드로 온다
    if (node.type === 'ImportExpression') {
      found.push(staticPath(file, node.source));
    }
    if (node.type === 'TSExternalModuleReference') {
      found.push(node.expression.value);
    }
    Object.keys(node).forEach(key => {
      if (key !== 'loc' && key !== 'start' && key !== 'end') {
        visit(node[key]);
      }
    });
  };
  visit(ast.program);
  return found;
}

// 상대 경로만 따라간다 (패키지는 node_modules). 찾지 못하면 검사가 빠뜨린 것이라 실패한다
function resolve(from, specifier) {
  const base = path.resolve(path.dirname(from), specifier);
  const candidates = [
    base,
    ...PLATFORMS.flatMap(platform =>
      EXTENSIONS.map(extension => `${base}${platform}${extension}`),
    ),
    ...PLATFORMS.flatMap(platform =>
      EXTENSIONS.map(extension =>
        path.join(base, `index${platform}${extension}`),
      ),
    ),
  ].filter(isFile);
  if (candidates.length === 0) {
    throw new Error(
      `${path.relative(ROOT, from)} 의 '${specifier}' 를 찾지 못했다`,
    );
  }
  return candidates;
}

// 진입점에서 닿는 모든 파일 (저장소 루트 기준 경로)
function productionModules() {
  const seen = new Set();
  const queue = [path.join(ROOT, ENTRY)];
  while (queue.length > 0) {
    const file = queue.pop();
    if (seen.has(file)) {
      continue;
    }
    seen.add(file);
    if (!CODE.test(file)) {
      continue;
    }
    const code = fs.readFileSync(file, 'utf8');
    specifiersOf(file, code)
      .filter(specifier => specifier.startsWith('.'))
      .forEach(specifier => queue.push(...resolve(file, specifier)));
  }
  return [...seen].map(file => path.relative(ROOT, file)).sort();
}

const modules = productionModules();

describe('가져오는 경로 찾기 (검사가 빠뜨리지 않게)', () => {
  it('import·export from·require()·import()·템플릿 리터럴·import = require·import type 을 모두 찾는다', () => {
    const code = [
      "import a from './a';",
      "export * from './b';",
      "export { c } from './c';",
      "import type { D } from './d';",
      "const e = require('./e');",
      "import('./f');",
      'require(`./g`);',
      "import h = require('./h');",
    ].join('\n');

    expect(specifiersOf('sample.ts', code)).toEqual([
      './a',
      './b',
      './c',
      './d',
      './e',
      './f',
      './g',
      './h',
    ]);
  });

  it.each([
    ['require(name)', 'require(name);'],
    ['import(`./${name}`)', 'import(`./${name}`);'],
  ])('따라갈 수 없는 동적 경로(%s)면 실패한다', (_, code) => {
    expect(() => specifiersOf('sample.ts', code)).toThrow(
      '따라갈 수 없는 가져오기',
    );
  });
});

describe('운영 코드의 예시 데이터 (#136)', () => {
  it('진입점에서 앱과 작업 저장소까지 따라간다 (검사가 비어 통과하지 않게)', () => {
    expect(modules).toEqual(
      expect.arrayContaining([
        'src/app/App.tsx',
        'src/features/work/data/config.ts',
        'src/features/work/data/HttpWorkRepository.ts',
      ]),
    );
  });

  // #155 운영 작업 저장소는 기사 작업 API 다. 로컬 저장소는 테스트·픽스처가 주입할 때만 쓴다
  it('로컬 작업 저장소(LocalWorkRepository)를 가져오지 않는다', () => {
    expect(modules.filter(file => /LocalWorkRepository/.test(file))).toEqual(
      [],
    );
  });

  it('테스트 전용 모듈(테스트·testing 헬퍼·mockData)을 가져오지 않는다', () => {
    expect(modules.filter(isTestOnly)).toEqual([]);
  });

  it('작업 예시 시드(localSeed)를 가져오지 않는다', () => {
    expect(modules.filter(file => /localSeed/.test(file))).toEqual([]);
  });

  it('예시의 발주사·기사·고객 이름이 운영 코드에 없다', () => {
    // 이슈에서 화면에 보였던 이름이 시드에서 뽑혔는지 (검사가 비어 통과하지 않게)
    expect(SAMPLE_NAMES).toEqual(
      expect.arrayContaining(['한빛 설비', '김현수']),
    );
    const found = modules
      .filter(file => CODE.test(file))
      .flatMap(file => {
        const code = fs.readFileSync(path.join(ROOT, file), 'utf8');
        return SAMPLE_NAMES.filter(name => code.includes(name)).map(
          name => `${file}: ${name}`,
        );
      });

    expect(found).toEqual([]);
  });
});
