# Emerald Fitness — Member Context (Twilio Flex plugin)

Renders the context the Emerald Fitness voice AI agent hands over when it escalates a live call
into Flex, so the human who picks up already knows who they are talking to and what is blocking
them.

## What it shows

Everything comes off the **task attributes** — no extra API call, so it is on screen before the
agent says hello.

| Surface | What appears |
| --- | --- |
| **CRM container** (the large panel beside the call) | Member name, number and home studio · membership tier and status · the hold window and its length · the declined card and failed charge amount · classes booked, class history, usual Fuel Bar order and last instructor rating · why the AI escalated plus its written summary · the last stretch of the call transcript · the Twilio Memory profile the record came from |
| **Task Info tab** | A condensed strip: tier, membership status, a "card expired" flag, and the AI's summary |

If a task arrives that did not come from the Emerald Fitness voice agent, the panel says so instead
of rendering an empty shell.

## It is already live

A prebuilt, dependency-free version of this plugin is served by the voice service at
`/flex-plugin/emerald-member-context-<version>.js` and is registered against the Flex account
through the Plugins API. Nothing needs installing to use it.

That build is generated from `server/src/flex-plugin/bundle.ts`, which is the same component tree
written directly against the `window.React` and `window.Twilio.Flex` globals that Flex provides to
every plugin. It avoids a build step so the plugin can ship and update with the rest of the project.

## Rebuilding it the conventional way

This folder is the same plugin as an ordinary Flex plugin project, for when you want to develop it
against a local Flex instance or deploy it through Twilio's own hosting.

```bash
cd flex-plugin
npm install

# develop against your live Flex instance
twilio flex:plugins:start

# ship it through Twilio's plugin hosting
npm run deploy
npm run release
```

Releasing through the CLI supersedes the self-hosted registration, so pick one or the other rather
than running both at the same time.

## Keeping the two in step

If you change anything in `src/`, mirror it in `server/src/flex-plugin/bundle.ts` and bump
`FLEX_PLUGIN_VERSION` there. The version is part of the bundle URL, which is what forces Flex to
pick up a new build rather than a cached one.
