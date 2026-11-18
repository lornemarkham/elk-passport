"use client";

import type { Pulse } from "@/lib/pulse/model";
import { PulseRoom } from "@/app/labs/pulse/_ui/PulseRoom";
import { useCircle } from "./CheckShare";

/** The check's community poll: People's Pulse's own ballot and results. */
export function CheckPoll(props: {
  pulse: Pulse;
  ballot: string;
  via: string | null;
  path: string;
}) {
  const { setCircle } = useCircle();
  return (
    <PulseRoom
      pulse={props.pulse}
      ballot={props.ballot}
      via={props.via}
      fresh={false}
      embedded
      sharePath={props.path}
      onCircle={setCircle}
    />
  );
}
