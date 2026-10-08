declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BEAUTY_BLOOM_TEST_OPERATOR_EMAIL?: string;
    BEAUTY_BLOOM_TEST_RECIPIENT?: string;
    BUCKET?: R2Bucket;
  }
}
