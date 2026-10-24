/**
 * **Worth a glance at a whistle.** At the arena a period is "phones away";
 * the chat button carries a count, and one quiet line when somebody said
 * your name — the one kind of chat activity a person would want to know
 * about mid-period. Bot lines and joins are not mentions.
 */
/** Who, among these unread lines, said my name — by their name, if anyone did. */
export function mentioner(
  fresh: readonly { by?: string; text?: string }[],
  me: { readonly name: string } | undefined,
  people: readonly { readonly id: string; readonly name: string }[],
): string | null {
  const name = me?.name.trim().toLowerCase();
  if (!name) return null;
  const hit = fresh.find((m) =>
    (m.text ?? "")
      .toLowerCase()
      .split(/[^\p{L}\p{N}'’-]+/u)
      .includes(name),
  );
  if (!hit) return null;
  return people.find((p) => p.id === hit.by)?.name ?? "Somebody";
}
