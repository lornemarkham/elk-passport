import { redirect } from "next/navigation";

/**
 * **`/labs/conference`: the Labs door into GO HAVE A CONFERENCE.**
 *
 * The product lives at `/conferences`, and every link it hands out (invites,
 * sign-in `next=`) points there. This is only the name it goes by in Labs.
 */
export default function LabsConference() {
  redirect("/conferences");
}
