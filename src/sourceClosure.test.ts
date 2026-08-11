import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sourceModules = import.meta.glob('./**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const retiredModulePaths = [
  '/machine/',
  '/loops/',
  '/hooks/',
  '/motion/',
  '/ProjectDetailDialog.tsx',
  '/motion.ts',
  '/motion.test.ts',
  '/content/projectDiscovery.ts',
  '/content/projectDiscovery.test.ts',
  '/content/cartridges.ts',
  '/content/cartridges.test.ts',
] as const

const GLOBALLY_FORBIDDEN_DEPENDENCIES = [
  '@react-three/fiber',
  '@types/three',
] as const

const PLAYGROUND_SCOPED_DEPENDENCIES = [
  'gsap',
  'three',
] as const

const ABSENT_DEPENDENCIES = [
  ...GLOBALLY_FORBIDDEN_DEPENDENCIES,
  ...PLAYGROUND_SCOPED_DEPENDENCIES,
] as const

const PACKAGE_ABSENT_DEPENDENCIES = [
  ...GLOBALLY_FORBIDDEN_DEPENDENCIES,
] as const

const GSAP_VERSION = '3.15.0'
const GSAP_RESOLVED = 'https://registry.npmjs.org/gsap/-/gsap-3.15.0.tgz'
const GSAP_INTEGRITY =
  'sha512-dMW4CWBTUK1AEEDeZc1g4xpPGIrSf9fJF960qbTZmN/QwZIWY5wgliS6JWl9/25fpTGJrMRtSjGtOmPnfjZB+A=='
const THREE_VERSION = '0.185.1'
const THREE_RESOLVED =
  'https://registry.npmjs.org/three/-/three-0.185.1.tgz'
const THREE_INTEGRITY =
  'sha512-5aojFCXKwnjBRZvUnt3WFfEcvUJgkN5LlijRFN95hMy8WVkG4I0QNcJE+OuWvuJ0bOdStrbfXn0pkd6/QyiAlg=='

const packageSource = readFileSync(
  new URL('../package.json', import.meta.url),
  'utf8',
)
const lockSource = readFileSync(
  new URL('../package-lock.json', import.meta.url),
  'utf8',
)

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function dependencyImportPatterns(dependency: string) {
  const specifier = `${escapeRegExp(dependency)}(?:/[^'"\\s]+)?`

  return [
    new RegExp(`\\bimport\\s*['"]${specifier}['"]`),
    new RegExp(`\\bfrom\\s*['"]${specifier}['"]`),
    new RegExp(`\\b(?:import|require)\\s*\\(\\s*['"]${specifier}['"]`),
  ]
}

function importsRetiredDependency(source: string, dependency: string) {
  return dependencyImportPatterns(dependency).some((pattern) =>
    pattern.test(source),
  )
}

function importsForbiddenDependency(
  modulePath: string,
  source: string,
  dependency: string,
) {
  if (!importsRetiredDependency(source, dependency)) return false

  const routeScoped = (
    PLAYGROUND_SCOPED_DEPENDENCIES as readonly string[]
  ).includes(dependency)
  return !routeScoped || !modulePath.startsWith('./playground/')
}

