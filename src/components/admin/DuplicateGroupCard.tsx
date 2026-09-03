"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Tag, MapPinned, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { mergeEntities, type DuplicateGroup } from "@/lib/data/admin-repo";
import {
  fieldLabel,
  fieldNamesFor,
  fieldsDiffer,
  formatFieldValue,
  isImageField,
} from "./entityFieldFormat";

interface DuplicateGroupCardProps {
  group: DuplicateGroup;
  onMerged: () => void;
}

function ConfidenceBadge({ confidence }: { confidence: "high" | "medium" }) {
  return confidence === "high" ? (
    <Badge
      variant="outline"
      className="border-green-600 text-green-700 dark:text-green-400"
    >
      Likely the same
    </Badge>
  ) : (
    <Badge
      variant="outline"
      className="border-amber-500 text-amber-700 dark:text-amber-400"
    >
      Uncertain — please review
    </Badge>
  );
}

export function DuplicateGroupCard({
  group,
  onMerged,
}: DuplicateGroupCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [survivorId, setSurvivorId] = useState<string | null>(null);
  // field name -> id of the entity whose value should win. Only fields the
  // curator has actively picked need an entry; everything else falls back
  // to the survivor's own value at merge time.
  const [fieldChoices, setFieldChoices] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [merging, setMerging] = useState(false);

  const fieldNames = useMemo(
    () => fieldNamesFor(group.entities),
    [group.entities],
  );
  const differingFields = useMemo(
    () =>
      new Set(
        fieldNames.filter((field) => fieldsDiffer(group.entities, field)),
      ),
    [fieldNames, group.entities],
  );

  const survivor = group.entities.find((e) => e.id === survivorId) ?? null;

  // Fields where the curator actually picked a value other than the
  // survivor's own — used for both the merge request and the impact
  // summary, so what's promised on screen is exactly what gets sent.
  const overriddenFields = useMemo(() => {
    if (!survivor) return [];
    return [...differingFields].filter((field) => {
      const chosenId = fieldChoices[field] ?? survivor.id;
      return chosenId !== survivor.id;
    });
  }, [differingFields, fieldChoices, survivor]);

  function selectSurvivor(id: string) {
    setSurvivorId(id);
    // Field choices made against the previous survivor no longer make
    // sense — start clean rather than silently carry over a stale pick.
    setFieldChoices({});
  }

  async function handleMerge() {
    if (!survivor) return;
    const absorbedIds = group.entities
      .filter((e) => e.id !== survivor.id)
      .map((e) => e.id);

    const fieldOverrides: Record<string, unknown> = {};
    for (const field of overriddenFields) {
      const source = group.entities.find((e) => e.id === fieldChoices[field]);
      if (source) fieldOverrides[field] = source[field];
    }

    setMerging(true);
    try {
      await mergeEntities({
        survivingId: survivor.id,
        absorbedIds,
        fieldOverrides: Object.keys(fieldOverrides).length
          ? fieldOverrides
          : undefined,
        reason,
      });
      toast.success(
        `Merged ${absorbedIds.length + 1} "${group.name}" records into one.`,
      );
      onMerged();
    } catch (error) {
      console.error(`Failed to merge duplicate group "${group.name}":`, error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Merge failed. Please try again.",
      );
    } finally {
      setMerging(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>{group.name}</CardTitle>
            <Badge variant="secondary">{group.kind}</Badge>
            <Badge variant="secondary">{group.entities.length} records</Badge>
            <ConfidenceBadge confidence={group.confidence} />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "Collapse" : "Compare"}
          </Button>
        </div>

        {!expanded && differingFields.size > 0 && (
          <p className="text-muted-foreground mt-1 text-sm">
            Differs in: {[...differingFields].map(fieldLabel).join(", ")}
          </p>
        )}
      </CardHeader>

      {expanded && (
        <CardContent className="flex flex-col gap-5">
          {/* Why this group exists — a short evidence list, not one flat
              sentence, so a future signal (corroborating source count,
              a real distance number, ...) is a new row here later, not a
              redesign. Every row today is something Atlas actually
              checked — nothing here is estimated or invented. */}
          <ul className="bg-muted/30 flex flex-col gap-2 rounded-lg border p-3 text-sm">
            <li className="flex items-start gap-2">
              <Tag className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {/* Only said when it is true. A group can now also reach this
                    screen because someone nominated the pair for review, and
                    those records are named differently — claiming a shared name
                    would be the one line on this card a curator cannot check
                    against the table directly below it. */}
                {group.entities.every(
                  (entity) => entity.name === group.name,
                ) ? (
                  <>
                    Both entries are named{" "}
                    <span className="font-medium">
                      &quot;{group.name}&quot;
                    </span>
                  </>
                ) : (
                  <>
                    These entries are named differently:{" "}
                    <span className="font-medium">
                      {group.entities
                        .map((entity) => `"${entity.name}"`)
                        .join(" and ")}
                    </span>
                  </>
                )}
              </span>
            </li>
            <li className="flex items-start gap-2">
              <MapPinned className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
              <span>{group.matchReason}</span>
            </li>
          </ul>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="w-36 shrink-0 p-2 text-left align-bottom font-medium">
                    Field
                  </th>
                  {group.entities.map((entity) => (
                    <th
                      key={entity.id}
                      className="min-w-[220px] p-2 text-left align-bottom"
                    >
                      <label className="flex cursor-pointer items-center gap-1.5 font-medium">
                        <input
                          type="radio"
                          name={`survivor-${group.kind}-${group.name}`}
                          checked={survivorId === entity.id}
                          onChange={() => selectSurvivor(entity.id)}
                        />
                        {survivorId === entity.id
                          ? "Keeping this one"
                          : "Keep this one"}
                      </label>
                      <span className="text-muted-foreground font-mono text-xs">
                        {entity.id.slice(0, 8)}…
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fieldNames.map((field) => {
                  const rowDiffers = differingFields.has(field);
                  return (
                    <tr
                      key={field}
                      className={`border-b last:border-0 ${rowDiffers ? "bg-amber-50 dark:bg-amber-950/20" : ""}`}
                    >
                      <td className="text-muted-foreground p-2 align-top font-medium">
                        {fieldLabel(field)}
                      </td>
                      {group.entities.map((entity) => {
                        const value = entity[field];
                        const chosenId = fieldChoices[field] ?? survivor?.id;
                        const isChosen =
                          rowDiffers && survivor && chosenId === entity.id;
                        const content =
                          isImageField(field) &&
                          typeof value === "string" &&
                          value ? (
                            // eslint-disable-next-line @next/next/no-img-element -- external, unpredictable source images in an internal admin tool
                            <img
                              src={value}
                              alt=""
                              className="h-16 w-16 rounded object-cover"
                            />
                          ) : (
                            <span className="line-clamp-3">
                              {formatFieldValue(field, value)}
                            </span>
                          );

                        return (
                          <td key={entity.id} className="p-2 align-top">
                            {rowDiffers && survivor ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setFieldChoices((prev) => ({
                                    ...prev,
                                    [field]: entity.id,
                                  }))
                                }
                                className={`w-full rounded-md border p-1.5 text-left transition-colors ${
                                  isChosen
                                    ? "border-primary bg-primary/5"
                                    : "hover:border-border border-transparent"
                                }`}
                              >
                                {content}
                              </button>
                            ) : (
                              <div className="p-1.5">{content}</div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {differingFields.size > 0 && !survivor && (
            <p className="text-muted-foreground text-xs">
              Highlighted fields differ. Pick which record to keep above to
              choose which value wins for each.
            </p>
          )}

          {survivor && (
            <div className="bg-muted/30 flex flex-col gap-1.5 rounded-lg border p-3 text-sm">
              <p className="flex items-center gap-1.5 font-medium">
                <ShieldCheck className="h-4 w-4" />
                Before you merge
              </p>
              <ul className="text-muted-foreground list-disc pl-5">
                <li>
                  {group.entities.length - 1} record
                  {group.entities.length - 1 === 1 ? "" : "s"} will be archived,
                  not deleted — this can be reversed later if needed.
                </li>
                <li>
                  {overriddenFields.length === 0
                    ? "Every field will keep the kept record's own value."
                    : `${overriddenFields.length} field${overriddenFields.length === 1 ? "" : "s"} will use a value from a different record: ${overriddenFields.map(fieldLabel).join(", ")}.`}
                </li>
                <li>
                  Source links from the archived record(s) carry over to the one
                  you keep.
                </li>
              </ul>
            </div>
          )}

          <Separator />

          <div className="flex flex-col gap-2">
            <label
              htmlFor={`reason-${group.name}`}
              className="text-sm font-medium"
            >
              Why are you merging these? (required)
            </label>
            <Textarea
              id={`reason-${group.name}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="A short note for anyone reviewing this decision later."
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            <p className="text-muted-foreground mr-auto text-xs">
              {!survivor &&
                "Pick which record to keep above to enable merging."}
            </p>
            <Button
              disabled={!survivor || !reason.trim() || merging}
              onClick={handleMerge}
            >
              {merging ? "Merging…" : "Merge"}
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
