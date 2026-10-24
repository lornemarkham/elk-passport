/**
 * **Chirp Bot's own material** — what it says when no model is configured,
 * when the model is slow, or when the rate limits say no.
 *
 * Every line has a stable id, and a line Chirp Bot posts from here is stored
 * as that id, never as text: the server renders it again on every read. So a
 * member who writes a "Chirp Bot" row straight into the database can only
 * make it say something already written here (`chirp.ts`).
 *
 * Placeholders: `{name}` the person it is about, `{team}` their team's
 * nickname, `{full}` city and nickname, `{target}` the person being chirped,
 * `{rival}` why two teams' fans hate each other (`fans.ts`).
 *
 * ## The rules this material keeps
 *
 * - **Roast the team, never the person.** Records, droughts, contracts,
 *   playoff history, the fan base as a fan base. Nothing about anybody's
 *   body, job, family, age, money, or anything they did not choose by
 *   cheering for a hockey team.
 * - **A fact is a fact.** Anything stated as history is long-settled record
 *   (Cup years, Finals, famous series). Anything about the last two seasons
 *   is in `STORYLINES`, with its source and the day it was checked, and
 *   stops being used after its `until`. Everything else is opinion or satire
 *   and is labelled so on the page.
 */

export interface LibraryLine {
  readonly id: string;
  readonly text: string;
}

const lines = (prefix: string, texts: readonly string[]): LibraryLine[] =>
  texts.map((text, i) => ({ id: `${prefix}.${i + 1}`, text }));

// ---------------------------------------------------------------- facts

export interface Storyline {
  readonly id: string;
  /** The verified fact, one sentence, as it is shown under the question. */
  readonly fact: string;
  readonly source: string;
  readonly url: string;
  /** The day somebody checked it against the source. */
  readonly verifiedOn: string;
  /** After this date the fact is history at best and stale at worst: not used. */
  readonly until: string;
  readonly teams: readonly string[];
}

/**
 * Current storylines, each checked against a published report on the date
 * given. Chirp Bot asks *questions* about these; the fact itself is shown as
 * a fact, with its source, and the joke is never mistaken for it.
 */
export const STORYLINES: readonly Storyline[] = [
  {
    id: "hughes-trade",
    fact: "Vancouver traded Quinn Hughes to Minnesota on 12 December 2025 for Marco Rossi, Zeev Buium, Liam Öhgren and a 2026 first-round pick.",
    source: "Global News",
    url: "https://globalnews.ca/news/11576557/canucks-trade-captain-quinn-hughes-to-wild/",
    verifiedOn: "2026-10-23",
    until: "2027-07-01",
    teams: ["VAN", "MIN"],
  },
  {
    id: "canucks-32nd",
    fact: "The Canucks finished the 2025–26 season 32nd of 32, at 25–49–8.",
    source: "The Hockey News",
    url: "https://thehockeynews.com/nhl/vancouver-canucks/game-day/canucks-close-out-2025-26-season-with-6-1-loss-to-the-edmonton-oilers",
    verifiedOn: "2026-10-23",
    until: "2027-07-01",
    teams: ["VAN"],
  },
  {
    id: "flames-sell",
    fact: "Calgary missed the 2025–26 playoffs and moved Nazem Kadri, MacKenzie Weegar and Rasmus Andersson before the deadline.",
    source: "PuckPedia",
    url: "https://puckpedia.com/news/2026-27-nhl-offseason-outlook-calgary-flames",
    verifiedOn: "2026-10-23",
    until: "2027-07-01",
    teams: ["CGY"],
  },
  {
    id: "huberdeau-contract",
    fact: "Jonathan Huberdeau's contract carries a $10.5 million cap hit through 2030–31.",
    source: "PuckPedia",
    url: "https://puckpedia.com/news/2026-27-nhl-offseason-outlook-calgary-flames",
    verifiedOn: "2026-10-23",
    until: "2027-07-01",
    teams: ["CGY"],
  },
  {
    id: "sabres-drought",
    fact: "Buffalo ended the longest playoff drought in NHL history, 14 seasons, in April 2026 — then lost Game 7 of the second round in overtime to Montréal.",
    source: "TSN / NHL.com",
    url: "https://www.tsn.ca/nhl/article/sabres-clinch-a-playoff-spot-to-end-the-longest-drought-in-nhl-history/",
    verifiedOn: "2026-10-23",
    until: "2027-07-01",
    teams: ["BUF", "MTL"],
  },
  {
    id: "canes-cup",
    fact: "Carolina won the 2026 Stanley Cup, beating Vegas in six; Jordan Staal, 37, won the Conn Smythe.",
    source: "NHL.com",
    url: "https://www.nhl.com/hurricanes/news/carolina-hurricanes-win-2026-stanley-cup-final",
    verifiedOn: "2026-10-23",
    until: "2027-07-01",
    teams: ["CAR", "VGK"],
  },
  {
    id: "marner-vegas",
    fact: "Mitch Marner, in his first season after leaving Toronto, led the 2026 playoffs in scoring with Vegas: 29 points in 22 games.",
    source: "The Hockey News",
    url: "https://thehockeynews.com/nhl/toronto-maple-leafs/latest-news/really-happy-for-him-maple-leafs-auston-matthews-and-john-tavares-reflect-on-mitch-marners-playoff-success-with-golden-knights",
    verifiedOn: "2026-10-23",
    until: "2027-07-01",
    teams: ["TOR", "VGK"],
  },
];

