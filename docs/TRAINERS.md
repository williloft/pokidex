# Writing a trainer

Every trainer is one entry in `TRAINERS` in `src/lib/trainers.ts`. You write
**one** team of six; the difficulty tiers derive Easy and Hard from it. You
never write three rosters.

```ts
{
  id: 'tide',                    // unique, lowercase, never changes
  name: 'Noor',                  // what they are called
  title: 'Tidewarden',           // shown as "Tidewarden Noor"
  blurb: 'Patient, and happy to let you tire yourself out.',
  theme: 'water',                // a type name, or null for a mixed team
  team: ['blastoise', 'lapras', 'starmie', 'vaporeon', 'milotic', 'gyarados'],
  ace: 'rayquaza',               // optional; Hard only
}
```

## The one rule that matters

**Write `team` at the stage they field on Normal.** Usually that means fully
evolved. Everything else is derived:

| Tier | Evolution stage | Alternate forms | Legendaries |
| --- | --- | --- | --- |
| Easy | one stage *back* down the line | none at all | none |
| Normal | exactly what you wrote | allowed | none |
| Hard | exactly what you wrote | allowed | up to 2 |

So writing `charizard` gets you Charmeleon on Easy, Charizard on Normal, and
Mega or Gigantamax Charizard on Hard — from one word.

Stepping back stops at the bottom of the line, so a two-stage line lands on its
base (`arcanine` → Growlithe) and something with no evolutions stays itself
(`tauros` → Tauros). This uses the `line` field the data build writes for every
species, so it follows the real evolution chains, including branches.

## Names

`team` holds **species names exactly as PokéAPI spells them** — lowercase,
hyphenated: `porygon-z`, `mr-mime`, `ho-oh`. They are resolved against the
dataset that is loaded, so a typo does not crash anything: that slot is quietly
filled from the trainer's themed pool instead. If a trainer keeps fielding
something you did not write, check your spelling first.

Do not write form names here (`charizard-mega-x`). Forms are chosen by tier,
not by you.

## The ace

`ace` is a single legendary that **replaces the last name in `team`** on tiers
that allow one — it does not make the team seven. Below Hard it is simply left
at home and the original sixth is used.

It also gets **first claim on the Mega slot**, ahead of everyone else, because
the ace is the thing the tier is built around.

## Form limits

Per team, per battle:

- **one Mega**
- **one Gigantamax**

These are the same limits your own team is held to. After the ace, members are
offered a form strongest first: the Mega slot goes to the highest-stat member
that actually *has* a Mega, and the Gigantamax slot likewise. A member with
neither still gets a special form of its own if it has one (the Ash-Greninja
shape); regional forms are deliberately *not* picked this way, so the team on
the ladder card is the team that walks out.

## Order

The six are sorted **weakest first by base-stat total**, so the trainer's best
is the one you have to finish on. The order you write them in does not matter —
write them however reads best.

## Position on the ladder

Array order in `TRAINERS` *is* ladder order. Each rung is unlocked by beating
the one before it, and the **last entry is the champion** (it gets the crown on
its card). Insert a new trainer wherever their difficulty fits; put nothing
after the champion unless you mean to replace them.

## Template

```ts
{
  id: '',        // short, unique, lowercase
  name: '',
  title: '',     // one invented word reads best: Tidewarden, Stormcaller
  blurb: '',     // one line, in their voice — what they do to you, not their stats
  theme: null,   // a type, or null
  team: ['', '', '', '', '', ''],
},
```

Checklist before you commit:

- [ ] `id` is unique and not used by another trainer
- [ ] six names, all spelled as PokéAPI spells them
- [ ] written at the **Normal** stage (usually fully evolved)
- [ ] no form names, no duplicates
- [ ] if `theme` is set, every member actually has that type
- [ ] no legendary in `team` — use `ace`, or it is dropped below Hard and the
      slot is silently filled from the themed pool instead
- [ ] placed at the right rung, and not after the champion

## A note on who they are

The twelve in there are invented people — a name, a title and a line of voice.
If you want to base one on someone real, that is fine when they have actually
agreed to it; keep it to the name and persona they said yes to. Don't add
characters from the games or the anime as named trainers — the Pokémon data
itself is fair game for a Pokédex, but the characters are not ours to ship.