describe('retired source closure', () => {
  it('contains none of the retired runtime modules', () => {
    const modulePaths = Object.keys(sourceModules)

    for (const retiredPath of retiredModulePaths) {
      expect(modulePaths.some((path) => path.includes(retiredPath))).toBe(false)
    }
  })

  it('rejects side-effect, from, dynamic, require, bare, and subpath imports', () => {
    for (const [path, source] of Object.entries(sourceModules)) {
      if (path.endsWith('/sourceClosure.test.ts')) continue

      for (const dependency of ABSENT_DEPENDENCIES) {
        expect(
          importsForbiddenDependency(path, source, dependency),
          `${path} imports ${dependency}`,
        ).toBe(false)
      }
    }
  })

  it('recognizes every forbidden import shape for bare and subpath specifiers', () => {
    for (const dependency of ABSENT_DEPENDENCIES) {
      const examples = [
        `import '${dependency}'`,
        `import value from "${dependency}/subpath"`,
        `const value = import('${dependency}')`,
        `const value = require("${dependency}/subpath")`,
      ]

      for (const example of examples) {
        expect(importsRetiredDependency(example, dependency)).toBe(true)
      }
    }
  })

  it('exposes gsap through exactly one route-local production module', () => {
    const importingModules = Object.entries(sourceModules)
      .filter(
        ([path]) =>
          path !== './sourceClosure.test.ts' && !path.endsWith('.test.ts'),
      )
      .filter(([, source]) => importsRetiredDependency(source, 'gsap'))
      .map(([path]) => path)
      .sort()

    expect(importingModules).toEqual([
      './playground/loadRelayRuntime.ts',
    ])
  })

  it('exposes Three through one independent route-local dynamic loader', () => {
    const importingModules = Object.entries(sourceModules)
      .filter(
        ([path]) =>
          path !== './sourceClosure.test.ts' && !path.endsWith('.test.ts'),
      )
      .filter(([, source]) => importsRetiredDependency(source, 'three'))
      .map(([path]) => path)

    expect(importingModules).toEqual([
      './playground/loadSystemFieldRuntime.ts',
    ])
    expect(sourceModules['./playground/loadSystemFieldRuntime.ts'].match(
      /import\(['"]three['"]\)/g,
    )).toHaveLength(1)
    expect(sourceModules['./playground/loadRelayRuntime.ts']).not.toContain(
      "import('three')",
    )
    expect(sourceModules['./playground/three.d.ts']).toContain(
      "declare module 'three'",
    )
  })

  it('permits gsap and three only below the route-local runtime root', () => {
    for (const dependency of PLAYGROUND_SCOPED_DEPENDENCIES) {
      const source = `import value from '${dependency}/subpath'`

      expect(
        importsForbiddenDependency(
          './playground/runtime.ts',
          source,
          dependency,
        ),
      ).toBe(false)
      expect(
        importsForbiddenDependency(
          './pages/Playground.tsx',
          source,
          dependency,
        ),
      ).toBe(true)
      expect(
        importsForbiddenDependency(
          './content/routes.ts',
          source,
          dependency,
        ),
      ).toBe(true)
    }

    for (const dependency of GLOBALLY_FORBIDDEN_DEPENDENCIES) {
      expect(
        importsForbiddenDependency(
          './playground/runtime.ts',
          `import '${dependency}'`,
          dependency,
        ),
      ).toBe(true)
    }
  })

  it('preserves exact package scripts and dependency closure', () => {
    const packageJson = JSON.parse(packageSource) as {
      scripts: Record<string, string>
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }
    const packageLock = JSON.parse(lockSource) as {
      packages: Record<
        string,
        {
          dependencies?: Record<string, string>
          version?: string
          resolved?: string
          integrity?: string
        }
      >
    }
    const declaredDependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    }

    expect(packageJson.scripts).toEqual({
      dev: 'vite',
      test: 'vitest run',
      check: 'tsc --noEmit',
      build: 'tsc --noEmit && vite build',
    })

    expect(packageJson.dependencies?.gsap).toBe(GSAP_VERSION)
    expect(packageJson.devDependencies?.gsap).toBeUndefined()
    expect(packageLock.packages[''].dependencies?.gsap).toBe(GSAP_VERSION)
    expect(packageLock.packages['node_modules/gsap']).toMatchObject({
      version: GSAP_VERSION,
      resolved: GSAP_RESOLVED,
      integrity: GSAP_INTEGRITY,
    })
    expect(packageJson.dependencies?.three).toBe(THREE_VERSION)
    expect(packageJson.devDependencies?.three).toBeUndefined()
    expect(packageLock.packages[''].dependencies?.three).toBe(THREE_VERSION)
    expect(packageLock.packages['node_modules/three']).toMatchObject({
      version: THREE_VERSION,
      resolved: THREE_RESOLVED,
      integrity: THREE_INTEGRITY,
    })

    for (const dependency of PACKAGE_ABSENT_DEPENDENCIES) {
      expect(declaredDependencies).not.toHaveProperty(dependency)
      expect(packageLock.packages).not.toHaveProperty(
        `node_modules/${dependency}`,
      )
    }
  })
})
