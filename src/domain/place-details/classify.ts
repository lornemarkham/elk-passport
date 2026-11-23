import type { PlaceSectionId } from "./model";

/**
 * **Which visitor section a fact belongs in**, read from the words the
 * publisher used: the heading Atlas kept (`category`) first, then the label,
 * then — for short facts only — the value.
 *
 * Deliberately a sorting rule, not an interpretation. It moves a fact to the
 * heading a visitor looks under ("Food & drink", "Amenities"); it never
 * changes the fact, merges two, or claims anything the fact does not say. A
 * fact the rule cannot place is still shown, under "More about it".
 *
 * `hours`, `phone` and `website` are not sections: they are pulled out to the
 * page's own Hours and Contact, where a person expects them.
 */
export type FactPlace = PlaceSectionId | "hours" | "phone" | "website";

const RULES: readonly (readonly [FactPlace, RegExp])[] = [
  ["hours", /\b(hours?|opening|open (daily|from|until|year)|closed on)\b/i],
  ["phone", /\b(phone|telephone|tel|call us)\b/i],
  ["website", /^(website|web site|official site|homepage)$/i],
  ["menus", /\bmenus?\b/i],
  [
    "food-drink",
    /\b(food|drinks?|kitchen|cuisine|dish(es)?|eat(s|ery)?|dining|restaurant|burgers?|wings|pizza|nachos|poutine|fries|beers?|wines?|cocktails?|spirits|liquor|taps?|brew(ery|s)?|coffee|brunch|lunch|dinner|breakfast|desserts?|appeti[sz]ers?|happy hour|specials?|bar menu|full bar|vegan|vegetarian|gluten)\b/i,
  ],
  [
    "activities",
    /\b(activit(y|ies)|games?|pool tables?|billiards|darts|shuffleboard|sports?|tvs?|screens?|big screen|live music|music|bands?|karaoke|trivia|bingo|bowling|arcade|golf|ski(ing)?|hik(e|es|ing)|trails?|tours?|entertainment|events?|comedy|shows?|leagues?|squash|racquetball|tennis|pickleball|curling|dj|dance|watch the game|ufc|nhl|nfl)\b/i,
  ],
  [
    "amenities",
    /\b(patio|deck|terrace|parking|wi-?fi|accessib(le|ility)|wheelchair|restrooms?|washrooms?|family|families|kids|children|dogs?|pets?|seating|seats|view|views|fireplace|heated|private (room|events?)|banquet|lounge|liquor store|atm|ev charg)\b/i,
  ],
  [
    "visitor",
    /\b(price|prices|cost|admission|fee|reservations?|booking|book|age|19\+|minors|payment|cash|cards?|dress|rules|policy|policies|tickets?|season|seasonal|winter|summer|location|address|getting there|directions)\b/i,
  ],
];

const SHORT = 90;

/** The first rule any of the words match, searched in that order. */
export function placeOfFact(fact: {
  readonly label?: string;
  readonly category?: string;
  readonly value: string;
}): FactPlace {
  // The label is the publisher's word for this fact; the heading is theirs
  // for a group of them, so the label is asked first.
  const looks = [fact.label, fact.category].filter(
    (w): w is string => typeof w === "string" && w.trim().length > 0,
  );
  for (const words of looks) {
    for (const [place, rule] of RULES) {
      if (!rule.test(words)) continue;
      // "Menus" is for a menu someone can open; a paragraph about the food
      // is food and drink.
      if (
        place === "menus" &&
        !/https?:\/\//.test(fact.value) &&
        fact.value.length > SHORT
      )
        return "food-drink";
      return place;
    }
  }
  if (fact.value.length <= SHORT) {
    for (const [place, rule] of RULES) {
      // A value that mentions "open" is not an hours fact unless it says when.
      if (place === "hours" && !/\d/.test(fact.value)) continue;
      if (place === "phone" || place === "website" || place === "menus")
        continue;
      if (rule.test(fact.value)) return place;
    }
  }
  return "about";
}

/** A value that reads as a phone number: seven or more digits, little else. */
export function phoneIn(value: string): string | undefined {
  const match = value.match(/\+?1?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
  return match ? match[0].trim() : undefined;
}
