import { ChristmasNav } from "@/components/christmas/ChristmasNav";

/** Every Christmas page wears Christmas's own bar under the global header. */
export default function ChristmasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <ChristmasNav />
      {children}
    </>
  );
}
