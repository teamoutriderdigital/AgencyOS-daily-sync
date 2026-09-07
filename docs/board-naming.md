# How things are named on the board

Kas, 31 August L10:

> "The naming conventions of a lot of things make zero sense, because it's written
> by AI, and so it's not human friendly. If you look at that top task,
> `security/access is 0/32 — scope the 32`, that doesn't mean anything to anybody."

He was right, and the first fix was too small: eleven legacy titles got reviewed
display names in `src/lib/board-language.ts`, which repaired those eleven and
taught nobody anything. This is the actual convention. It applies to every line
the board shows — typed by a person or generated from Plane.

## The seven rules

**1. Name the job, not the counter.** A title says what someone has to do. If
the reader can't tell what "done" looks like, it isn't a title yet.

> ✅ Finish and share the security setup skill
> ❌ Security/access is 0/32 — scope the 32 into a datable sprint

**2. No IDs, percentages or progress inside the sentence.** Numbers belong in
the deadline, the counts, or the reference at the end — never in the middle of
the name. A title that contains `0/32` goes stale the moment someone closes a
task.

**3. Put the reference last, in brackets.** People do need to find the thing in
Plane. `(SBD-304)` at the end of the line is findable and ignorable, which is
exactly what a reference should be.

> ✅ Google Ads: shift ad weighting toward mobile window tint — Kas, 23 days late (SBD-304)

**4. People by first name.** The room says "Rasika", not "Rasika Salinda", and
never a UUID. Two owners read as "Mubshar and Daniel"; more than two as
"Mubshar, Daniel +2". Nobody assigned reads **"no one on it"** — never blank,
never "Unassigned", because a blank looks like a rendering bug and "no one on
it" looks like the problem it is.

**5. Time in words, relative to today.** `2026-08-15` makes the reader do
arithmetic in a meeting.

| Situation | Say |
|---|---|
| Past its date | `23 days late` |
| Today | `due today` |
| Tomorrow | `due tomorrow` |
| Inside a week | `due Thursday` |
| Further out | `due 21 Sep` |
| No date in Plane | `no date set` |

**6. Never dress up a gap.** Missing owner, missing date, no subproject, no
Plane project, nothing touched in a month — each is said plainly, in the same
sentence as everything else. The board's job is to make gaps visible; a tidy
board that hides them is worse than an ugly one.

> ✅ Not in a subproject: Post 2 GBP — no one on it, 52 days late (SBD-287). 8 tasks here need filing
> ✅ There is no Plane project for this client, so none of the work is being tracked. Staff it or park it.

**7. Sentences, not labels.** Client headlines are read aloud. Two or three
short sentences, most alarming first: silence, then how much is late, then what
shipped.

> Nothing has moved here in 18 days. 17 of the 37 open tasks are late, and 20 have no date at all.

## Where the rules live in code

| Rule | Enforced by |
|---|---|
| 1, 2 — legacy titles | `src/lib/board-language.ts`, a reviewed display name per old title. The original text is preserved in the record; editing a title on the board saves the human's words. |
| 3, 4, 5, 6, 7 — generated lines | `buildClientCard`, `firstNames`, `whenPhrase` in `src/lib/subprojects.ts`, covered by `tests/subprojects.test.cjs`. |
| Subproject names | `subprojectName` in `src/lib/subprojects.ts`. Plane's delivery modules collapse into names the room uses — Design, Development, Go Live and Website Recovery all read as **Website**; Content Production and Content Publishing read as **SEO and content**. Anything unrecognised is kept verbatim rather than guessed at. |

## Naming a new item

Write the line you would say out loud if someone asked what needs doing. Then
check it against rules 1, 2 and 6. If it still contains a ratio, a percentage,
an ID in the middle, or a silent gap, it isn't ready.

If a title is already live and wrong, fix it in place on the board — the board
saves what you type. `board-language.ts` is only for the legacy backlog of
AI-written titles, and it should shrink over time, not grow.
