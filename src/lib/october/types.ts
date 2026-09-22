export type OctoberKind = "Place" | "Organization" | "Activity" | "Event";
export type OctoberState = "ahead" | "lived";

export interface OctoberThing {
  entityId: string;
  entityKind: OctoberKind;
  name: string;
  startsAt: string | null;
  state: OctoberState;
  wantedAt: string;
  livedAt: string | null;
}