/** The storylines still current on `today` (YYYY-MM-DD). */
export function currentStorylines(today: string): Storyline[] {
  return STORYLINES.filter((s) => today <= s.until);
}

// ------------------------------------------------------------- welcomes

/** Said when someone declares a team. `{name}`, `{team}`, `{full}`. */
export const WELCOMES: Readonly<Record<string, readonly LibraryLine[]>> = {
  ANA: lines("w.ANA", [
    "A Ducks fan. Welcome, {name}. 2007 was a great year. Statistically, your best one.",
    "{name} bleeds for Anaheim. The franchise named after a Disney movie, which remains the least embarrassing thing about it.",
  ]),
  BOS: lines("w.BOS", [
    "A Bruins fan has entered a Vancouver building. {name}, the 2011 jokes are free tonight. Everyone else's are not.",
    "{name} is a Boston fan. Please be gentle; this room still has 2011 in its body.",
  ]),
  BUF: lines("w.BUF", [
    "A Sabres fan! {name} made the playoffs last spring and would like everyone to know they have recovered emotionally.",
    "{name} cheers for Buffalo. Fourteen years of waiting, one great spring, one overtime Game 7. Hockey is a beautiful liar.",
  ]),
  CGY: lines("w.CGY", [
    "BREAKING: A Calgary Flames fan has entered the building. Security has been notified.",
    "Welcome, {name}. Are we discussing the Flames' rebuild, or is that still a sensitive subject?",
    "{name} is a Flames fan at a Canucks game. This is either bravery or a cry for help, and Chirp Bot is here for both.",
  ]),
  CAR: lines("w.CAR", [
    "A Hurricanes fan. The defending champions. {name}, you are legally allowed to be insufferable until June.",
    "{name} cheers for Carolina, home of the bunch of jerks with a 2026 ring. Nobody here can say anything. Yet.",
  ]),
  CHI: lines("w.CHI", [
    "A Blackhawks fan. {name} still refers to 2010 to 2015 as 'recently'.",
    "{name} is here for Chicago. Three Cups in six years, and Canucks fans remember every one of those series.",
  ]),
  COL: lines("w.COL", [
    "{name} is an Avalanche fan, which means they have opinions about altitude and none about humility.",
    "A Colorado fan arrives. Welcome, {name}. 2022 was nice. We heard. Several times.",
  ]),
  CBJ: lines("w.CBJ", [
    "A Blue Jackets fan! {name} will now explain the 2019 sweep of Tampa, unprompted, for the ninth time this year.",
    "{name} cheers for Columbus. Somebody has to, and honestly, respect.",
  ]),
  DAL: lines("w.DAL", [
    "A Stars fan. {name}, Buffalo would like a word about 1999 and a skate in the crease.",
    "{name} is a Dallas fan: hockey in Texas, and they are good at it, which is still annoying to everyone in Canada.",
  ]),
  DET: lines("w.DET", [
    "A Red Wings fan. {name} has eleven Cups and has mentioned all of them in the last week.",
    "{name} cheers for Detroit. Hockeytown. A town. That has hockey. Some years more than others.",
  ]),
  EDM: lines("w.EDM", [
    "An Oilers fan is here. {name}, two straight Finals against Florida. How are we sleeping?",
    "{name} bleeds for Edmonton. Five Cups, all before most of this room could skate. McDavid has heard the jokes; you will too.",
  ]),
  FLA: lines("w.FLA", [
    "A Panthers fan. Two Cups in a row, 2024 and 2025. {name}, please keep the rat jokes to a minimum. We cannot.",
    "{name} cheers for Florida, where hockey is played next to a beach and nobody seems sorry about it.",
  ]),
  LAK: lines("w.LAK", [
    "A Kings fan. {name}, 2012 and 2014 were incredible. It is now later than that.",
    "{name} is here for Los Angeles, the only fan base that leaves early to beat traffic and calls it strategy.",
  ]),
  MIN: lines("w.MIN", [
    "A Wild fan in Vancouver. {name}, your team has Quinn Hughes now. Duck.",
    "{name} cheers for Minnesota. Welcome. Please do not mention the trade within earshot of anyone wearing a Hughes jersey with the tags still on.",
  ]),
  MTL: lines("w.MTL", [
    "A Canadiens fan. {name} has 24 Cups and will need about 24 minutes to explain them.",
    "{name} cheers for Montréal, the last Canadian team to win the Cup. In 1993. Every Canadian fan here just went quiet.",
  ]),
  NSH: lines("w.NSH", [
    "A Predators fan has arrived. {name}, please do not throw any catfish. Rogers Arena has a policy. Probably.",
    "{name} cheers for Nashville: country music, hot chicken, and a 2017 Final they would like to talk about.",
  ]),
  NJD: lines("w.NJD", [
    "A Devils fan. {name}, the Hughes brothers are two-thirds of the way to a family reunion, and Minnesota has the third.",
    "{name} is a New Jersey fan. Three Cups. One turnpike. Zero apologies.",
  ]),
  NYI: lines("w.NYI", [
    "An Islanders fan. Four straight Cups, 1980 to 1983. {name} has been waiting politely ever since.",
    "{name} cheers for the Islanders, the other New York team, and they would like you to stop calling it that.",
  ]),
  NYR: lines("w.NYR", [
    "A Rangers fan. {name}, 1994. Yes, we know. Vancouver knows best of all; that was the Final.",
    "{name} cheers for New York, the Rangers, who beat the Canucks in Game 7 in 1994. This room is going to be fine. Probably.",
  ]),
  OTT: lines("w.OTT", [
    "A Senators fan. {name} has driven to a hockey game in Kanata in February and survived.",
    "{name} cheers for Ottawa. Government town, hockey town, and occasionally both on the same night.",
  ]),
  PHI: lines("w.PHI", [
    "A Flyers fan. Last Cup: 1975. {name}, Gritty has been doing the heavy lifting for a while now.",
    "{name} is here for Philadelphia. Please do not climb any of Rogers Arena's poles; it's a hockey thing.",
  ]),
  PIT: lines("w.PIT", [
    "A Penguins fan. {name} has five Cups and the confidence of someone who peaked in 2017.",
    "{name} cheers for Pittsburgh, where Crosby has been the captain for so long he predates most of this group chat.",
  ]),
  SJS: lines("w.SJS", [
    "A Sharks fan. {name} has been through a lot. Celebrini helps. Mostly.",
    "{name} cheers for San Jose, still looking for its first Cup and remarkably good-humoured about it.",
  ]),
  SEA: lines("w.SEA", [
    "A Kraken fan. {name} picked a team in 2021 and has been carrying the Pacific Northwest's hockey self-esteem ever since.",
    "{name} cheers for Seattle. Three hours down the I-5 and somehow a completely different emotional climate.",
  ]),
  STL: lines("w.STL", [
    "A Blues fan. {name} was last in the league in January 2019 and lifted the Cup in June. Play Gloria, apparently.",
    "{name} cheers for St. Louis and will not stop humming Gloria. You have been warned.",
  ]),
  TBL: lines("w.TBL", [
    "A Lightning fan. {name}, three Cups. Also, Columbus 2019. Both are true.",
    "{name} cheers for Tampa Bay: back-to-back champions in 2020 and 2021, and still somehow sunburnt.",
  ]),
  TOR: lines("w.TOR", [
    "A Leafs fan has arrived. Someone get this person emotional support.",
    "{name} cheers for Toronto. Last Cup: 1967. The group is prepared to be supportive, but not that supportive.",
    "Welcome, {name}. Marner led the 2026 playoffs in scoring. For Vegas. Breathe.",
  ]),
  UTA: lines("w.UTA", [
    "A Mammoth fan. {name} has been a fan of this franchise under two names already and it's 2026.",
    "{name} cheers for Utah, the NHL's newest fan base, and frankly the least emotionally scarred one in the room.",
  ]),
  VAN: lines("w.VAN", [
    "Another Canucks fan. Excellent. The annual optimism experiment continues.",
    "{name} bleeds for Vancouver. 1982, 1994, 2011. Three Finals, zero parades, infinite belief.",
    "Welcome, {name}. A Canucks fan at a Canucks game. Brave of you, after last season.",
  ]),
  VGK: lines("w.VGK", [
    "A Golden Knights fan. {name}'s team made the Final in year one, won a Cup in year six, and has never known suffering. Disgusting.",
    "{name} cheers for Vegas. Last June went to Carolina. Some of us have waited since 1970, but sure, be sad.",
  ]),
  WSH: lines("w.WSH", [
    "A Capitals fan. {name}, Ovechkin passed Gretzky in April 2025. You may say it once.",
    "{name} cheers for Washington, home of a 2018 Cup and twenty years of Crosby arguments.",
  ]),
  WPG: lines("w.WPG", [
    "A Jets fan. {name} has driven through a Winnipeg winter, and this game is the least of their worries.",
    "{name} cheers for Winnipeg, the loudest building in the league and proud of it.",
  ]),
};

