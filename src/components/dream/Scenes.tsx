"use client";

import type { DreamCard, DreamScene } from "@/domain/dream/compose";
import { Photo } from "./Photo";
import styles from "./dream.module.css";

const kmLine = (card: DreamCard, further?: boolean) =>
  card.km !== undefined
    ? `${card.km < 1 ? card.km.toFixed(1) : Math.round(card.km)} km${further ? " · further than you asked" : ""}`
    : card.locality
      ? `In ${card.locality}`
      : "Atlas hasn't placed it";

/**
 * **One scene per thing somebody named** — the lead as a photograph you
 * could walk into, its practical facts beneath it, and the other real
 * choices beside it. Tapping a choice makes it the lead and puts it in the
 * day; *not this one* takes it out of everything.
 */
export function Scenes({
  scenes,
  chosen,
  onChoose,
  onRefuse,
}: {
  scenes: readonly DreamScene[];
  /** The id each scene leads with, where the person picked one. */
  chosen: Readonly<Record<string, string>>;
  onChoose: (scene: DreamScene, card: DreamCard) => void;
  onRefuse: (card: DreamCard) => void;
}) {
  return (
    <div className={styles.scenes}>
      {scenes.map((scene, i) => {
        const all = [...scene.near, ...scene.further];
        const lead =
          all.find((c) => c.id === chosen[scene.id]) ??
          scene.near.find((c) => !c.notOnDay) ??
          all[0];
        const further = lead
          ? scene.further.some((c) => c.id === lead.id)
          : false;
        return (
          <section
            key={scene.id}
            className={styles.scene}
            style={{ animationDelay: `${i * 90}ms` }}
            aria-labelledby={`scene-${scene.id}`}
          >
            <p className={styles.kicker} id={`scene-${scene.id}`}>
              {scene.label}
            </p>
            {scene.gap ? <p className={styles.gap}>{scene.gap}</p> : null}
            {lead ? (
              <article className={styles.lead}>
                <a
                  className={styles.leadPicture}
                  href={lead.href ?? "#"}
                  aria-label={`${lead.title} — details`}
                >
                  <Photo
                    photo={lead.photo}
                    alt={lead.title}
                    priority={i === 0}
                    className={styles.leadPhoto}
                  />
                  <span className={styles.leadScrim} aria-hidden />
                  <span className={styles.leadTitle}>{lead.title}</span>
                </a>
                <div className={styles.leadBody}>
                  <p className={styles.where}>
                    {lead.subtype ? `${lead.subtype} · ` : ""}
                    {kmLine(lead, further)}
                    {lead.free ? " · free" : ""}
                  </p>
                  {lead.listed.length > 0 ? (
                    <p className={styles.evidence}>
                      Atlas lists <q>{lead.listed.slice(0, 2).join("”, “")}</q>
                    </p>
                  ) : null}
                  {lead.notOnDay ? (
                    <p className={styles.warn}>
                      Not on the day you asked about.
                    </p>
                  ) : null}
                  {lead.line ? (
                    <p className={styles.line}>{lead.line}</p>
                  ) : null}
                  {lead.facts.length > 0 ? (
                    <ul className={styles.facts}>
                      {lead.facts.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                  ) : null}
                  <div className={styles.actions}>
                    {lead.directions ? (
                      <a
                        className={styles.action}
                        href={lead.directions}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Directions
                      </a>
                    ) : null}
                    {lead.href ? (
                      <a className={styles.action} href={lead.href}>
                        Hours &amp; details
                      </a>
                    ) : null}
                    <button
                      type="button"
                      className={styles.actionQuiet}
                      onClick={() => onRefuse(lead)}
                    >
                      Not this one
                    </button>
                  </div>
                </div>
              </article>
            ) : null}
            {all.length > 1 ? (
              <div
                className={styles.shelf}
                role="list"
                aria-label={`Other choices for ${scene.label}`}
              >
                {all
                  .filter((c) => c.id !== lead?.id)
                  .map((card) => (
                    <button
                      key={card.id}
                      type="button"
                      role="listitem"
                      className={styles.choice}
                      onClick={() => onChoose(scene, card)}
                    >
                      <Photo
                        photo={card.photo}
                        alt=""
                        className={styles.choicePhoto}
                      />
                      <span className={styles.choiceTitle}>{card.title}</span>
                      <span className={styles.choiceWhere}>
                        {kmLine(
                          card,
                          scene.further.some((f) => f.id === card.id),
                        )}
                        {card.notOnDay ? " · other days" : ""}
                      </span>
                    </button>
                  ))}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
