import fs from 'fs';
import { RouteMiddleware } from 'router6';

type Chunks = Record<string, string[]>;

const hasExt = (ext) => (link) => link.split('.').pop() === ext;
const isJs = hasExt('js');
const isCss = hasExt('css');

const getStaticReducer =
  (
    assetsByChunkName: Chunks,
    pred: (bundle: string) => boolean,
    additionalChunk?: string,
  ) =>
  (set: Set<string>, chunkName) =>
    [
      ...(assetsByChunkName[additionalChunk] || []).filter(pred),
      ...(assetsByChunkName[chunkName] || []).filter(pred),
    ].reduce((result: Set<string>, link: string) => result.add(link), set);

const addAssetsPath = (assetsPath: string, path: string) =>
  `/${[assetsPath, path].join('/')}`;

const getStats = (statsFile: {
  path?: string;
  content?: Chunks;
}): Promise<Chunks> => {
  if (!statsFile) {
    return Promise.resolve({});
  }

  if (statsFile.content) {
    return Promise.resolve(statsFile.content);
  }

  console.log('attempt to parse stats', statsFile);

  if (fs.existsSync(statsFile.path)) {
    return Promise.resolve(
      JSON.parse(fs.readFileSync(statsFile.path).toString()),
    );
  }

  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(getStats(statsFile));
    }, 1000);
  });
};

const webpackBuildServerMiddleware: (params: {
  bundles: Record<string, () => Promise<any>>;
  assetsPath: string;
  commonChunks?: string[];
  statsFile: {
    path?: string;
    content?: Chunks;
  };
}) => RouteMiddleware = ({
  statsFile,
  assetsPath,
  bundles,
  commonChunks = [],
}) => {
  const loading = Promise.all(
    Object.values(bundles).map((bundle) => bundle()),
  ).then(() => getStats(statsFile));

  return () =>
    async ({ to, context }, next) => {
      const assetsByChunkName = await loading;

      commonChunks
        .reduce(
          getStaticReducer(assetsByChunkName, isCss, to.config.bundle),
          new Set<string>(),
        )
        .forEach((href) => {
          context.head.addLink({
            href: addAssetsPath(assetsPath, href),
            rel: 'stylesheet',
          });
        });

      commonChunks
        .reduce(
          getStaticReducer(assetsByChunkName, isJs, to.config.bundle),
          new Set<string>(),
        )
        .forEach((src) => {
          context.head.addScript({
            src: addAssetsPath(assetsPath, src),
            attributes: { defer: true },
          });
        });

      next();
    };
};

export default webpackBuildServerMiddleware;
