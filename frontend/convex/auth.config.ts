// Custom password auth — no OAuth providers.
// We handle auth entirely in customAuth.ts via bcryptjs + sessions table.
export default {
  providers: [],
};
