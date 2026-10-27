import "server-only";

import { revalidateTag } from "next/cache";
import { parseRevalidateTags } from "@/lib/content-tags";
import { isValidRevalidateSecret } from "@/lib/revalidate-secret";

export async function POST(request: Request) {
  if (!isValidRevalidateSecret(request.headers.get("x-revalidate-secret"), process.env.REVALIDATE_SECRET)) {
    return Response.json({ revalidated: false }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ revalidated: false }, { status: 400 });
  }
  const tags = parseRevalidateTags(body);
  if (!tags) return Response.json({ revalidated: false }, { status: 400 });

  // 외부 시스템의 저장 직후 첫 방문자에게 새 값을 제공해야 하므로 즉시 만료한다.
  // "max"는 이전 값을 먼저 제공하고, updateTag는 Server Action 전용이므로 쓰지 않는다.
  for (const tag of tags) revalidateTag(tag, { expire: 0 });
  return Response.json({ revalidated: true, tags });
}