/** For any team, when its own lines are used up. */
export const GENERIC_WELCOMES = lines("g.w", [
  "{name} has declared for the {full}. Chirp Bot has opened a file.",
  "Noted: {name} bleeds for the {team}. This will be used against them.",
  "A {team} fan joins the chat. The rest of you, behave. Or don't.",
]);

/** When someone changes team. `{name}`, `{team}`. */
export const SWITCHES = lines("s", [
  "{name} has switched to the {team}. Bandwagon spotted at Rogers Arena.",
  "Hold on. {name} is a {team} fan now? Chirp Bot has seen this before. It never ends well.",
  "{name} changed teams mid-season. Bold. Unforgivable. Noted.",
]);

/** Someone arrives without a team yet. */
export const ARRIVALS = lines("a", [
  "{name} is here and has declared no allegiance. Who do you bleed for, {name}? The chat would like to know who to blame.",
  "{name} has arrived. No team yet. Suspicious. Neutral parties are how wars start.",
]);

// --------------------------------------------------------------- chirps

/** About the target's team. `{target}`. */
export const CHIRPS: Readonly<Record<string, readonly LibraryLine[]>> = {
  ANA: lines("c.ANA", [
    "{target}, your team was named after a movie, and the movie had the better power play.",
    "The Ducks' best season was 2007, {target}. You were cheering for a team that peaked before the iPhone.",
    "{target} cheers for Anaheim, which explains why they're used to empty seats and loud opinions.",
  ]),
  BOS: lines("c.BOS", [
    "{target}, nobody in this building wants to talk about 2011. Which is exactly why I just did.",
    "Bruins fans like {target} love hard-nosed hockey. Mostly from the safety of a bar stool.",
    "{target}'s team lost a Game 7 Final at home in 2019. To a team that was last in January. Sit with that.",
  ]),
  BUF: lines("c.BUF", [
    "{target} waited fourteen years for a playoff run and got one overtime too many. Hockey owes you nothing, {target}.",
    "Buffalo's last trip to the Final ended with a skate in the crease in 1999. {target} still says 'no goal' in their sleep.",
    "{target}, your team's longest streak was missing the playoffs. Congratulations on the sequel being better.",
  ]),
  CGY: lines("c.CGY", [
    "{target}, is Calgary rebuilding or simply existing?",
    "The Flames pay $10.5 million a year through 2030–31 for Huberdeau, {target}. You could buy a lot of arena beer with that. Almost one.",
    "{target}'s team sold Kadri, Weegar and Andersson at the deadline. That's not a rebuild, that's a garage sale with a jumbotron.",
    "Calgary's last Cup was 1989, {target}. The Saddledome is older than the plan.",
  ]),
  CAR: lines("c.CAR", [
    "{target}'s team won the Cup with a 37-year-old Conn Smythe. Nice. Your best player has a mortgage older than the rookies.",
    "Enjoy it, {target}. Last time Carolina won a Cup, they took twenty years to do it again.",
    "{target}, 'bunch of jerks' was an insult before your team made it a business plan.",
  ]),
  CHI: lines("c.CHI", [
    "{target} still has 2015 on their phone lock screen. It's been a while, champ.",
    "Chicago's dynasty ended a decade ago, {target}. You're allowed to stop doing the Chelsea Dagger dance.",
    "{target}, every Canucks fan here remembers 2009, 2010 and 2011. Buy them a drink. It's the least you can do.",
  ]),
  COL: lines("c.COL", [
    "{target}, your team plays at altitude, which is the only reason you're used to people looking down on you.",
    "The Avalanche won in 2022 and {target} has brought it up every winter since. It's on a loop.",
    "{target}'s franchise started in Québec. They didn't even win until they moved somewhere with skiing.",
  ]),
  CBJ: lines("c.CBJ", [
    "{target}, your greatest playoff moment was beating somebody else's dream. Respect, but it's a weird flex.",
    "Columbus has never won a Cup, {target}. Your cannon fires more often than your team wins a round.",
    "{target} is a Blue Jackets fan, which is less a hobby and more a test of character.",
  ]),
  DAL: lines("c.DAL", [
    "{target}'s team won a Cup in 1999 on a goal that half of hockey still doesn't count.",
    "Dallas: big state, big arena, big talk. {target}, it's been a minute since 1999.",
    "{target} cheers for a hockey team in Texas. In fairness, so do the Stars.",
  ]),
  DET: lines("c.DET", [
    "{target}, eleven Cups and not one since 2008. Hockeytown is now mostly Town.",
    "Red Wings fans like {target} talk about the '90s like they were there. They were. That's the problem.",
    "{target}, throwing an octopus isn't a strategy. It's seafood with ambition.",
  ]),
  EDM: lines("c.EDM", [
    "{target}, two straight Finals against the same team, two straight losses. Edmonton's favourite rerun.",
    "The Oilers' last Cup was 1990, {target}. McDavid wasn't born. Neither were half the people in this chat.",
    "{target} has McDavid and still had to watch Florida lift it twice. That's not bad luck, that's a pattern.",
  ]),
  FLA: lines("c.FLA", [
    "{target}'s team won two Cups in a row and still plays in front of people who leave for the beach.",
    "Florida hockey, {target}: rats on the ice in 1996, rings on the fingers now. Somehow both are weird.",
    "{target}, 'two-time defending champion' sounds impressive until you remember it means you're not defending anymore.",
  ]),
  LAK: lines("c.LAK", [
    "{target}'s team won in 2012 and 2014, which in LA terms is roughly the Stone Age.",
    "Kings fans like {target} arrive in the second period and leave in the third. Efficient.",
    "{target}, your team's biggest rivalry is the 405.",
  ]),
  MIN: lines("c.MIN", [
    "{target}, Minnesota got Quinn Hughes and Vancouver got your future. One of you is going to regret this, and it's funnier if it's you.",
    "The Wild have never won a Cup, {target}. They have, however, collected a lot of first-round exits.",
    "{target} cheers for the Wild, a name chosen because 'Mostly Mild' tested poorly.",
  ]),
  MTL: lines("c.MTL", [
    "{target}, 24 Cups, and the most recent one could legally rent a car.",
    "Habs fans like {target} measure time in 'since 1993'. So does the rest of Canada, sadly.",
    "{target}, your team beat Buffalo in a Game 7 overtime last spring. Brag about it. It's been a while since you've had a chance.",
  ]),
  NSH: lines("c.NSH", [
    "{target}'s fan base throws catfish on the ice. Nashville: where the seafood is louder than the playoff record.",
    "The Predators made the Final once, {target}, in 2017. You've played that song more than any country station.",
    "{target}, your team is in Music City and has never once been in tune in April.",
  ]),
  NJD: lines("c.NJD", [
    "{target}, New Jersey has two of the three Hughes brothers. Minnesota got the one with the Norris.",
    "New Jersey has three Cups, {target}, all from the era when the trap put everyone to sleep.",
    "{target} cheers for a team whose home city is mostly famous for being near another city.",
  ]),
  NYI: lines("c.NYI", [
    "{target}, four straight Cups in the early '80s. Let us know when the next one is. We'll wait. Apparently.",
    "Islanders fans like {target} have moved arenas more times than they've lifted the Cup since 1983. Which is to say: at all.",
    "{target}, your team is the other New York team. In hockey. In a city with two.",
  ]),
  NYR: lines("c.NYR", [
    "{target}, your team needed 54 years between Cups and hasn't won since 1994. Vancouver sends its regards. Through gritted teeth.",
    "The Rangers spend like a hedge fund and finish like a savings account, {target}.",
    "{target}, 'Original Six' sounds better than 'one Cup since 1940'.",
  ]),
  OTT: lines("c.OTT", [
    "{target}, the modern Senators have never won a Cup. The original ones did. In 1927. Close enough?",
    "Ottawa fans like {target} have mastered the art of hoping in a parliamentary fashion: slowly, with committees.",
    "{target}'s arena is in Kanata, which is technically Ottawa the way a parking lot is technically a park.",
  ]),
  PHI: lines("c.PHI", [
    "{target}, last Cup 1975. Gritty is the best thing your franchise has done since.",
    "Flyers fans like {target} booed Santa once. The team has been trying to match that energy ever since.",
    "{target}, the Broad Street Bullies were terrifying. In 1975. Your team has been running on that reputation for fifty years.",
  ]),
  PIT: lines("c.PIT", [
    "{target}, Crosby has been your captain since flip phones. Pittsburgh's long-term plan is 'Crosby, but older'.",
    "Penguins fans like {target} have five Cups and a fear of the word 'retire'.",
    "{target}, Crosby has been captain since 2007. The Penguins' succession plan is a prayer.",
  ]),
  SJS: lines("c.SJS", [
    "{target}, San Jose has been looking for its first Cup since 1991. Siri can't help you.",
    "The Sharks' 2016 Final is {target}'s whole personality. We get it. It was nice.",
    "{target}, cheering for San Jose is the hockey version of a startup that's always 'about to pivot'.",
  ]),
  SEA: lines("c.SEA", [
    "{target}'s team has existed since 2021 and still talks like it invented the Pacific Northwest.",
    "Kraken fans like {target} discovered hockey and Vancouver at the same time and somehow chose wrong.",
    "{target}, a team named after a mythical sea monster that, much like your playoff runs, rarely surfaces.",
  ]),
  STL: lines("c.STL", [
    "{target} played Gloria at their wedding. We know. We didn't even have to ask.",
    "The Blues were last in January and won the Cup in June, {target}. Lightning doesn't strike twice. Ask Tampa.",
    "{target}, St. Louis waited 52 years for one Cup. Respect. Now do it again before 2071.",
  ]),
  TBL: lines("c.TBL", [
    "{target}, 62 wins in 2019 and swept in the first round. By Columbus. Still the greatest choke in hockey.",
    "Lightning fans like {target} won back to back and still can't fill a sentence without mentioning the sweep. We can, though.",
    "{target}, three Cups, and a 2019 that nobody in Columbus will ever let you forget.",
  ]),
  TOR: lines("c.TOR", [
    "{target}, the Leafs haven't won the Cup since 1967. Your team's championship photo is in black and white.",
    "Marner led the playoffs in scoring, {target}. In Vegas. The Leafs' best playoff performer is now somebody else's.",
    "{target}, a Leafs fan's spring has four seasons: hope, belief, Game 7, therapy.",
    "Toronto calls itself the centre of the hockey universe, {target}. The universe hasn't returned the call since 1967.",
  ]),
  UTA: lines("c.UTA", [
    "{target}'s franchise has had three names in three seasons, if you count the Coyotes, which the league technically doesn't. Pick one and commit, like a fan should.",
    "Utah fans like {target} have been at this since 2024. Adorable. Ask a Canucks fan how 56 years feels.",
    "{target}, a Mammoth. Big, hairy, extinct. Let's see which one sticks.",
  ]),
  VAN: lines("c.VAN", [
    "{target}, the Canucks finished 32nd of 32 last season. Not a rebuild, a ranking.",
    "Vancouver traded its captain to Minnesota, {target}. The return is called 'the future'. In Vancouver, it's always called that.",
    "{target}'s team has made three Finals and lost all three. The Canucks are hockey's most loyal bridesmaid.",
    "{target}, 1970 to now and no Cup. The lineup's changed. The ending hasn't.",
  ]),
  VGK: lines("c.VGK", [
    "{target}, your team was built in a lab and still lost the Final in June. Even the robots choke.",
    "Golden Knights fans like {target} have suffered for literally months. Truly the most tortured fan base.",
    "{target}, a Cup in your sixth season. Some of us have been waiting since disco. Read the room.",
  ]),
  WSH: lines("c.WSH", [
    "{target}'s team took 44 years to win one Cup and celebrated in a fountain. Fair.",
    "Ovechkin passed Gretzky, {target}. Your whole personality has been that sentence since April 2025.",
    "{target}, the Caps' playoff history is mostly losing to Pittsburgh. Mostly.",
  ]),
  WPG: lines("c.WPG", [
    "{target}, the Jets have never been to a Final. The first Jets moved to Arizona. The second ones are keeping the tradition alive.",
    "Winnipeg fans like {target} white out the building every spring. The Final, meanwhile, remains a rumour.",
    "{target} cheers for a city where minus 30 is 'brisk' and a second-round exit is 'progress'.",
  ]),
};

