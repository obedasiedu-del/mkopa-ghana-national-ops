---
name: brag
description: Turn recent git history on this repo into a short, non-technical "here's what shipped" update for the Ghana retail ops business stakeholder -- the kind of summary you'd paste into a chat or share with the team. Use this whenever the user says /brag, asks "what did we ship", "what's new", "give me a summary for the team/stakeholder", "what did we build today/this week", or wants a plain-language recap of recent work instead of a commit log. Always use it instead of just running `git log` and pasting the output -- the whole point is translating engineer-facing commit messages into outcomes a non-technical reader cares about.
---

# Brag

Turn what actually happened in the repo into an update someone who has never opened the code
could read and feel informed, not talked down to. The audience is a Ghana retail ops business
stakeholder (the person who owns this dashboard, not an engineer) -- so a commit message full
of "RLS policy", "lazy-loaded chunk" or "fn_can_read_depot" is not a usable sentence here even
if it's the literal truth. Your job is to find the sentence underneath it: what can someone
*do* now that they couldn't before, or what stopped going wrong.

## 1. Figure out the window

Default to **today** unless the user says otherwise ("this week", "since Monday", "last 10
commits", a date). Figure out the production branch -- on this repo that's `main`, and since
work happens on a feature branch and gets pushed to `main` separately, the **local** `main`
ref can be stale. Always fetch first:

```
git fetch origin main
git log origin/main --since="today 00:00" --pretty=format:'%H|%ad|%s' --date=format:'%H:%M'
```

If that window is empty (nothing shipped today), say so plainly rather than stretching the
window silently -- "Nothing went live today" is a legitimate, useful answer. Only widen the
window if the user actually asked for a longer one.

## 2. Read the real commit, not just the subject line

For each commit in the window, pull the full message, not just the one-line subject:

```
git show --no-patch --format='%H%n%s%n%n%b' <hash>
```

The subject lines in this repo's history are already written for an engineer skimming `git
log`. The *body* is where the actual value is -- this project's commits consistently explain
what was broken, why it mattered, and how it was verified before shipping. That's exactly the
raw material for a plain-language outcome. Read it for the "why", not the "how".

## 3. Translate, don't transcribe

For each commit, ask: **what would the person running depots actually notice, or no longer
have to worry about?** Write that, in one line, in plain words. A few patterns from this
project's own history:

- "Widen FIFO Compliance from a 1-day to a 7-day rolling window" → "FIFO Compliance now shows
  a real number instead of reading 0% on quiet days."
- "Fix two real mobile layout bugs found during a phone/tablet/laptop pass" → "Fixed the
  dashboard overlapping itself on phones."
- "Restrict Audit History to National Admin and Regional Manager" → "Stock Controllers can no
  longer see other people's internal change logs on their own depot page."
- "Code-split pages and modals to cut the initial bundle roughly in half" → "The dashboard
  loads faster, especially on a weak connection."

Never use these terms in the output, even if they appear in the commit message: RLS, policy,
migration, refactor, bundle, lazy-load, chunk, hook, component, endpoint, query, schema,
commit, branch, deploy (say "live" instead), function name, file name, table name.

**Skip net-zero pairs.** If a commit was reverted later in the same window (a feature shipped,
then undone), the two together changed nothing for anyone using the dashboard -- leave the
whole pair out rather than reporting a feature that isn't actually live. Same for a commit that
only touches session/CI infrastructure with no user-facing effect (a build-trigger commit, a
config file add with no behavior change) -- it's not a lie to omit it, it's just not news.

**Combine, don't pad.** If three commits in a row are really one story (e.g. a feature built,
then a quick wording fix, then a follow-up tweak to the same thing), report it as one item, not
three. The reader wants the outcome, not the commit count.

## 4. Group and write the update

Structure as three short groups -- skip any group that's empty, don't force all three:

- **Shipped** -- new things people can now do that they couldn't before.
- **Fixed** -- things that were broken or misleading and now aren't.
- **Improved** -- things that worked before but are now faster, clearer, or safer.

Within each group, most important/most noticeable first. One line per item, plain sentence,
no jargon, no commit hashes, no file paths. A short emoji per group header is fine if it reads
naturally (🚀 Shipped, 🐛 Fixed, ⚡ Improved) -- don't force it if it feels forced.

End with one line confirming it's actually live, e.g. "All of this is already live on
[production URL if known from context, otherwise just 'live now']" -- that's the one thing a
stakeholder always wants confirmed before they tell anyone else.

## Output format

```
Here's what shipped [today/this week/...]:

🚀 Shipped
- <plain outcome>
- <plain outcome>

🐛 Fixed
- <plain outcome>

⚡ Improved
- <plain outcome>

All of this is already live.
```

Keep the whole thing short enough to paste into a chat message without scrolling -- if the
window has a lot of commits, that's a sign to combine related ones (step 3), not to write a
longer list.
