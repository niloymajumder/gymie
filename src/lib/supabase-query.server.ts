type QueryResult<T> = { data: T; error: { message: string } | null };

/**
 * Supabase/PostgREST occasionally rejects a freshly minted access token with
 * "JWT issued at future" when the auth server and the database host clocks are
 * a second or two apart. It is transient, so retry briefly instead of throwing
 * (which would blank the page).
 */
export async function withSkewRetry<T>(
  run: () => PromiseLike<QueryResult<T>>,
  attempts = 3,
): Promise<QueryResult<T>> {
  let result = await run();
  for (let i = 1; i < attempts; i++) {
    const message = result.error?.message ?? "";
    if (!/issued at future|not yet valid|before .*nbf/i.test(message)) break;
    await new Promise((resolve) => setTimeout(resolve, 400 * i));
    result = await run();
  }
  return result;
}