/** Any team, by name. `{target}`, `{team}`. */
export const GENERIC_CHIRPS = lines("g.c", [
  "{target} cheers for the {team}. Not a choice Chirp Bot would make, but it's a free country.",
  "The {team}, {target}? Every year you say 'this is our year'. Statistically, you are always wrong.",
  "{target}, being a {team} fan is like holding a beer in a lineup: optimistic, sticky, and over-priced.",
]);

/** Sent by a fan of a rival team. `{target}`, `{team}`, `{rival}`. */
export const RIVAL_CHIRPS = lines("r.c", [
  "{target}, two words: {rival}. That's it. That's the chirp.",
  "A {team} fan, {target}? We're talking about {rival}. You should sit down.",
]);

/** The target has not declared a team. `{target}`. */
export const NO_TEAM_CHIRPS = lines("n.c", [
  "{target} hasn't picked a team. Cowardice dressed up as neutrality.",
  "{target} is 'just here for the vibes'. The vibes cost $19 a beer, {target}. Pick a side.",
  "{target}, no allegiance means no heartbreak, but also no personality.",
]);

// ------------------------------------------------------------ reactions

/** Two people made a challenge. `{name}` said it. */
export const CHALLENGE_LINES = lines("o.ch", [
  "A challenge has been issued. Chirp Bot is holding the receipts.",
  "{name} has made a bet. Chirp Bot is now legally a witness.",
  "That sounded like a bet, {name}. Screenshotting for the recap. Allegedly.",
]);

