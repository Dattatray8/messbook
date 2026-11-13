/**
 * Jest-only stand-in for '@nestjs/mongoose'.
 *
 * @nestjs/mongoose v12 ships as ESM-only, which Jest's CommonJS runtime cannot load on Node < 24.9.
 * Unit tests here use hand-written model mocks, so they only need the decorators to be inert and
 * SchemaFactory to return an object that records `.index()` declarations (asserted in schema tests).
 * Production builds never use this file.
 */
export const InjectModel = () => () => undefined;
export const Prop = () => () => undefined;
export const Schema = () => () => undefined;
export const MongooseModule = {
  forFeature: () => ({}),
  forRootAsync: () => ({}),
};

export const SchemaFactory = {
  createForClass: () => {
    const indexes: Array<{
      fields: Record<string, unknown>;
      options: Record<string, unknown>;
    }> = [];
    return {
      indexes,
      index(
        fields: Record<string, unknown>,
        options: Record<string, unknown> = {},
      ) {
        indexes.push({ fields, options });
      },
    };
  },
};
