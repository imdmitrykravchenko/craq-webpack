import { RouteMiddleware } from 'router6';

const noBundle = () => Promise.resolve();

const webpackBuildClientMiddleware: (params: {
  bundles: Record<string, () => Promise<any>>;
}) => RouteMiddleware =
  ({ bundles }) =>
  () =>
  ({ to }, next) => {
    const bundle = bundles[to.config.bundle] || noBundle;

    return bundle().then(() => next());
  };

export default webpackBuildClientMiddleware;