/** A bold prediction in the chat. `{name}`. */
export const BOLD_LINES = lines("o.bd", [
  "Bold prediction from {name}. Chirp Bot will remember this. Chirp Bot always remembers.",
  "{name} is very confident. Confidence is how every Canucks season starts.",
  "Bookmarking that, {name}. If you're right, you're a genius. If you're wrong, you're content.",
]);

/** Rival fans in the same conversation. `{a}`, `{b}` (team nicknames), `{rival}`. */
export const RIVALRY_LINES = lines("o.rv", [
  "{a} fans and {b} fans in one chat. Chirp Bot would like to remind everyone of {rival}. You're welcome.",
  "Ah, {a} versus {b}. Nothing says friendship like {rival}.",
]);

/** Shortly before puck drop. */
export const LAST_CALL = lines("l", [
  "Last call: picks lock at puck drop. Chirp Bot will be judging everyone who left it this late.",
  "Puck drop soon. If you haven't made your picks, you're either confident or lazy. The recap will decide.",
]);

// ------------------------------------------------- the rest of the night

/** Someone says they're watching from home. `{name}`. */
export const COUCH_LINES = lines("cw", [
  "{name} is joining from the couch. Best seat in the house: no line for the washroom, no $19 beer.",
  "The peanut gallery is open. {name} is heckling from home and Chirp Bot respects the commitment.",
  "{name} is watching from the couch. Remote chirping is still chirping. The Cup counts it.",
]);

