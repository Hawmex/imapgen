#! /usr/bin/env node

import { readFile, writeFile } from 'fs/promises';

type DependencyVersion = `${number}.${number}.${number}`;
type Dependency = `${string}@${DependencyVersion}`;

type PackageJSONDependencies =
  | {
      [key: string]: DependencyVersion;
    }
  | undefined;

const totalDependencies = new Map<Dependency, Set<Dependency>>();

const transformDependencies = (dependencies: PackageJSONDependencies) =>
  new Set(
    Object.entries(dependencies ?? {}).map(([name, version]): Dependency => `${name}@${version}`),
  );

const getDependencyName = (dependency: Dependency) => <string>dependency.split('@')[0];

const getDependencyVersion = (dependency: Dependency) =>
  <DependencyVersion>dependency.split('@')[1].slice(1);

const getUnpkgURL = (dependency: Dependency) => {
  const name = getDependencyName(dependency);
  const version = getDependencyVersion(dependency);
  return `https://unpkg.com/${name}@${version}/`;
};

const processDependency = async (dependency: Dependency) => {
  const packageJSON = await readFile(
    `node_modules/${getDependencyName(dependency)}/package.json`,
    'utf-8',
  );

  const packageData = <{ dependencies: PackageJSONDependencies }>JSON.parse(packageJSON);
  const subDependencies = transformDependencies(packageData.dependencies ?? {});

  totalDependencies.set(dependency, subDependencies);

  for (const dependency of subDependencies) await processDependency(dependency);
};

const getDependencyNameAndURL = (dependency: Dependency) => [
  `${getDependencyName(dependency)}/`,
  getUnpkgURL(dependency),
];

const packageJSON = await readFile('package.json', 'utf-8');
const packageData = JSON.parse(packageJSON);

const transformedDependencies = transformDependencies(
  <PackageJSONDependencies>packageData.dependencies,
);

for (const dependency of transformedDependencies) await processDependency(dependency);

const importmap = JSON.stringify({
  imports: transformedDependencies.size
    ? Object.fromEntries([...transformedDependencies].map(getDependencyNameAndURL))
    : undefined,
  scopes: totalDependencies.size
    ? Object.fromEntries(
        [...totalDependencies.entries()].map(([dependency, subDependencies]) => {
          return [
            getUnpkgURL(dependency),
            subDependencies.size
              ? Object.fromEntries([...subDependencies].map(getDependencyNameAndURL))
              : undefined,
          ];
        }),
      )
    : undefined,
});

await writeFile(`${process.argv[2]}/importmap.json`, importmap, 'utf-8');
