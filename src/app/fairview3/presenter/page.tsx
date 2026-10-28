import { Presenter } from "@/components/fairview3/Presenter";

export const dynamic = "force-dynamic";

/** The console. Guards itself with the presenter key; see components/fairview3/Presenter. */
export default function Fairview3PresenterPage() {
  return <Presenter />;
}