/** Picks just locked: the boldest score call. `{name}`, `{pick}` ("7–1"). */
export const PICKS_LINES = lines("pk", [
  "Picks are sealed. {name} called it {pick}. Chirp Bot has notified the authorities.",
  "Puck drop. Picks are locked. Special mention to {name}, who went with {pick} and is either a prophet or a menace.",
  "And they're sealed. {name}: {pick}. Bold. Chirp Bot will read this out at the recap either way.",
]);

/** The game is over and the Cup has a leader. `{name}`, `{points}`. */
export const VERDICT_LINES = lines("fv", [
  "Final verdict: {name} takes the Sycle Cup with {points} points. Worth nothing. Contested bitterly. Engraving pending.",
  "The horn has gone and so has everyone's dignity except {name}'s. Sycle Cup champion, {points} points.",
  "Chirp Bot has reviewed the tape. {name} wins the night with {points} points. Appeals will be heard never.",
]);

/** Somebody moved their dinner vote. `{name}`, `{from}`, `{to}`. */
export const SWITCH_LINES = lines("o.sw", [
  "{name} has abandoned {from} for {to}. Loyalty is dead. Long live loyalty.",
  "Breaking: {name} flips from {from} to {to}. Chirp Bot smells a backroom deal.",
  "{name} was {from} five minutes ago. Now it's {to}. Somebody check on {from}.",
]);

