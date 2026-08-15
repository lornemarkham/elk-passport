/**
 * The Entity Workspace shell.
 *
 * Deliberately a sibling of `/admin`, not a child of it. The
 * Curator Workbench layout wraps everything in `max-w-6xl`, which is the
 * direct cause of the cramping the workspace exists to fix — a knowledge
 * editor needs the full desktop width, and a nested layout can only ever
 * add constraints to its parent's, never remove them.
 *
 * Kept visually continuous with the Workbench (same eyebrow, same
 * background, same UI kit) so it reads as the same tool, not a second one.
 */
export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="bg-background min-h-screen">
      <div className="mx-auto max-w-[1800px] px-8 py-10">{children}</div>
    </main>
  );
}
