# Local favourites — Long John's Pub and Alexander's Beach Pub

**Owner brief:** "PASSPORT — FEATURE TWO EARLY LOCAL SUPPORTERS" (2026-11-22,
mission 1007). **Lane:** passport (integration). **Authority:** the
[doctrine](../../PASSPORT-PRODUCT-DOCTRINE.md) §9 (featured hosts, 2026-11-08)
and §12; this record.

The brief, in one line: two Okanagan pubs that backed Passport early get
recommended where they fit — and they get cards that look like somewhere you
want to stop, not a directory row. These are editorial recommendations:
no partner, official or sponsored label, no invented specials, events, hours or
endorsements.

## Where things are

| What                   | Where                                                                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The list and its rules | `src/domain/featured/locals.ts` (`LOCAL_FAVOURITES`, `favouritesNear`, `favouritesOnMountain`) · tests `locals.test.ts`                                                   |
| Cards                  | `src/components/featured/LocalFavouriteCard.tsx`: `LocalFavouriteCard` (full), `LocalFavouriteStop(s)` (optional stop), `LocalFavourites`                                 |
| Destination pages      | **`/favourites/long-johns-pub`** · **`/favourites/alexanders-beach-pub`**. Shareable; the Atlas record `/passport/<id>` forwards here (`?atlas=1` shows Atlas's own page) |
| Go Have a Day          | Discovery, between the shelves after the featured hosts, when the place being looked from is within **30 km** (straight line)                                             |
| Christmas              | `/christmas/discover`, **"Warm up before or after"**, after every Christmas shelf, inside the search's own radius. Shown for all categories, Lights and Food only         |
| Snow Day               | Plan → Après (**"Après in the village"**) and **Around SilverStar**, on a SilverStar day only                                                                             |
| Sesh Wars              | SilverStar mountain screen, **"After the sesh"** (real and demo; a real place, not a rider)                                                                               |
| Phone e2e              | `e2e/local-favourites.spec.ts` (screenshots in `screenshots/`)                                                                                                            |

**Date Night is not connected, on purpose.** `/datenight` is one private
night (2 November 2026, already past) whose front door names no place. A pub
card there would advertise to a page that is not a place-led discovery.
Alexander's becomes a Date Night possibility on its own once Atlas places it,
because the Date Night mystery draws from placed Atlas venues near Vernon.

## Existing Atlas records (no duplicates made)

| Pub                   | Atlas Organization                     | What Atlas holds (prod, read 2026-11-22)                                                                                                                                                                              |
| --------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Long Johns Pub        | `a0c4c529-8cf6-4431-afdd-c559f0a63195` | subtype pub; "A pub at Silver Star offering a great happy hour menu."; **no location, website, phone, hours or photo**; sources tourismvernon.com (Jan, Valentine's articles)                                         |
| Alexander's Beach Pub | `f7f3967e-4eaf-4311-982f-572d2f4d1e70` | subtype pub; "A pub located next to Kalamalka Lake offering an extensive food and drink menu with lakeside views."; **no location, website, phone, hours or photo**; source tourismvernon.com/blog/vernons-top-patios |

Because neither has a location, Atlas cannot put either one in a Vernon or
SilverStar result today. That is the gap this record asks Atlas to close (below).
Note Atlas's "great happy hour menu" for Long John's is **not** repeated: it comes
from a 2026-09 tourism article, and the brief forbids stating specials.

## What was verified, and how (2026-11-22)

**Long John's Pub**

| Fact                 | Value                                                                                                                                                                                                                                                                                                                            | Sources                                                                  |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Website              | https://www.longjohnspub.com/                                                                                                                                                                                                                                                                                                    | the site itself; OpenStreetMap node 6045601454 `website`                 |
| Address              | 139 Main St, Silver Star Mountain Resort                                                                                                                                                                                                                                                                                         | the pub's site (home and About); OSM node 6045601454 (`139 Main Street`) |
| Point                | 50.35934, −119.059306                                                                                                                                                                                                                                                                                                            | OSM node 6045601454                                                      |
| Phone                | (250) 549-2992                                                                                                                                                                                                                                                                                                                   | the pub's site; OSM `+1-250-549-2992`                                    |
| Social               | instagram.com/longjohnspub_ · facebook.com/longjohnspubbc                                                                                                                                                                                                                                                                        | linked from the pub's site                                               |
| Listed by the resort | yes: "Long John's Pub" in SilverStar's dining list                                                                                                                                                                                                                                                                               | `src/domain/snow/resorts.ts` (read 2026-11-08)                           |
| Hours                | **not confirmed** — the site says "WINTER HOURS Open 7 Days 11 am - 10 pm" (site footer © 2018); OSM says `Mo-Tu,Th 11:00-18:00; We 11:00-20:30; Fr 11:00-19:30; Sa 11:00-22:00; Su 12:00-22:00`. They disagree, so the card says hours aren't confirmed and offers the phone, and the page quotes what the pub's own site says. |
| Photos               | three from the pub's own site (exterior sign, two pints, burger), credited "Photo: Long John's Pub", loaded from its own host (static.wixstatic.com). Photos of identifiable people were left out.                                                                                                                               |

**Alexander's Beach Pub**

| Fact    | Value                                                                                                                                                                              | Sources                                                                                                                          |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Name    | Alexander's Beach Pub                                                                                                                                                              | Atlas; Tourism Vernon. OSM calls it "Alexander's Pub and Liquor Store"; its Facebook page "Alexanders Beach PUB & Liquor Store"  |
| Address | 12408 Kalamalka Rd (mailing: Vernon; municipality: Coldstream)                                                                                                                     | MainMenus (third-party), other directories agree; OSM puts the pub on Kalamalka Road, Coldstream, V1B 1Y9                        |
| Point   | 50.23019, −119.26374 (by Kal Beach)                                                                                                                                                | OSM way 314473006 (Nominatim reverse agrees). MainMenus' own point (50.2554, −119.2623) is a postcode centroid and was not used. |
| Phone   | (250) 545-3131                                                                                                                                                                     | MainMenus; also Trip.com and a Vernon map guide (all third-party)                                                                |
| Website | **none found** — alexandersbeachpub.com and .ca do not resolve; the only owned link is the Facebook page                                                                           | Tourism Vernon links Facebook                                                                                                    |
| Hours   | **not published** anywhere readable                                                                                                                                                | —                                                                                                                                |
| Photos  | **none verified.** No photo of the pub was found on a page we could read; the card draws a lake instead of using somebody else's picture (doctrine §12, never an unrelated photo). |

Not stated, because only old customer reviews or directory tags say so:
Wednesday trivia, live music, darts and pool, the liquor store, weekend brunch
in winter.

## Request to Atlas (Atlas mission; Passport does not write Atlas)

For **Long Johns Pub** `a0c4c529-…` and **Alexander's Beach Pub** `f7f3967e-…`,
from the sources above:

1. A location (the OSM points above) so each appears in Vernon/SilverStar
   results, Christmas radii and the Snow "Around the mountain" pool.
2. Website (Long John's), phone, and the social links, as stated facts with sources.
3. Hours only as schedule statements the venue itself publishes, never
   inferred — Long John's site and OSM disagree today.
4. An `exact` photo where the venue's own site provides one (Long John's
   exterior: `8efbc0_9950020830c7415abecb25b5b621be7f~mv2_d_2250_1265_s_2.jpg` on
   static.wixstatic.com). Rights are the venue's; see the open question below.
5. Optionally, Long John's title with its apostrophe ("Long John's Pub"), the
   way the pub and SilverStar write it, keeping "Long Johns Pub" as an alias.

When Atlas holds these, `locals.ts` should read them from Atlas and keep only
the editorial parts (the line, where it is recommended, the label).

## Open questions for the owner

1. **Photo permission.** Long John's photos are its own marketing pictures,
   shown credited from its own host. Nobody has recorded permission. Please confirm
   with the pub, or send photos it would rather use. Alexander's needs photos
   from the pub. None were found.
2. **Saying they supported Passport.** The card says "Local favourite · our
   pick", which is true. Whether to also say they were early supporters is
   your call. The doctrine (§9) says a featured card must say why it is there.
3. **Alexander's identity and town.** The brief says "Alexanders Pub — Vernon".
   The only match is Alexander's Beach Pub at Kal Beach: mailing address Vernon,
   municipality Coldstream. It is shown as "Kal Beach, Kalamalka Lake, Vernon".
   Confirm that's the pub you meant.
4. **Long John's hours.** The pub's own site and OpenStreetMap disagree. One
   message to the pub would settle it, and the card would then state them.