/** Somebody pulled off their secret mission. `{name}` — never what it was. */
export const MISSION_LINES = lines("ms", [
  "{name} just completed a secret mission. Chirp Bot isn't allowed to say what. Chirp Bot is furious about that.",
  "Mission accomplished: {name}. Classified until further notice. Everyone act natural.",
  "{name} pulled off a secret mission and nobody noticed. That is the whole point and it's still unsettling.",
]);

/** Somebody did their dare or side quest. `{name}`. */
export const DONE_LINES = lines("dn", [
  "{name} actually did it. Challenge complete. Chirp Bot had money on them chickening out. (Chirp Bot has no money.)",
  "Challenge complete, {name}. Points on the board and receipts in the recap.",
  "{name} delivered. The rest of you have run out of excuses.",
]);

/** The Sycle Cup has a new outright leader during the night. `{name}`, `{points}`. */
export const LEAD_LINES = lines("ld", [
  "Lead change. {name} takes over the Sycle Cup with {points} points. The trophy is worthless and everyone wants it.",
  "{name} is top of the Sycle Cup now, {points} points. Chirp Bot is updating the group's grudges.",
  "New Cup leader: {name}, {points} points. Plenty of night left for this to go badly.",
]);

// -------------------------------------------------------------- prompts

export interface ControversyPrompt extends LibraryLine {
  /** Relevance: asked first when somebody in the room cheers for one of these, or one is playing. */
  readonly teams?: readonly string[];
  /** A verified fact shown under the question (`STORYLINES`). */
  readonly storyline?: string;
}

/**
 * **Questions worth arguing about.** Every one is an opinion question —
 * nobody is right — and the few that lean on something recent show the
 * verified fact underneath, with its source.
 */
