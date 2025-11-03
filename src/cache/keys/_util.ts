export const ns = (prefix: string) =>
  new Proxy(
    {},
    {
      get:
        (_target, prop: string) =>
        (...args: (string | number | boolean | undefined)[]) =>
          `${prefix}:${prop}:${args.filter((a) => a !== undefined).join(':')}`,
    },
  ) as Record<string, (...a: any[]) => string>;