export const PROMPTS: readonly ControversyPrompt[] = [
  {
    id: "p.hughes",
    text: "Hot take time: did Vancouver mishandle the Quinn Hughes situation?",
    teams: ["VAN", "MIN"],
    storyline: "hughes-trade",
  },
  {
    id: "p.cgy-rebuild",
    text: "Is Calgary rebuilding, or simply existing? Flames fans, you may approach the bench.",
    teams: ["CGY"],
    storyline: "flames-sell",
  },
  {
    id: "p.van-32",
    text: "Last place last season. Is this the year the Canucks are good again, or is optimism a medical condition here?",
    teams: ["VAN"],
    storyline: "canucks-32nd",
  },
  {
    id: "p.marner",
    text: "Leafs fans: is Marner's playoff run in Vegas the most Toronto thing that has ever happened?",
    teams: ["TOR", "VGK"],
    storyline: "marner-vegas",
  },
  {
    id: "p.sabres",
    text: "Fourteen years without the playoffs, then one great spring. Was it worth the wait, or is that worse?",
    teams: ["BUF", "MTL"],
    storyline: "sabres-drought",
  },
  {
    id: "p.canes",
    text: "The Hurricanes are the champs. Are they actually the best team, or the most annoying team that happened to win?",
    teams: ["CAR", "VGK"],
    storyline: "canes-cup",
  },
  {
    id: "p.delusional",
    text: "Which Canadian franchise has the most delusional fan base? Choose carefully. Some of them are in this chat.",
  },
  {
    id: "p.playoff-shame",
    text: "Which team has the most embarrassing playoff history? Name it, defend it, prepare to be wrong.",
  },
  {
    id: "p.beer",
    text: "Are arena beer prices completely ridiculous, or is $19 just the cost of watching history (losing)?",
  },
  {
    id: "p.overrated",
    text: "Who is the most overrated player in the NHL right now? No Canucks allowed. Too easy.",
  },
  {
    id: "p.fights",
    text: "Should fighting still be in hockey? Wrong answers only. Actually, any answers.",
  },
  {
    id: "p.original-six",
    text: "Original Six teams: hockey royalty, or just the oldest people at the party?",
  },
  {
    id: "p.shootout",
    text: "The shootout: thrilling, or the hockey equivalent of a coin toss with extra steps?",
  },
  {
    id: "p.jersey",
    text: "Best jersey in the league, and worst. One of each. No hedging.",
  },
  {
    id: "p.cup-next",
    text: "Which Canadian team ends the drought first? 1993 was a long time ago.",
  },
  {
    id: "p.bandwagon",
    text: "Is it ever OK to switch teams? Asking for someone in this chat, probably.",
  },
];

// ----------------------------------------------------------------- index

const ALL: LibraryLine[] = [
  ...Object.values(WELCOMES).flat(),
  ...GENERIC_WELCOMES,
  ...SWITCHES,
  ...ARRIVALS,
  ...Object.values(CHIRPS).flat(),
  ...GENERIC_CHIRPS,
  ...RIVAL_CHIRPS,
  ...NO_TEAM_CHIRPS,
  ...CHALLENGE_LINES,
  ...BOLD_LINES,
  ...RIVALRY_LINES,
  ...LAST_CALL,
  ...COUCH_LINES,
  ...PICKS_LINES,
  ...VERDICT_LINES,
  ...SWITCH_LINES,
  ...MISSION_LINES,
  ...DONE_LINES,
  ...LEAD_LINES,
  ...PROMPTS,
];

export const LIBRARY: ReadonlyMap<string, LibraryLine> = new Map(
  ALL.map((line) => [line.id, line]),
);

export const PROMPT_BY_ID: ReadonlyMap<string, ControversyPrompt> = new Map(
  PROMPTS.map((p) => [p.id, p]),
);

/**
 * Lines that say "last season", "last spring", "defending champions" or a
 * contract's numbers: true when written, stale later. Each is used only while
 * its storyline is current (`currentStorylines`).
 */
export const LINE_STORYLINE: Readonly<Record<string, string>> = {
  "w.BUF.1": "sabres-drought",
  "w.CAR.1": "canes-cup",
  "w.VAN.3": "canucks-32nd",
  "w.VGK.2": "canes-cup",
  "c.VAN.1": "canucks-32nd",
  "c.MTL.3": "sabres-drought",
  "c.CGY.2": "huberdeau-contract",
  "c.CGY.3": "flames-sell",
  "c.CAR.1": "canes-cup",
  "c.VGK.1": "canes-cup",
};

export const STORYLINE_BY_ID: ReadonlyMap<string, Storyline> = new Map(
  STORYLINES.map((s) => [s.id, s]),
);
